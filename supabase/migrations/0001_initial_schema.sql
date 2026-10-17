/* Migration: 0001_initial_schema.sql */
/* Description: Initial schema for ILoveBesi steel trading POS and inventory system */

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

/* Table: profiles */
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'cashier')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Table: products */
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  dimension TEXT NOT NULL,
  thickness_mm NUMERIC(4,2) NOT NULL CHECK (thickness_mm > 0),
  unit TEXT NOT NULL DEFAULT 'BTG',
  stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  avg_cost_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (avg_cost_price >= 0),
  sell_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_products_name_dimension_thickness UNIQUE (name, dimension, thickness_mm)
);

CREATE INDEX idx_products_dimension_thickness ON public.products (dimension, thickness_mm) WHERE is_active = true;

/* Trigger function: set_updated_at */
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

/* View: v_cashier_products */
CREATE VIEW public.v_cashier_products AS
SELECT
  id,
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
WHERE is_active = true;

/* Table: customers */
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  credit_limit NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Table: suppliers */
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Table: purchases */
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(15,2) NOT NULL CHECK (total_amount >= 0),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchases_supplier_id ON public.purchases (supplier_id);
CREATE INDEX idx_purchases_purchase_date ON public.purchases (purchase_date DESC);

/* Table: purchase_items */
CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  buy_price NUMERIC(15,2) NOT NULL CHECK (buy_price >= 0),
  subtotal NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX idx_purchase_items_purchase_id ON public.purchase_items (purchase_id);
CREATE INDEX idx_purchase_items_product_id ON public.purchase_items (product_id);

/* Table: sales */
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('TUNAI', 'KREDIT')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('LUNAS', 'BELUM_LUNAS')),
  subtotal_amount NUMERIC(15,2) NOT NULL CHECK (subtotal_amount >= 0),
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  grand_total NUMERIC(15,2) NOT NULL CHECK (grand_total >= 0),
  paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  remaining_debt NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (remaining_debt >= 0),
  due_date DATE,
  notes TEXT,
  cashier_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_credit_requires_customer CHECK (
    (payment_type = 'TUNAI') OR (payment_type = 'KREDIT' AND customer_id IS NOT NULL)
  )
);

CREATE INDEX idx_sales_date ON public.sales (sale_date DESC);
CREATE INDEX idx_sales_unpaid ON public.sales (customer_id, payment_status) WHERE payment_status = 'BELUM_LUNAS';
CREATE INDEX idx_sales_customer_id ON public.sales (customer_id);
CREATE INDEX idx_sales_cashier_id ON public.sales (cashier_id);

/* Table: sale_items */
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
  cost_price_at_sale NUMERIC(15,2) NOT NULL CHECK (cost_price_at_sale >= 0),
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  tax_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_pct >= 0 AND tax_pct <= 100),
  subtotal NUMERIC(15,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX idx_sale_items_sale_id ON public.sale_items (sale_id);
CREATE INDEX idx_sale_items_product_id ON public.sale_items (product_id);

/* Table: receivable_payments */
CREATE TABLE public.receivable_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'TUNAI' CHECK (payment_method IN ('TUNAI', 'TRANSFER')),
  notes TEXT,
  received_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_receivable_payments_sale_id ON public.receivable_payments (sale_id);

/* Table: operational_expenses */
CREATE TABLE public.operational_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operational_expenses_date ON public.operational_expenses (expense_date DESC);
