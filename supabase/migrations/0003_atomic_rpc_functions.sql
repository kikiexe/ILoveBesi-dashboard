/* Migration: 0003_atomic_rpc_functions.sql */
/* Description: Atomic PL/pgSQL RPC transaction functions for purchases, sales, and receivables */

/* Function 1: rpc_record_purchase */
CREATE OR REPLACE FUNCTION public.rpc_record_purchase(
  p_invoice_number TEXT,
  p_supplier_id UUID,
  p_purchase_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_user_id UUID;
  v_purchase_id UUID;
  v_total_amount NUMERIC(15,2) := 0;
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_buy_price NUMERIC(15,2);
  v_subtotal NUMERIC(15,2);
  v_old_stock INTEGER;
  v_old_avg_cost NUMERIC(15,2);
  v_new_avg_cost NUMERIC(15,2);
  v_items_count INTEGER := 0;
BEGIN
  /* Verify role: strictly owner only */
  v_role := public.get_my_role();
  IF v_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya owner yang dapat mencatat pembelian kulakan';
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Pengguna tidak terautentikasi';
  END IF;

  /* Validate supplier */
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id) THEN
    RAISE EXCEPTION 'Supplier dengan ID % tidak ditemukan', p_supplier_id;
  END IF;

  /* Validate items */
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Daftar item pembelian tidak boleh kosong';
  END IF;

  /* Insert purchase header */
  INSERT INTO public.purchases (
    invoice_number,
    supplier_id,
    purchase_date,
    total_amount,
    notes,
    created_by
  ) VALUES (
    p_invoice_number,
    p_supplier_id,
    COALESCE(p_purchase_date, CURRENT_DATE),
    0,
    p_notes,
    v_user_id
  ) RETURNING id INTO v_purchase_id;

  /* Process items and update stock & weighted moving average cost */
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;
    v_buy_price := (v_item->>'buy_price')::NUMERIC(15,2);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Kuantitas barang harus lebih besar dari nol';
    END IF;

    IF v_buy_price IS NULL OR v_buy_price < 0 THEN
      RAISE EXCEPTION 'Harga beli barang tidak boleh bernilai negatif';
    END IF;

    v_subtotal := ROUND(v_qty * v_buy_price, 2);
    v_total_amount := v_total_amount + v_subtotal;

    /* Lock row product for update */
    SELECT stock_qty, avg_cost_price
    INTO v_old_stock, v_old_avg_cost
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', v_product_id;
    END IF;

    /* Moving Average Formula: ROUND(((old_stock * old_avg_cost) + (buy_qty * buy_price)) / (old_stock + buy_qty), 2) */
    IF (v_old_stock + v_qty) > 0 THEN
      v_new_avg_cost := ROUND(((v_old_stock * v_old_avg_cost) + (v_qty * v_buy_price)) / (v_old_stock + v_qty), 2);
    ELSE
      v_new_avg_cost := v_buy_price;
    END IF;

    /* Update product stock and avg_cost_price */
    UPDATE public.products
    SET
      stock_qty = v_old_stock + v_qty,
      avg_cost_price = v_new_avg_cost,
      updated_at = now()
    WHERE id = v_product_id;

    /* Insert purchase item */
    INSERT INTO public.purchase_items (
      purchase_id,
      product_id,
      qty,
      buy_price,
      subtotal
    ) VALUES (
      v_purchase_id,
      v_product_id,
      v_qty,
      v_buy_price,
      v_subtotal
    );

    v_items_count := v_items_count + 1;
  END LOOP;

  /* Update final total_amount on header */
  UPDATE public.purchases
  SET total_amount = v_total_amount
  WHERE id = v_purchase_id;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'invoice_number', p_invoice_number,
    'total_amount', v_total_amount,
    'items_count', v_items_count
  );
END;
$$;

