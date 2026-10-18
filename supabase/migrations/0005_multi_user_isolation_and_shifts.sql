/* Migration: 0005_multi_user_isolation_and_shifts.sql */
/* Description: Multi-User / Multi-Tenant Isolation (owner_id = auth.uid()) and Cashier Shifts */

/* 1. Trigger handle_new_user on auth.users for automatic profile creation */
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'owner'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

/* Backfill any existing auth.users missing from public.profiles */
INSERT INTO public.profiles (id, full_name, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'owner'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

/* 2. Add owner_id to primary tables and backfill */
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.operational_expenses ADD COLUMN IF NOT EXISTS owner_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

/* Backfill existing rows that have NULL owner_id */
DO $$
DECLARE
  v_first_user UUID;
BEGIN
  SELECT id INTO v_first_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF v_first_user IS NOT NULL THEN
    UPDATE public.products SET owner_id = v_first_user WHERE owner_id IS NULL;
    UPDATE public.customers SET owner_id = v_first_user WHERE owner_id IS NULL;
    UPDATE public.suppliers SET owner_id = v_first_user WHERE owner_id IS NULL;
    UPDATE public.purchases SET owner_id = COALESCE(created_by, v_first_user) WHERE owner_id IS NULL;
    UPDATE public.sales SET owner_id = COALESCE(cashier_id, v_first_user) WHERE owner_id IS NULL;
    UPDATE public.operational_expenses SET owner_id = COALESCE(created_by, v_first_user) WHERE owner_id IS NULL;
  END IF;
END $$;

/* 3. Update unique constraints to be scoped per owner_id */
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS uq_products_name_dimension_thickness;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS uq_products_owner_sku;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS uq_products_owner_name_dimension_thickness;
ALTER TABLE public.products ADD CONSTRAINT uq_products_owner_sku UNIQUE (owner_id, sku);
ALTER TABLE public.products ADD CONSTRAINT uq_products_owner_name_dimension_thickness UNIQUE (owner_id, name, dimension, thickness_mm);

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_code_key;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS uq_customers_owner_code;
ALTER TABLE public.customers ADD CONSTRAINT uq_customers_owner_code UNIQUE (owner_id, code);

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_invoice_number_key;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS uq_sales_owner_invoice_number;
ALTER TABLE public.sales ADD CONSTRAINT uq_sales_owner_invoice_number UNIQUE (owner_id, invoice_number);

ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS uq_purchases_owner_invoice_number;
ALTER TABLE public.purchases ADD CONSTRAINT uq_purchases_owner_invoice_number UNIQUE (owner_id, invoice_number);

/* 4. Cashier shifts table */
CREATE TABLE IF NOT EXISTS public.cashier_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  cashier_name TEXT NOT NULL,
  opening_cash NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  total_tunai NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_qris NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_kredit NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Add shift_id and cashier_name columns to public.sales */
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.cashier_shifts(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cashier_name TEXT;

/* 5. Recreate v_cashier_products view with security_invoker = true */
DROP VIEW IF EXISTS public.v_cashier_products CASCADE;
CREATE VIEW public.v_cashier_products
WITH (security_invoker = true)
AS
SELECT
  id,
  owner_id,
  sku,
  name,
  dimension,
  thickness_mm,
  unit,
  stock_qty,
  sell_price,
  is_active,
  updated_at
FROM public.products
WHERE is_active = true
  AND owner_id = auth.uid();

GRANT SELECT ON public.v_cashier_products TO authenticated;

/* 6. Clean up old RLS policies and apply strict owner_id = auth.uid() isolation */

/* Drop all previous policies on tables */
DROP POLICY IF EXISTS "products_owner_all" ON public.products;
DROP POLICY IF EXISTS "products_owner_isolation" ON public.products;

DROP POLICY IF EXISTS "customers_select_all_roles" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_all_roles" ON public.customers;
DROP POLICY IF EXISTS "customers_update_all_roles" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_owner_only" ON public.customers;
DROP POLICY IF EXISTS "customers_owner_isolation" ON public.customers;

DROP POLICY IF EXISTS "suppliers_owner_all" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_owner_isolation" ON public.suppliers;

DROP POLICY IF EXISTS "purchases_owner_all" ON public.purchases;
DROP POLICY IF EXISTS "purchases_owner_isolation" ON public.purchases;

DROP POLICY IF EXISTS "purchase_items_owner_all" ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items_owner_isolation" ON public.purchase_items;

DROP POLICY IF EXISTS "sales_select_all_roles" ON public.sales;
DROP POLICY IF EXISTS "sales_owner_modify" ON public.sales;
DROP POLICY IF EXISTS "sales_owner_isolation" ON public.sales;

DROP POLICY IF EXISTS "sale_items_select_all_roles" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_owner_modify" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_owner_isolation" ON public.sale_items;

DROP POLICY IF EXISTS "receivable_payments_select_all_roles" ON public.receivable_payments;
DROP POLICY IF EXISTS "receivable_payments_owner_modify" ON public.receivable_payments;
DROP POLICY IF EXISTS "receivable_payments_owner_isolation" ON public.receivable_payments;

DROP POLICY IF EXISTS "operational_expenses_owner_all" ON public.operational_expenses;
DROP POLICY IF EXISTS "operational_expenses_owner_isolation" ON public.operational_expenses;

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

DROP POLICY IF EXISTS "cashier_shifts_owner_isolation" ON public.cashier_shifts;

/* Apply strict isolation policies */
CREATE POLICY "profiles_select_self"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_insert_self"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_self"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
CREATE POLICY "products_owner_isolation"
ON public.products
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "customers_owner_isolation"
ON public.customers
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "suppliers_owner_isolation"
ON public.suppliers
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "purchases_owner_isolation"
ON public.purchases
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "purchase_items_owner_isolation"
ON public.purchase_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_id AND p.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.purchases p
    WHERE p.id = purchase_id AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "sales_owner_isolation"
ON public.sales
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "sale_items_owner_isolation"
ON public.sale_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "receivable_payments_owner_isolation"
ON public.receivable_payments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "operational_expenses_owner_isolation"
ON public.operational_expenses
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.cashier_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cashier_shifts_owner_isolation"
ON public.cashier_shifts
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

/* 7. Update RPC functions with owner_id scoping and shift binding */

/* RPC 1: rpc_record_purchase */
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
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Pengguna tidak terautentikasi';
  END IF;

  /* Validate supplier ownership */
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND owner_id = v_user_id) THEN
    RAISE EXCEPTION 'Supplier dengan ID % tidak ditemukan pada toko Anda', p_supplier_id;
  END IF;

  /* Validate items */
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Daftar item pembelian tidak boleh kosong';
  END IF;

  /* Check duplicate invoice_number for this owner */
  IF EXISTS (SELECT 1 FROM public.purchases WHERE owner_id = v_user_id AND invoice_number = p_invoice_number) THEN
    RAISE EXCEPTION 'Nomor faktur pembelian % sudah pernah diinput sebelumnya pada toko Anda', p_invoice_number;
  END IF;

  /* Insert purchase header with owner_id */
  INSERT INTO public.purchases (
    owner_id,
    invoice_number,
    supplier_id,
    purchase_date,
    total_amount,
    notes,
    created_by
  ) VALUES (
    v_user_id,
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

    /* Lock row product for update with owner_id check */
    SELECT stock_qty, avg_cost_price
    INTO v_old_stock, v_old_avg_cost
    FROM public.products
    WHERE id = v_product_id AND owner_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan pada toko Anda', v_product_id;
    END IF;

    /* Moving Average Formula */
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
    WHERE id = v_product_id AND owner_id = v_user_id;

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
  WHERE id = v_purchase_id AND owner_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'invoice_number', p_invoice_number,
    'total_amount', v_total_amount,
    'items_count', v_items_count
  );
END;
$$;

/* RPC 2: rpc_create_sale */
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
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND owner_id = v_user_id) THEN
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

    v_item_subtotal := ROUND((v_qty * v_unit_price) * (1.0 - (v_disc_pct / 100.0)) * (1.0 + (v_tax_pct / 100.0)), 2);
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

  /* Calculate grand total */
  v_grand_total := ROUND(v_subtotal_amount - COALESCE(p_discount_amount, 0) + COALESCE(p_tax_amount, 0), 2);
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
    'items', v_result_items,
    'cashier_name', COALESCE(v_shift_cashier_name, 'Kasir')
  );
END;
$$;

/* RPC 3: rpc_pay_receivable */
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
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Pengguna tidak terautentikasi';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pembayaran harus lebih besar dari nol';
  END IF;

  IF p_payment_method NOT IN ('TUNAI', 'TRANSFER', 'QRIS') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak valid: %', p_payment_method;
  END IF;

  /* Lock sale row FOR UPDATE and verify owner_id */
  SELECT invoice_number, remaining_debt, paid_amount, payment_status
  INTO v_invoice_number, v_remaining_debt, v_paid_amount, v_payment_status
  FROM public.sales
  WHERE id = p_sale_id AND owner_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Faktur penjualan dengan ID % tidak ditemukan pada toko Anda', p_sale_id;
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
  WHERE id = p_sale_id AND owner_id = v_user_id;

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

GRANT EXECUTE ON FUNCTION public.rpc_record_purchase(TEXT, UUID, DATE, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_pay_receivable(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
