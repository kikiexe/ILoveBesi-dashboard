/* Migration: 0002_rls_policies.sql */
/* Description: Row Level Security policies and role checking helper function */

/* Helper function: get_my_role */
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

/* Enable Row Level Security on all 10 tables */
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivable_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_expenses ENABLE ROW LEVEL SECURITY;

/* 1. Policies for profiles */
CREATE POLICY "profiles_select_policy"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR public.get_my_role() = 'owner'
);

CREATE POLICY "profiles_insert_policy"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_my_role() = 'owner'
);

CREATE POLICY "profiles_update_policy"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR public.get_my_role() = 'owner'
)
WITH CHECK (
  public.get_my_role() = 'owner'
  OR (
    auth.uid() = id
    AND role = 'cashier'
    AND (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'cashier'
  )
);

CREATE POLICY "profiles_delete_policy"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  public.get_my_role() = 'owner'
);

/* 2. Policies for products: owner only direct access; cashier accesses via v_cashier_products */
CREATE POLICY "products_owner_all"
ON public.products
FOR ALL
TO authenticated
USING (
  public.get_my_role() = 'owner'
)
WITH CHECK (
  public.get_my_role() = 'owner'
);

/* 3. Policies for suppliers: owner only */
CREATE POLICY "suppliers_owner_all"
ON public.suppliers
FOR ALL
TO authenticated
USING (
  public.get_my_role() = 'owner'
)
WITH CHECK (
  public.get_my_role() = 'owner'
);

/* 4. Policies for purchases: owner only */
CREATE POLICY "purchases_owner_all"
ON public.purchases
FOR ALL
TO authenticated
USING (
  public.get_my_role() = 'owner'
)
WITH CHECK (
  public.get_my_role() = 'owner'
);

/* 5. Policies for purchase_items: owner only */
CREATE POLICY "purchase_items_owner_all"
ON public.purchase_items
FOR ALL
TO authenticated
USING (
  public.get_my_role() = 'owner'
)
WITH CHECK (
  public.get_my_role() = 'owner'
);

/* 6. Policies for operational_expenses: owner only */
CREATE POLICY "operational_expenses_owner_all"
ON public.operational_expenses
FOR ALL
TO authenticated
USING (
  public.get_my_role() = 'owner'
)
WITH CHECK (
  public.get_my_role() = 'owner'
);

/* 7. Policies for customers: owner and cashier can select, insert, update; only owner can delete */
CREATE POLICY "customers_select_all_roles"
ON public.customers
FOR SELECT
TO authenticated
USING (
  public.get_my_role() IN ('owner', 'cashier')
);

CREATE POLICY "customers_insert_all_roles"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_my_role() IN ('owner', 'cashier')
);

CREATE POLICY "customers_update_all_roles"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  public.get_my_role() IN ('owner', 'cashier')
)
WITH CHECK (
  public.get_my_role() IN ('owner', 'cashier')
);

CREATE POLICY "customers_delete_owner_only"
ON public.customers
FOR DELETE
TO authenticated
USING (
  public.get_my_role() = 'owner'
);

/* 8. Policies for sales: both roles can read; mutations restricted to owner and atomic RPC */
CREATE POLICY "sales_select_all_roles"
ON public.sales
FOR SELECT
TO authenticated
USING (
  public.get_my_role() IN ('owner', 'cashier')
);

CREATE POLICY "sales_owner_modify"
ON public.sales
FOR ALL
TO authenticated
USING (
  public.get_my_role() = 'owner'
)
WITH CHECK (
  public.get_my_role() = 'owner'
);

/* 9. Policies for sale_items: both roles can read; mutations restricted to owner and atomic RPC */
CREATE POLICY "sale_items_select_all_roles"
ON public.sale_items
FOR SELECT
TO authenticated
USING (
  public.get_my_role() IN ('owner', 'cashier')
);

CREATE POLICY "sale_items_owner_modify"
ON public.sale_items
FOR ALL
TO authenticated
USING (
  public.get_my_role() = 'owner'
)
WITH CHECK (
  public.get_my_role() = 'owner'
);

/* 10. Policies for receivable_payments: both roles can read; mutations restricted to owner and atomic RPC */
CREATE POLICY "receivable_payments_select_all_roles"
ON public.receivable_payments
FOR SELECT
TO authenticated
USING (
  public.get_my_role() IN ('owner', 'cashier')
);

CREATE POLICY "receivable_payments_owner_modify"
ON public.receivable_payments
FOR ALL
TO authenticated
USING (
  public.get_my_role() = 'owner'
)
WITH CHECK (
  public.get_my_role() = 'owner'
);

/* Grant access on cashier products view to authenticated users */
GRANT SELECT ON public.v_cashier_products TO authenticated;
