/*
# Daftrk Multi-Tenant Schema

## Overview
Creates the full multi-tenant data model for Daftrk, a lightweight business
management SaaS. Each business (tenant) is a `companies` row. Users belong to
companies via `company_members`. All business data (customers, products,
invoices, invoice_items) is scoped to a company and isolated with Row Level
Security based on membership.

## Tables
- companies: business/tenant record (name, currency, owner_id, contact info)
- company_members: maps users to companies with a role (owner/member)
- customers: company-scoped customer records
- products: company-scoped product/service catalog (price, tax_rate, unit, sku)
- invoices: company-scoped invoices (number, status, dates, totals)
- invoice_items: line items belonging to an invoice

## Security
- RLS enabled on all tables.
- Helper function user_company_ids() returns company IDs the current user belongs to.
- All business tables scoped by membership via the helper.
- companies: visible to members, editable by members, deletable by owner.
- company_members: visible to members of same company; insert self, delete by owner.

## Notes
1. Money columns use numeric(12,2).
2. Indexes on foreign keys and filter columns.
3. UNIQUE(company_id, number) on invoices for per-company invoice numbering.
*/

-- companies
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text,
  tax_number text,
  address text,
  phone text,
  email text,
  logo_url text,
  currency text NOT NULL DEFAULT 'USD',
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_companies_owner ON public.companies(owner_id);

-- company_members
CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);

-- customers
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_ar text,
  email text,
  phone text,
  address text,
  tax_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_customers_company ON public.customers(company_id);

-- products
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_ar text,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'piece',
  sku text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_products_company ON public.products(company_id);

-- invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, number)
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_invoices_company ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- invoice_items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- Helper: set of company ids the current user belongs to (defined after tables)
CREATE OR REPLACE FUNCTION public.user_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid();
$$;

-- companies policies
DROP POLICY IF EXISTS "select_own_companies" ON public.companies;
CREATE POLICY "select_own_companies" ON public.companies FOR SELECT
  TO authenticated USING (id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "insert_own_companies" ON public.companies;
CREATE POLICY "insert_own_companies" ON public.companies FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "update_own_companies" ON public.companies;
CREATE POLICY "update_own_companies" ON public.companies FOR UPDATE
  TO authenticated USING (id IN (SELECT public.user_company_ids()))
  WITH CHECK (id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "delete_own_companies" ON public.companies;
CREATE POLICY "delete_own_companies" ON public.companies FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- company_members policies
DROP POLICY IF EXISTS "select_own_memberships" ON public.company_members;
CREATE POLICY "select_own_memberships" ON public.company_members FOR SELECT
  TO authenticated USING (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "insert_own_memberships" ON public.company_members;
CREATE POLICY "insert_own_memberships" ON public.company_members FOR INSERT
  TO authenticated WITH CHECK (
    company_id IN (SELECT public.user_company_ids())
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "update_own_memberships" ON public.company_members;
CREATE POLICY "update_own_memberships" ON public.company_members FOR UPDATE
  TO authenticated USING (company_id IN (SELECT public.user_company_ids()))
  WITH CHECK (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "delete_own_memberships" ON public.company_members;
CREATE POLICY "delete_own_memberships" ON public.company_members FOR DELETE
  TO authenticated USING (
    company_id IN (SELECT public.user_company_ids() INTERSECT SELECT id FROM public.companies WHERE owner_id = auth.uid())
  );

-- customers policies
DROP POLICY IF EXISTS "select_own_customers" ON public.customers;
CREATE POLICY "select_own_customers" ON public.customers FOR SELECT
  TO authenticated USING (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "insert_own_customers" ON public.customers;
CREATE POLICY "insert_own_customers" ON public.customers FOR INSERT
  TO authenticated WITH CHECK (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "update_own_customers" ON public.customers;
CREATE POLICY "update_own_customers" ON public.customers FOR UPDATE
  TO authenticated USING (company_id IN (SELECT public.user_company_ids()))
  WITH CHECK (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "delete_own_customers" ON public.customers;
CREATE POLICY "delete_own_customers" ON public.customers FOR DELETE
  TO authenticated USING (company_id IN (SELECT public.user_company_ids()));

-- products policies
DROP POLICY IF EXISTS "select_own_products" ON public.products;
CREATE POLICY "select_own_products" ON public.products FOR SELECT
  TO authenticated USING (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "insert_own_products" ON public.products;
CREATE POLICY "insert_own_products" ON public.products FOR INSERT
  TO authenticated WITH CHECK (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "update_own_products" ON public.products;
CREATE POLICY "update_own_products" ON public.products FOR UPDATE
  TO authenticated USING (company_id IN (SELECT public.user_company_ids()))
  WITH CHECK (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "delete_own_products" ON public.products;
CREATE POLICY "delete_own_products" ON public.products FOR DELETE
  TO authenticated USING (company_id IN (SELECT public.user_company_ids()));

-- invoices policies
DROP POLICY IF EXISTS "select_own_invoices" ON public.invoices;
CREATE POLICY "select_own_invoices" ON public.invoices FOR SELECT
  TO authenticated USING (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "insert_own_invoices" ON public.invoices;
CREATE POLICY "insert_own_invoices" ON public.invoices FOR INSERT
  TO authenticated WITH CHECK (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "update_own_invoices" ON public.invoices;
CREATE POLICY "update_own_invoices" ON public.invoices FOR UPDATE
  TO authenticated USING (company_id IN (SELECT public.user_company_ids()))
  WITH CHECK (company_id IN (SELECT public.user_company_ids()));

DROP POLICY IF EXISTS "delete_own_invoices" ON public.invoices;
CREATE POLICY "delete_own_invoices" ON public.invoices FOR DELETE
  TO authenticated USING (company_id IN (SELECT public.user_company_ids()));

-- invoice_items policies
DROP POLICY IF EXISTS "select_own_invoice_items" ON public.invoice_items;
CREATE POLICY "select_own_invoice_items" ON public.invoice_items FOR SELECT
  TO authenticated USING (
    invoice_id IN (SELECT i.id FROM public.invoices i WHERE i.company_id IN (SELECT public.user_company_ids()))
  );

DROP POLICY IF EXISTS "insert_own_invoice_items" ON public.invoice_items;
CREATE POLICY "insert_own_invoice_items" ON public.invoice_items FOR INSERT
  TO authenticated WITH CHECK (
    invoice_id IN (SELECT i.id FROM public.invoices i WHERE i.company_id IN (SELECT public.user_company_ids()))
  );

DROP POLICY IF EXISTS "update_own_invoice_items" ON public.invoice_items;
CREATE POLICY "update_own_invoice_items" ON public.invoice_items FOR UPDATE
  TO authenticated USING (
    invoice_id IN (SELECT i.id FROM public.invoices i WHERE i.company_id IN (SELECT public.user_company_ids()))
  ) WITH CHECK (
    invoice_id IN (SELECT i.id FROM public.invoices i WHERE i.company_id IN (SELECT public.user_company_ids()))
  );

DROP POLICY IF EXISTS "delete_own_invoice_items" ON public.invoice_items;
CREATE POLICY "delete_own_invoice_items" ON public.invoice_items FOR DELETE
  TO authenticated USING (
    invoice_id IN (SELECT i.id FROM public.invoices i WHERE i.company_id IN (SELECT public.user_company_ids()))
  );
