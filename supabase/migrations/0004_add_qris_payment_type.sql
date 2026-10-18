/* Migration: 0004_add_qris_payment_type.sql */
/* Menambahkan dukungan metode pembayaran QRIS pada skema database dan fungsi atomik */

/* 1. Perbarui check constraint payment_type pada tabel sales */
alter table public.sales drop constraint if exists sales_payment_type_check;
alter table public.sales add constraint sales_payment_type_check check (payment_type in ('TUNAI', 'QRIS', 'KREDIT'));

/* 2. Perbarui batasan pelanggan: TUNAI dan QRIS tidak wajib pelanggan, KREDIT wajib */
alter table public.sales drop constraint if exists chk_credit_requires_customer;
alter table public.sales add constraint chk_credit_requires_customer check (
  (payment_type in ('TUNAI', 'QRIS')) or (payment_type = 'KREDIT' and customer_id is not null)
);

/* 3. Perbarui fungsi rpc_create_sale agar memvalidasi QRIS */
create or replace function public.rpc_create_sale(
  p_customer_id uuid default null,
  p_payment_type text default 'TUNAI',
  p_discount_amount numeric(15,2) default 0,
  p_tax_amount numeric(15,2) default 0,
  p_paid_amount numeric(15,2) default 0,
  p_due_date date default null,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_user_id uuid;
  v_sale_id uuid;
  v_today_prefix text;
  v_next_seq integer;
  v_invoice_number text;
  v_subtotal_amount numeric(15,2) := 0;
  v_grand_total numeric(15,2) := 0;
  v_remaining_debt numeric(15,2) := 0;
  v_recorded_paid numeric(15,2) := 0;
  v_payment_status text;
  v_item jsonb;
  v_product_id uuid;
  v_product_name text;
  v_stock_qty integer;
  v_avg_cost_price numeric(15,2);
  v_qty integer;
  v_unit_price numeric(15,2);
  v_disc_pct numeric(5,2);
  v_tax_pct numeric(5,2);
  v_item_subtotal numeric(15,2);
  v_credit_limit numeric(15,2) := 0;
  v_current_debt numeric(15,2) := 0;
  v_prepared_items jsonb := '[]'::jsonb;
  v_result_items jsonb := '[]'::jsonb;
begin
  /* Verifikasi role pengguna */
  v_role := public.get_my_role();
  if v_role not in ('owner', 'cashier') then
    raise exception 'Akses ditolak: Role pengguna tidak berhak membuat penjualan';
  end if;

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Pengguna tidak terautentikasi';
  end if;

  /* Validasi metode pembayaran */
  if p_payment_type not in ('TUNAI', 'QRIS', 'KREDIT') then
    raise exception 'Tipe pembayaran tidak valid: %', p_payment_type;
  end if;

  /* Transaksi kredit wajib ada pelanggan */
  if p_payment_type = 'KREDIT' and p_customer_id is null then
    raise exception 'Transaksi kredit wajib menyertakan data pelanggan';
  end if;

  if p_customer_id is not null then
    if not exists (select 1 from public.customers where id = p_customer_id) then
      raise exception 'Pelanggan dengan ID % tidak ditemukan', p_customer_id;
    end if;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Daftar barang penjualan tidak boleh kosong';
  end if;

  /* Kunci urutan nomor faktur per hari */
  v_today_prefix := 'NF-' || to_char(now(), 'YYMMDD');
  perform pg_advisory_xact_lock(hashtext(v_today_prefix));

  select coalesce(max(substring(invoice_number from 10 for 4)::integer), 0) + 1
  into v_next_seq
  from public.sales
  where invoice_number like (v_today_prefix || '%');

  v_invoice_number := v_today_prefix || lpad(v_next_seq::text, 4, '0');

  /* Proses barang dan kurangi stok */
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'qty')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric(15,2);
    v_disc_pct := coalesce((v_item->>'discount_pct')::numeric(5,2), 0);
    v_tax_pct := coalesce((v_item->>'tax_pct')::numeric(5,2), 0);

    if v_qty is null or v_qty <= 0 then
      raise exception 'Kuantitas barang harus lebih besar dari nol';
    end if;

    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'Harga satuan barang tidak boleh bernilai negatif';
    end if;

    select name, stock_qty, avg_cost_price
    into v_product_name, v_stock_qty, v_avg_cost_price
    from public.products
    where id = v_product_id
    for update;

    if not found then
      raise exception 'Produk dengan ID % tidak ditemukan', v_product_id;
    end if;

    if v_stock_qty < v_qty then
      raise exception 'Stok produk % tidak mencukupi. Tersedia: %, Diminta: %',
        v_product_name, v_stock_qty, v_qty;
    end if;

    v_item_subtotal := round((v_qty * v_unit_price) * (1.0 - (v_disc_pct / 100.0)) * (1.0 + (v_tax_pct / 100.0)), 2);
    v_subtotal_amount := v_subtotal_amount + v_item_subtotal;

    update public.products
    set
      stock_qty = stock_qty - v_qty,
      updated_at = now()
    where id = v_product_id;

    v_prepared_items := v_prepared_items || jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product_name,
      'qty', v_qty,
      'unit_price', v_unit_price,
      'discount_pct', v_disc_pct,
      'tax_pct', v_tax_pct,
      'subtotal', v_item_subtotal,
      'cost_price_at_sale', v_avg_cost_price
    );
  end loop;
  /* Hitung total akhir */
  v_grand_total := round(v_subtotal_amount - coalesce(p_discount_amount, 0) + coalesce(p_tax_amount, 0), 2);
  if v_grand_total < 0 then
    v_grand_total := 0;
  end if;

  /* Tentukan status pembayaran dan sisa piutang */
  if p_payment_type in ('TUNAI', 'QRIS') then
    if coalesce(p_paid_amount, 0) < v_grand_total then
      raise exception 'Jumlah bayar % (Rp %) kurang dari total tagihan (Rp %)', p_payment_type, p_paid_amount, v_grand_total;
    end if;
    v_payment_status := 'LUNAS';
    v_remaining_debt := 0;
    v_recorded_paid := v_grand_total;
  else
    /* KREDIT */
    if coalesce(p_paid_amount, 0) >= v_grand_total then
      raise exception 'Pembayaran kredit tidak boleh sama dengan atau melebihi total tagihan';
    end if;

    v_payment_status := 'BELUM_LUNAS';
    v_remaining_debt := v_grand_total - coalesce(p_paid_amount, 0);
    v_recorded_paid := coalesce(p_paid_amount, 0);

    /* Verifikasi limit kredit pelanggan jika dikonfigurasi */
    select credit_limit into v_credit_limit
    from public.customers
    where id = p_customer_id;

    if v_credit_limit > 0 then
      select coalesce(sum(remaining_debt), 0) into v_current_debt
      from public.sales
      where customer_id = p_customer_id
        and payment_status = 'BELUM_LUNAS';

      if (v_current_debt + v_remaining_debt) > v_credit_limit then
        raise exception 'Total piutang berjalan (Rp %) ditambah piutang baru (Rp %) melebihi limit kredit pelanggan (Rp %)',
          v_current_debt, v_remaining_debt, v_credit_limit;
      end if;
    end if;
  end if;

  /* Simpan header penjualan */
  insert into public.sales (
    invoice_number,
    sale_date,
    customer_id,
    payment_type,
    payment_status,
    subtotal_amount,
    discount_amount,
    tax_amount,
    grand_total,
    paid_amount,
    remaining_debt,
    due_date,
    notes,
    cashier_id
  ) values (
    v_invoice_number,
    now(),
    p_customer_id,
    p_payment_type,
    v_payment_status,
    v_subtotal_amount,
    coalesce(p_discount_amount, 0),
    coalesce(p_tax_amount, 0),
    v_grand_total,
    v_recorded_paid,
    v_remaining_debt,
    case when p_payment_type = 'KREDIT' then p_due_date else null end,
    p_notes,
    v_user_id
  ) returning id into v_sale_id;

  /* Simpan item penjualan dan susun v_result_items */
  for v_item in select * from jsonb_array_elements(v_prepared_items)
  loop
    insert into public.sale_items (
      sale_id,
      product_id,
      qty,
      unit_price,
      cost_price_at_sale,
      discount_pct,
      tax_pct,
      subtotal
    ) values (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'qty')::integer,
      (v_item->>'unit_price')::numeric(15,2),
      (v_item->>'cost_price_at_sale')::numeric(15,2),
      (v_item->>'discount_pct')::numeric(5,2),
      (v_item->>'tax_pct')::numeric(5,2),
      (v_item->>'subtotal')::numeric(15,2)
    );

    v_result_items := v_result_items || jsonb_build_object(
      'product_id', v_item->>'product_id',
      'product_name', v_item->>'product_name',
      'qty', (v_item->>'qty')::integer,
      'unit_price', (v_item->>'unit_price')::numeric(15,2),
      'discount_pct', (v_item->>'discount_pct')::numeric(5,2),
      'tax_pct', (v_item->>'tax_pct')::numeric(5,2),
      'subtotal', (v_item->>'subtotal')::numeric(15,2)
    );
  end loop;

  /* Jika transaksi kredit memiliki uang muka (DP), catat otomatis ke riwayat pembayaran piutang */
  if p_payment_type = 'KREDIT' and v_recorded_paid > 0 then
    insert into public.receivable_payments (
      sale_id,
      payment_date,
      amount,
      payment_method,
      notes,
      received_by
    ) values (
      v_sale_id,
      now(),
      v_recorded_paid,
      'TUNAI',
      'DP Awal',
      v_user_id
    );
  end if;

  /* Kembalikan objek faktur lengkap untuk struk kasir */
  return jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'invoice_number', v_invoice_number,
    'sale_date', now(),
    'customer_id', p_customer_id,
    'payment_type', p_payment_type,
    'payment_status', v_payment_status,
    'subtotal_amount', v_subtotal_amount,
    'discount_amount', coalesce(p_discount_amount, 0),
    'tax_amount', coalesce(p_tax_amount, 0),
    'grand_total', v_grand_total,
    'paid_amount', v_recorded_paid,
    'remaining_debt', v_remaining_debt,
    'due_date', case when p_payment_type = 'KREDIT' then p_due_date else null end,
    'notes', p_notes,
    'items', v_result_items
  );
end;
$$;
