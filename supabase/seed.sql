/* Supabase Seed Data: seed.sql */
/* Initial seed data for ILoveBesi steel inventory and POS */

/* 1. Initial Customers */
INSERT INTO public.customers (id, code, name, phone, address, credit_limit)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'P00001', 'Pelanggan Umum', NULL, NULL, 0),
  ('c0000000-0000-0000-0000-000000000040', 'P00040', 'PT INDONESIA BIN YUSUF', '08123456789', 'Jl. Industri No. 40, Jakarta Timur', 50000000.00)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  credit_limit = EXCLUDED.credit_limit;

/* 2. Initial Suppliers */
INSERT INTO public.suppliers (id, name, phone, address)
VALUES
  ('s0000000-0000-0000-0000-000000000001', 'PT Krakatau Baja Makmur', '021-5551234', 'Kawasan Industri Cilegon, Banten')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address;

/* 3. Initial Products: 6 Hollow Galvanis variations */
INSERT INTO public.products (
  sku,
  name,
  dimension,
  thickness_mm,
  unit,
  stock_qty,
  avg_cost_price,
  sell_price,
  is_active
)
VALUES
  (
    'HG-20x40-0.8',
    'Besi Hollow Galvanis 20x40 0.80mm',
    '20x40',
    0.80,
    'BTG',
    120,
    65000.00,
    78000.00,
    true
  ),
  (
    'HG-20x40-1.0',
    'Besi Hollow Galvanis 20x40 1.00mm',
    '20x40',
    1.00,
    'BTG',
    100,
    78000.00,
    92000.00,
    true
  ),
  (
    'HG-20x40-1.2',
    'Besi Hollow Galvanis 20x40 1.20mm',
    '20x40',
    1.20,
    'BTG',
    80,
    92000.00,
    108000.00,
    true
  ),
  (
    'HG-40x40-0.8',
    'Besi Hollow Galvanis 40x40 0.80mm',
    '40x40',
    0.80,
    'BTG',
    90,
    110000.00,
    128000.00,
    true
  ),
  (
    'HG-40x40-1.0',
    'Besi Hollow Galvanis 40x40 1.00mm',
    '40x40',
    1.00,
    'BTG',
    75,
    132000.00,
    152000.00,
    true
  ),
  (
    'HG-40x40-1.2',
    'Besi Hollow Galvanis 40x40 1.20mm',
    '40x40',
    1.20,
    'BTG',
    60,
    155000.00,
    178000.00,
    true
  )
ON CONFLICT (sku) DO UPDATE
SET
  name = EXCLUDED.name,
  dimension = EXCLUDED.dimension,
  thickness_mm = EXCLUDED.thickness_mm,
  unit = EXCLUDED.unit,
  stock_qty = EXCLUDED.stock_qty,
  avg_cost_price = EXCLUDED.avg_cost_price,
  sell_price = EXCLUDED.sell_price,
  is_active = EXCLUDED.is_active;
