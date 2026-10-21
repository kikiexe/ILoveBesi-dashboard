/* Migration: 0006_allow_optional_dimension_thickness_and_ppn.sql */
/* Description: Allow optional dimension and thickness (0 allowed), add include_ppn flag to products */

/* 1. Modify thickness check to allow 0 (for non-steel products or items without gauge) */
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_thickness_mm_check;
ALTER TABLE public.products ADD CONSTRAINT products_thickness_mm_check CHECK (thickness_mm >= 0);
ALTER TABLE public.products ALTER COLUMN thickness_mm SET DEFAULT 0;

/* 2. Make dimension optional with default empty string */
ALTER TABLE public.products ALTER COLUMN dimension DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN dimension SET DEFAULT '';

/* 3. Add include_ppn flag to products table */
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS include_ppn BOOLEAN NOT NULL DEFAULT false;

/* 4. Refresh v_cashier_products view to include include_ppn */
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
  include_ppn,
  is_active,
  updated_at
FROM public.products
WHERE is_active = true
  AND owner_id = auth.uid();

GRANT SELECT ON public.v_cashier_products TO authenticated;
