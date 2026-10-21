/*
# Extend Leases for Saudi Ejar Compliance

## Overview
Extends the existing `leases` table with fields required by Saudi Ejar (rental regulations)
and adds a new `lease_installments` table for tracking individual rent payment installments.

## Changes to `leases` table
- `contract_number` (text) — official Ejar contract reference number
- `lessor_name` (text) — property owner / landlord name (المالك)
- `lessor_phone` (text) — landlord contact phone
- `lessor_id_number` (text) — landlord national ID or commercial registration
- `tenant_id_number` (text) — tenant national ID or Iqama number
- `tenant_email` (text) — tenant email address
- `maintenance_responsibility` (text) — who covers maintenance: 'landlord', 'tenant', 'shared'
- `security_deposit` (numeric) — refundable security deposit amount
- `status` (text) — contract status: 'draft', 'active', 'expired', 'terminated'
- `notes` (text) — additional contract terms/notes

## New table: `lease_installments`
Tracks individual rent payment installments for each lease.
- `id` (uuid, primary key)
- `lease_id` (uuid, FK to leases)
- `installment_number` (int) — sequence number
- `due_date` (date) — when payment is due
- `amount` (numeric) — installment amount
- `status` (text) — 'pending', 'paid', 'overdue'
- `paid_date` (date) — when actually paid
- `created_at` (timestamp)

## Security
- RLS enabled on `lease_installments` with owner-scoped CRUD via `user_company_ids()`
- All existing lease policies remain unchanged
*/

-- Extend leases table with Ejar-compliant fields
ALTER TABLE leases ADD COLUMN IF NOT EXISTS contract_number text;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS lessor_name text;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS lessor_phone text;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS lessor_id_number text;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS tenant_id_number text;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS tenant_email text;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS maintenance_responsibility text NOT NULL DEFAULT 'landlord'
  CHECK (maintenance_responsibility IN ('landlord', 'tenant', 'shared'));
ALTER TABLE leases ADD COLUMN IF NOT EXISTS security_deposit numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'active', 'expired', 'terminated'));
ALTER TABLE leases ADD COLUMN IF NOT EXISTS notes text;

-- Lease installments table
CREATE TABLE IF NOT EXISTS lease_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  installment_number int NOT NULL,
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  paid_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lease_installments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lease_installments_lease ON lease_installments(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_installments_status ON lease_installments(status);

DROP POLICY IF EXISTS "select_own_lease_installments" ON lease_installments;
CREATE POLICY "select_own_lease_installments" ON lease_installments FOR SELECT
  TO authenticated USING (
    lease_id IN (
      SELECT l.id FROM leases l WHERE l.tenant_id IN (SELECT public.user_company_ids())
    )
  );
DROP POLICY IF EXISTS "insert_own_lease_installments" ON lease_installments;
CREATE POLICY "insert_own_lease_installments" ON lease_installments FOR INSERT
  TO authenticated WITH CHECK (
    lease_id IN (
      SELECT l.id FROM leases l WHERE l.tenant_id IN (SELECT public.user_company_ids())
    )
  );
DROP POLICY IF EXISTS "update_own_lease_installments" ON lease_installments;
CREATE POLICY "update_own_lease_installments" ON lease_installments FOR UPDATE
  TO authenticated USING (
    lease_id IN (
      SELECT l.id FROM leases l WHERE l.tenant_id IN (SELECT public.user_company_ids())
    )
  ) WITH CHECK (
    lease_id IN (
      SELECT l.id FROM leases l WHERE l.tenant_id IN (SELECT public.user_company_ids())
    )
  );
DROP POLICY IF EXISTS "delete_own_lease_installments" ON lease_installments;
CREATE POLICY "delete_own_lease_installments" ON lease_installments FOR DELETE
  TO authenticated USING (
    lease_id IN (
      SELECT l.id FROM leases l WHERE l.tenant_id IN (SELECT public.user_company_ids())
    )
  );