/* Function 2: rpc_create_sale */
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
  v_role TEXT;
  v_user_id UUID;
  v_sale_id UUID;
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
BEGIN
  /* Verify role: owner or cashier */
  v_role := public.get_my_role();
  IF v_role NOT IN ('owner', 'cashier') THEN
    RAISE EXCEPTION 'Akses ditolak: Role pengguna tidak berhak membuat penjualan';
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Pengguna tidak terautentikasi';
  END IF;

  /* Validate payment type */
  IF p_payment_type NOT IN ('TUNAI', 'KREDIT') THEN
    RAISE EXCEPTION 'Tipe pembayaran tidak valid: %', p_payment_type;
  END IF;

  /* Credit sale requires customer */
  IF p_payment_type = 'KREDIT' AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Transaksi kredit wajib menyertakan data pelanggan';
  END IF;

  /* Validate customer existence if provided */
  IF p_customer_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id) THEN
      RAISE EXCEPTION 'Pelanggan dengan ID % tidak ditemukan', p_customer_id;
    END IF;
  END IF;

  /* Validate items */
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Daftar barang penjualan tidak boleh kosong';
  END IF;

  /* Advisory transaction lock serializes invoice sequence generation per day */
  v_today_prefix := 'NF-' || to_char(now(), 'YYMMDD');
  PERFORM pg_advisory_xact_lock(hashtext(v_today_prefix));

  SELECT COALESCE(MAX(SUBSTRING(invoice_number FROM 10 FOR 4)::INTEGER), 0) + 1
  INTO v_next_seq
  FROM public.sales
  WHERE invoice_number LIKE (v_today_prefix || '%');

  v_invoice_number := v_today_prefix || lpad(v_next_seq::TEXT, 4, '0');

  /* Process items: Lock row, check stock, immediately decrement stock to prevent duplicate item leak */
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

    /* Lock product row FOR UPDATE */
    SELECT name, stock_qty, avg_cost_price
    INTO v_product_name, v_stock_qty, v_avg_cost_price
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan', v_product_id;
    END IF;

    /* Check remaining stock directly */
    IF v_stock_qty < v_qty THEN
      RAISE EXCEPTION 'Stok tidak mencukupi untuk % (tersedia: %, diminta: %)', v_product_name, v_stock_qty, v_qty;
    END IF;

    /* Deduct stock immediately so subsequent rows with identical product_id see updated balance */
    UPDATE public.products
    SET
      stock_qty = stock_qty - v_qty,
      updated_at = now()
    WHERE id = v_product_id;

    /* Calculate item subtotal after item-level discount and tax */
    v_item_subtotal := ROUND((v_qty * v_unit_price) * (1 - (v_disc_pct / 100)) * (1 + (v_tax_pct / 100)), 2);
    v_subtotal_amount := v_subtotal_amount + v_item_subtotal;

    /* Store prepared item for insertion after sales header is generated */
    v_prepared_items := v_prepared_items || jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product_name,
      'qty', v_qty,
      'unit_price', v_unit_price,
      'cost_price_at_sale', v_avg_cost_price,
      'discount_pct', v_disc_pct,
      'tax_pct', v_tax_pct,
      'subtotal', v_item_subtotal
    );
  END LOOP;

  /* Calculate grand total */
  v_grand_total := ROUND(v_subtotal_amount - COALESCE(p_discount_amount, 0) + COALESCE(p_tax_amount, 0), 2);
  IF v_grand_total < 0 THEN
    v_grand_total := 0;
  END IF;

  /* Determine payment status and remaining debt */
  IF p_payment_type = 'TUNAI' THEN
    IF COALESCE(p_paid_amount, 0) < v_grand_total THEN
      RAISE EXCEPTION 'Jumlah bayar tunai (Rp %) kurang dari total tagihan (Rp %)', p_paid_amount, v_grand_total;
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

    /* Verify Customer Credit Limit if configured */
    SELECT credit_limit INTO v_credit_limit
    FROM public.customers
    WHERE id = p_customer_id;

    IF v_credit_limit > 0 THEN
      SELECT COALESCE(SUM(remaining_debt), 0)
      INTO v_current_debt
      FROM public.sales
      WHERE customer_id = p_customer_id
        AND payment_status = 'BELUM_LUNAS';

      IF (v_current_debt + v_remaining_debt) > v_credit_limit THEN
        RAISE EXCEPTION 'Total piutang berjalan (Rp %) ditambah piutang baru (Rp %) melebihi limit kredit pelanggan (Rp %)',
          v_current_debt, v_remaining_debt, v_credit_limit;
      END IF;
    END IF;
  END IF;

  /* Insert sales header */
  INSERT INTO public.sales (
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
    p_due_date,
    p_notes,
    v_user_id
  ) RETURNING id INTO v_sale_id;

  /* Insert sale_items from prepared items */
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

  /* Return complete invoice object for cashier receipt printing */
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
    'due_date', p_due_date,
    'items', v_result_items
  );
