/*
# Real Estate ERP — Step 2: Team, Property, Lease, and Invoice Schema

1. New Tables
- `team_members`: id, tenant_id (FK companies), user_id (FK auth.users), role ('owner'|'admin'|'agent'), created_at
- `properties`: id, tenant_id, name, type ('building'|'apartment'|'commercial'), address
- `units`: id, tenant_id, property_id (FK properties), unit_number, rent_amount (numeric), status ('vacant'|'rented')
- `leases`: id, tenant_id, unit_id (FK units), tenant_name, tenant_phone, start_date, end_date, rent_amount, payment_frequency
- `re_invoices`: id, tenant_id, lease_id (FK leases), invoice_number, issue_date, due_date, subtotal, vat_amount (15%), total_amount, status, qr_code_data

2. Security
- RLS enabled on all tables with tenant isolation via user_company_ids().
- team_members: same-tenant read; owner/admin insert/update/delete.
- properties/units/leases/re_invoices: tenant members CRUD their own rows.

3. Notes
- tenant_id references companies(id), reusing existing multi-tenant structure.
- re_invoices is separate from existing invoices table to avoid conflicts.
*/

-- team_members
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('owner','admin','agent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_team_members_tenant ON team_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

DROP POLICY IF EXISTS "select_own_team" ON team_members;
CREATE POLICY "select_own_team" ON team_members FOR SELECT
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "insert_own_team" ON team_members;
CREATE POLICY "insert_own_team" ON team_members FOR INSERT
  TO authenticated WITH CHECK (
    tenant_id IN (SELECT public.user_company_ids())
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.tenant_id = team_members.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner','admin')
    )
  );
DROP POLICY IF EXISTS "update_own_team" ON team_members;
CREATE POLICY "update_own_team" ON team_members FOR UPDATE
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "delete_own_team" ON team_members;
CREATE POLICY "delete_own_team" ON team_members FOR DELETE
  TO authenticated USING (
    tenant_id IN (SELECT public.user_company_ids())
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.tenant_id = team_members.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner','admin')
    )
  );

-- properties
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'building' CHECK (type IN ('building','apartment','commercial')),
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);

DROP POLICY IF EXISTS "select_own_properties_re" ON properties;
CREATE POLICY "select_own_properties_re" ON properties FOR SELECT
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "insert_own_properties_re" ON properties;
CREATE POLICY "insert_own_properties_re" ON properties FOR INSERT
  TO authenticated WITH CHECK (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "update_own_properties_re" ON properties;
CREATE POLICY "update_own_properties_re" ON properties FOR UPDATE
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "delete_own_properties_re" ON properties;
CREATE POLICY "delete_own_properties_re" ON properties FOR DELETE
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()));

-- units
CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_number text NOT NULL,
  rent_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant','rented')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_units_tenant ON units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_property ON units(property_id);

DROP POLICY IF EXISTS "select_own_units_re" ON units;
CREATE POLICY "select_own_units_re" ON units FOR SELECT
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "insert_own_units_re" ON units;
CREATE POLICY "insert_own_units_re" ON units FOR INSERT
  TO authenticated WITH CHECK (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "update_own_units_re" ON units;
CREATE POLICY "update_own_units_re" ON units FOR UPDATE
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "delete_own_units_re" ON units;
CREATE POLICY "delete_own_units_re" ON units FOR DELETE
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()));

-- leases
CREATE TABLE IF NOT EXISTS leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  tenant_name text NOT NULL,
  tenant_phone text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT CURRENT_DATE,
  rent_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_frequency text NOT NULL DEFAULT 'monthly' CHECK (payment_frequency IN ('monthly','quarterly','yearly')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_leases_tenant ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_unit ON leases(unit_id);

DROP POLICY IF EXISTS "select_own_leases_re" ON leases;
CREATE POLICY "select_own_leases_re" ON leases FOR SELECT
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "insert_own_leases_re" ON leases;
CREATE POLICY "insert_own_leases_re" ON leases FOR INSERT
  TO authenticated WITH CHECK (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "update_own_leases_re" ON leases;
CREATE POLICY "update_own_leases_re" ON leases FOR UPDATE
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "delete_own_leases_re" ON leases;
CREATE POLICY "delete_own_leases_re" ON leases FOR DELETE
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()));

-- re_invoices
CREATE TABLE IF NOT EXISTS re_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lease_id uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid','unpaid','overdue')),
  qr_code_data text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, invoice_number)
);
ALTER TABLE re_invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_re_invoices_tenant ON re_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_invoices_lease ON re_invoices(lease_id);
CREATE INDEX IF NOT EXISTS idx_re_invoices_status ON re_invoices(status);

DROP POLICY IF EXISTS "select_own_re_invoices" ON re_invoices;
CREATE POLICY "select_own_re_invoices" ON re_invoices FOR SELECT
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "insert_own_re_invoices" ON re_invoices;
CREATE POLICY "insert_own_re_invoices" ON re_invoices FOR INSERT
  TO authenticated WITH CHECK (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "update_own_re_invoices" ON re_invoices;
CREATE POLICY "update_own_re_invoices" ON re_invoices FOR UPDATE
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()))
  WITH CHECK (tenant_id IN (SELECT public.user_company_ids()));
DROP POLICY IF EXISTS "delete_own_re_invoices" ON re_invoices;
CREATE POLICY "delete_own_re_invoices" ON re_invoices FOR DELETE
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()));