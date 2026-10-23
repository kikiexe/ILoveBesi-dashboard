/* Migration: 0007_inclusive_tax_and_cart_ppn.sql */
/* Description: Update rpc_create_sale so grand_total is not inflated when tax is inclusive */

CREATE OR REPLACE FUNCTION public.rpc_create_sale(
  p_customer_id UUID DEFAULT NULL,
  p_payment_type TEXT DEFAULT 'TUNAI',
  p_discount_amount NUMERIC(15,2) DEFAULT 0,
  p_tax_amount NUMERIC(15,2) DEFAULT 0,
  p_paid_amount NUMERIC(15,2) DEFAULT 0,
  p_due_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_sale_id UUID;
  v_shift_id UUID;
  v_shift_cashier_name TEXT;
  v_today_prefix TEXT;
  v_next_seq INTEGER;
  v_invoice_number TEXT;
  v_subtotal_amount NUMERIC(15,2) := 0;
  v_grand_total NUMERIC(15,2) := 0;
  v_remaining_debt NUMERIC(15,2) := 0;
  v_recorded_paid NUMERIC(15,2) := 0;
  v_payment_status TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_product_name TEXT;
  v_stock_qty INTEGER;
  v_avg_cost_price NUMERIC(15,2);
  v_qty INTEGER;
  v_unit_price NUMERIC(15,2);
  v_disc_pct NUMERIC(5,2);
  v_tax_pct NUMERIC(5,2);
  v_item_subtotal NUMERIC(15,2);
  v_credit_limit NUMERIC(15,2) := 0;
  v_current_debt NUMERIC(15,2) := 0;
  v_prepared_items JSONB := '[]'::jsonb;
  v_result_items JSONB := '[]'::jsonb;
  v_customer_name TEXT := NULL;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Pengguna tidak terautentikasi';
  END IF;

  /* Validate payment type */
  IF p_payment_type NOT IN ('TUNAI', 'QRIS', 'KREDIT') THEN
    RAISE EXCEPTION 'Tipe pembayaran tidak valid: %', p_payment_type;
  END IF;

  /* Credit sale requires customer */
  IF p_payment_type = 'KREDIT' AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Transaksi kredit wajib menyertakan data pelanggan';
  END IF;

  IF p_customer_id IS NOT NULL THEN
    SELECT name INTO v_customer_name
    FROM public.customers
    WHERE id = p_customer_id AND owner_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pelanggan dengan ID % tidak ditemukan pada toko Anda', p_customer_id;
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Daftar barang penjualan tidak boleh kosong';
  END IF;

  /* Look up currently active shift for this owner */
  SELECT id, cashier_name
  INTO v_shift_id, v_shift_cashier_name
  FROM public.cashier_shifts
  WHERE owner_id = v_user_id AND status = 'OPEN'
  ORDER BY opened_at DESC
  LIMIT 1;

  /* Lock sequence per owner per day */
  v_today_prefix := 'NF-' || to_char(now(), 'YYMMDD');
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text || '-' || v_today_prefix));

  SELECT COALESCE(MAX(SUBSTRING(invoice_number FROM 10 FOR 4)::INTEGER), 0) + 1
  INTO v_next_seq
  FROM public.sales
  WHERE owner_id = v_user_id
    AND invoice_number LIKE (v_today_prefix || '%');

  v_invoice_number := v_today_prefix || LPAD(v_next_seq::TEXT, 4, '0');

  /* Process items and deduct inventory */
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC(15,2);
    v_disc_pct := COALESCE((v_item->>'discount_pct')::NUMERIC(5,2), 0);
    v_tax_pct := COALESCE((v_item->>'tax_pct')::NUMERIC(5,2), 0);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Kuantitas barang harus lebih besar dari nol';
    END IF;

    IF v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'Harga satuan barang tidak boleh bernilai negatif';
    END IF;

    SELECT name, stock_qty, avg_cost_price
    INTO v_product_name, v_stock_qty, v_avg_cost_price
    FROM public.products
    WHERE id = v_product_id AND owner_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan pada toko Anda', v_product_id;
    END IF;

    IF v_stock_qty < v_qty THEN
      RAISE EXCEPTION 'Stok produk % tidak mencukupi. Tersedia: %, Diminta: %',
        v_product_name, v_stock_qty, v_qty;
    END IF;

    v_item_subtotal := ROUND((v_qty * v_unit_price) * (1.0 - (v_disc_pct / 100.0)), 2);
    v_subtotal_amount := v_subtotal_amount + v_item_subtotal;

    UPDATE public.products
    SET
      stock_qty = stock_qty - v_qty,
      updated_at = now()
    WHERE id = v_product_id AND owner_id = v_user_id;

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
  END LOOP;

  /* Calculate grand total (prices are inclusive of PPN) */
  v_grand_total := ROUND(v_subtotal_amount - COALESCE(p_discount_amount, 0), 2);
  IF v_grand_total < 0 THEN
    v_grand_total := 0;
  END IF;

  /* Determine payment status and remaining debt */
  IF p_payment_type IN ('TUNAI', 'QRIS') THEN
    IF COALESCE(p_paid_amount, 0) < v_grand_total THEN
      RAISE EXCEPTION 'Jumlah bayar % (Rp %) kurang dari total tagihan (Rp %)', p_payment_type, p_paid_amount, v_grand_total;
    END IF;
    v_payment_status := 'LUNAS';
    v_remaining_debt := 0;
    v_recorded_paid := v_grand_total;
  ELSE
    /* KREDIT */
    IF COALESCE(p_paid_amount, 0) >= v_grand_total THEN
      RAISE EXCEPTION 'Pembayaran kredit tidak boleh sama dengan atau melebihi total tagihan';
    END IF;

    v_payment_status := 'BELUM_LUNAS';
    v_remaining_debt := v_grand_total - COALESCE(p_paid_amount, 0);
    v_recorded_paid := COALESCE(p_paid_amount, 0);

    /* Verify Customer Credit Limit */
    SELECT credit_limit INTO v_credit_limit
    FROM public.customers
    WHERE id = p_customer_id AND owner_id = v_user_id;

    IF v_credit_limit > 0 THEN
      SELECT COALESCE(SUM(remaining_debt), 0)
      INTO v_current_debt
      FROM public.sales
      WHERE customer_id = p_customer_id
        AND owner_id = v_user_id
        AND payment_status = 'BELUM_LUNAS';

      IF (v_current_debt + v_remaining_debt) > v_credit_limit THEN
        RAISE EXCEPTION 'Total piutang berjalan (Rp %) ditambah piutang baru (Rp %) melebihi limit kredit pelanggan (Rp %)',
          v_current_debt, v_remaining_debt, v_credit_limit;
      END IF;
    END IF;
  END IF;

  /* Insert sales header with owner_id, shift_id, and cashier_name */
  INSERT INTO public.sales (
    owner_id,
    shift_id,
    cashier_name,
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
  ) VALUES (
    v_user_id,
    v_shift_id,
    COALESCE(v_shift_cashier_name, 'Kasir'),
    v_invoice_number,
    now(),
    p_customer_id,
    p_payment_type,
    v_payment_status,
    v_subtotal_amount,
    COALESCE(p_discount_amount, 0),
    COALESCE(p_tax_amount, 0),
    v_grand_total,
    v_recorded_paid,
    v_remaining_debt,
    CASE WHEN p_payment_type = 'KREDIT' THEN p_due_date ELSE NULL END,
    p_notes,
    v_user_id
  ) RETURNING id INTO v_sale_id;

  /* Insert sale_items */
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_prepared_items)
  LOOP
    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      qty,
      unit_price,
      cost_price_at_sale,
      discount_pct,
      tax_pct,
      subtotal
    ) VALUES (
      v_sale_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'qty')::INTEGER,
      (v_item->>'unit_price')::NUMERIC(15,2),
      (v_item->>'cost_price_at_sale')::NUMERIC(15,2),
      (v_item->>'discount_pct')::NUMERIC(5,2),
      (v_item->>'tax_pct')::NUMERIC(5,2),
      (v_item->>'subtotal')::NUMERIC(15,2)
    );

    v_result_items := v_result_items || jsonb_build_object(
      'product_id', v_item->>'product_id',
      'product_name', v_item->>'product_name',
      'qty', (v_item->>'qty')::INTEGER,
      'unit_price', (v_item->>'unit_price')::NUMERIC(15,2),
      'discount_pct', (v_item->>'discount_pct')::NUMERIC(5,2),
      'tax_pct', (v_item->>'tax_pct')::NUMERIC(5,2),
      'subtotal', (v_item->>'subtotal')::NUMERIC(15,2)
    );
  END LOOP;

  /* If credit sale has down payment, record initial receivable payment */
  IF p_payment_type = 'KREDIT' AND v_recorded_paid > 0 THEN
    INSERT INTO public.receivable_payments (
      sale_id,
      payment_date,
      amount,
      payment_method,
      notes,
      received_by
    ) VALUES (
      v_sale_id,
      now(),
      v_recorded_paid,
      'TUNAI',
      'DP Awal',
      v_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'invoice_number', v_invoice_number,
    'sale_date', now(),
    'customer_id', p_customer_id,
    'payment_type', p_payment_type,
    'payment_status', v_payment_status,
    'subtotal_amount', v_subtotal_amount,
    'discount_amount', COALESCE(p_discount_amount, 0),
    'tax_amount', COALESCE(p_tax_amount, 0),
    'grand_total', v_grand_total,
    'paid_amount', v_recorded_paid,
    'remaining_debt', v_remaining_debt,
    'due_date', CASE WHEN p_payment_type = 'KREDIT' THEN p_due_date ELSE NULL END,
    'notes', p_notes,
    'items', v_result_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_create_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT, JSONB) TO authenticated;