END;
$$;

/* Function 3: rpc_pay_receivable */
CREATE OR REPLACE FUNCTION public.rpc_pay_receivable(
  p_sale_id UUID,
  p_amount NUMERIC(15,2),
  p_payment_method TEXT DEFAULT 'TUNAI',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_user_id UUID;
  v_payment_id UUID;
  v_remaining_debt NUMERIC(15,2);
  v_paid_amount NUMERIC(15,2);
  v_payment_status TEXT;
  v_new_remaining_debt NUMERIC(15,2);
  v_new_paid_amount NUMERIC(15,2);
  v_new_status TEXT;
  v_invoice_number TEXT;
BEGIN
  /* Verify role: owner or cashier */
  v_role := public.get_my_role();
  IF v_role NOT IN ('owner', 'cashier') THEN
    RAISE EXCEPTION 'Akses ditolak: Role pengguna tidak berhak menerima pembayaran piutang';
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Pengguna tidak terautentikasi';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pembayaran harus lebih besar dari nol';
  END IF;

  IF p_payment_method NOT IN ('TUNAI', 'TRANSFER') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak valid: %', p_payment_method;
  END IF;

  /* Lock sale row FOR UPDATE */
  SELECT invoice_number, remaining_debt, paid_amount, payment_status
  INTO v_invoice_number, v_remaining_debt, v_paid_amount, v_payment_status
  FROM public.sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Faktur penjualan dengan ID % tidak ditemukan', p_sale_id;
  END IF;

  IF v_payment_status = 'LUNAS' OR v_remaining_debt <= 0 THEN
    RAISE EXCEPTION 'Faktur penjualan % sudah lunas', v_invoice_number;
  END IF;

  IF p_amount > v_remaining_debt THEN
    RAISE EXCEPTION 'Nominal pembayaran (Rp %) melebihi sisa piutang (Rp %)', p_amount, v_remaining_debt;
  END IF;

  /* Insert receivable payment entry */
  INSERT INTO public.receivable_payments (
    sale_id,
    payment_date,
    amount,
    payment_method,
    notes,
    received_by
  ) VALUES (
    p_sale_id,
    now(),
    p_amount,
    p_payment_method,
    p_notes,
    v_user_id
  ) RETURNING id INTO v_payment_id;

  /* Calculate updated balances */
  v_new_remaining_debt := v_remaining_debt - p_amount;
  v_new_paid_amount := v_paid_amount + p_amount;

  IF v_new_remaining_debt = 0 THEN
    v_new_status := 'LUNAS';
  ELSE
    v_new_status := 'BELUM_LUNAS';
  END IF;

  /* Update sales header */
  UPDATE public.sales
  SET
    paid_amount = v_new_paid_amount,
    remaining_debt = v_new_remaining_debt,
    payment_status = v_new_status
  WHERE id = p_sale_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'sale_id', p_sale_id,
    'invoice_number', v_invoice_number,
    'payment_date', now(),
    'amount_paid', p_amount,
    'payment_method', p_payment_method,
    'new_paid_amount', v_new_paid_amount,
    'new_remaining_debt', v_new_remaining_debt,
    'payment_status', v_new_status
  );
END;
$$;

/* Grant execute permissions to authenticated users */
GRANT EXECUTE ON FUNCTION public.rpc_record_purchase(TEXT, UUID, DATE, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_pay_receivable(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
