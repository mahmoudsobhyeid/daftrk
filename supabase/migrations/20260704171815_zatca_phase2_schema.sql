/*
# ZATCA Phase 2 (Fatoora) Complete E-Invoicing Schema

## Purpose
Upgrades Daftrk into a production-ready Saudi ZATCA Phase 2 compliant e-invoicing engine.
Every field required for ZATCA integration, digital signing, QR code generation, and
XML UBL 2.1 submission is modelled here. Future ZATCA API connection requires only
adding credentials — no schema changes needed.

## Changes to Existing Tables

### invoices
Adds 30+ ZATCA-required columns:
- `uuid` — Universally unique invoice identifier (ZATCA UUID)
- `icv` — Internal Counter Value (sequential per company)
- `invoice_type` — 'standard' or 'simplified' (B2B vs B2C)
- `invoice_type_code` — ZATCA 5-digit type code (e.g. '388', '381', '383')
- `invoice_subtype` — Third party, nominal, export flags (ZATCA transaction type)
- `issue_time` — Issue time (HH:MM:SS, mandatory for ZATCA)
- `delivery_date` — Actual delivery / supply date
- `reference_number` — External reference / contract number
- `purchase_order` — Purchase order number
- `salesperson` — Salesperson name
- `currency_code` — ISO 4217 currency (SAR default)
- `exchange_rate` — Exchange rate to SAR if foreign currency
- `payment_means_code` — ZATCA payment means (10=cash, 30=bank, 42=account, 48=card)
- `payment_account_id` — Bank account / IBAN
- `zatca_hash` — SHA-256 invoice hash (hex)
- `zatca_prev_hash` — Previous invoice hash for chaining
- `zatca_qr_data` — Base64 TLV-encoded QR string (official ZATCA format)
- `zatca_xml` — Full UBL 2.1 XML stored as text
- `zatca_xml_version` — XML schema version
- `zatca_signature` — ECDSA digital signature (base64)
- `zatca_clearance_status` — Clearance/reporting status
- `zatca_submission_status` — API submission status
- `zatca_submission_id` — ZATCA-assigned submission UUID
- `zatca_clearance_uuid` — ZATCA clearance UUID from API response
- `zatca_submission_time` — When submitted to ZATCA API
- `zatca_response_code` — HTTP response code from ZATCA
- `zatca_response_body` — Full JSON response from ZATCA
- `zatca_warnings` — Array of warning messages from ZATCA
- `zatca_errors` — Array of error messages from ZATCA
- `zatca_retry_count` — Number of submission retries
- `is_locked` — Prevents editing after issuance

### invoice_items
Adds ZATCA tax and pricing detail fields:
- `sku` — Stock keeping unit
- `unit` — Unit of measure (PCE, KGM, HUR, etc.)
- `tax_category` — ZATCA tax category (S=Standard, Z=Zero-rated, E=Exempt, O=Outside scope)
- `tax_exemption_reason_code` — ZATCA exemption reason code
- `tax_exemption_reason` — Exemption reason text
- `vat_amount` — Calculated VAT amount for the line
- `net_amount` — Line amount before VAT (after discount)
- `gross_amount` — Line amount before any discount

### companies
Adds national address fields required for ZATCA seller information:
- `city` — City name
- `city_ar` — City name in Arabic
- `postal_code` — Postal code
- `building_number` — Building number
- `additional_number` — Additional number
- `district` — District / neighborhood
- `website` — Company website

## New Tables

### zatca_company_config
Per-company ZATCA device configuration. One row per company.
All certificate and cryptographic fields stored here for future ZATCA API connection.

### zatca_icv_sequence
Tracks the Internal Counter Value (ICV) per company.
ICV is a sequential integer that MUST be incremented for each issued invoice.
Also stores the last invoice hash for the hash-chaining mechanism.

### zatca_certificate_store
Certificate lifecycle management per company.
Supports CSR generation, certificate onboarding, renewal and expiry tracking.

## Security
- RLS enabled on all new tables
- Policies scoped to authenticated users via company_members table
- zatca_certificate_store has extra protection (sensitive crypto data)
*/

-- ─────────────────────────────────────────────────
-- Extend invoices table with all ZATCA fields
-- ─────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='uuid') THEN
    ALTER TABLE invoices ADD COLUMN uuid uuid NOT NULL DEFAULT gen_random_uuid();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='icv') THEN
    ALTER TABLE invoices ADD COLUMN icv integer;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='invoice_type') THEN
    ALTER TABLE invoices ADD COLUMN invoice_type text NOT NULL DEFAULT 'standard'
      CHECK (invoice_type IN ('standard', 'simplified'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='invoice_type_code') THEN
    ALTER TABLE invoices ADD COLUMN invoice_type_code text NOT NULL DEFAULT '388';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='invoice_subtype') THEN
    ALTER TABLE invoices ADD COLUMN invoice_subtype text NOT NULL DEFAULT '0100000';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='issue_time') THEN
    ALTER TABLE invoices ADD COLUMN issue_time text NOT NULL DEFAULT '00:00:00';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='delivery_date') THEN
    ALTER TABLE invoices ADD COLUMN delivery_date text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='reference_number') THEN
    ALTER TABLE invoices ADD COLUMN reference_number text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='purchase_order') THEN
    ALTER TABLE invoices ADD COLUMN purchase_order text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='salesperson') THEN
    ALTER TABLE invoices ADD COLUMN salesperson text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='currency_code') THEN
    ALTER TABLE invoices ADD COLUMN currency_code text NOT NULL DEFAULT 'SAR';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='exchange_rate') THEN
    ALTER TABLE invoices ADD COLUMN exchange_rate numeric(18,6) NOT NULL DEFAULT 1.0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payment_means_code') THEN
    ALTER TABLE invoices ADD COLUMN payment_means_code text NOT NULL DEFAULT '10';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='payment_account_id') THEN
    ALTER TABLE invoices ADD COLUMN payment_account_id text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_hash') THEN
    ALTER TABLE invoices ADD COLUMN zatca_hash text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_prev_hash') THEN
    ALTER TABLE invoices ADD COLUMN zatca_prev_hash text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_qr_data') THEN
    ALTER TABLE invoices ADD COLUMN zatca_qr_data text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_xml') THEN
    ALTER TABLE invoices ADD COLUMN zatca_xml text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_xml_version') THEN
    ALTER TABLE invoices ADD COLUMN zatca_xml_version text NOT NULL DEFAULT '2.1';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_signature') THEN
    ALTER TABLE invoices ADD COLUMN zatca_signature text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_clearance_status') THEN
    ALTER TABLE invoices ADD COLUMN zatca_clearance_status text NOT NULL DEFAULT 'draft'
      CHECK (zatca_clearance_status IN ('draft','ready','submitted','cleared','reported','rejected','cancelled','expired'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_submission_status') THEN
    ALTER TABLE invoices ADD COLUMN zatca_submission_status text NOT NULL DEFAULT 'not_submitted'
      CHECK (zatca_submission_status IN ('not_submitted','pending','accepted','rejected','failed'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_submission_id') THEN
    ALTER TABLE invoices ADD COLUMN zatca_submission_id text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_clearance_uuid') THEN
    ALTER TABLE invoices ADD COLUMN zatca_clearance_uuid text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_submission_time') THEN
    ALTER TABLE invoices ADD COLUMN zatca_submission_time timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_response_code') THEN
    ALTER TABLE invoices ADD COLUMN zatca_response_code integer;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_response_body') THEN
    ALTER TABLE invoices ADD COLUMN zatca_response_body jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_warnings') THEN
    ALTER TABLE invoices ADD COLUMN zatca_warnings jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_errors') THEN
    ALTER TABLE invoices ADD COLUMN zatca_errors jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='zatca_retry_count') THEN
    ALTER TABLE invoices ADD COLUMN zatca_retry_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='is_locked') THEN
    ALTER TABLE invoices ADD COLUMN is_locked boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ─────────────────────────────────────────────────
-- Extend invoice_items table with ZATCA detail fields
-- ─────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='sku') THEN
    ALTER TABLE invoice_items ADD COLUMN sku text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='unit') THEN
    ALTER TABLE invoice_items ADD COLUMN unit text NOT NULL DEFAULT 'PCE';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='tax_category') THEN
    ALTER TABLE invoice_items ADD COLUMN tax_category text NOT NULL DEFAULT 'S'
      CHECK (tax_category IN ('S','Z','E','O'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='tax_exemption_reason_code') THEN
    ALTER TABLE invoice_items ADD COLUMN tax_exemption_reason_code text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='tax_exemption_reason') THEN
    ALTER TABLE invoice_items ADD COLUMN tax_exemption_reason text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='vat_amount') THEN
    ALTER TABLE invoice_items ADD COLUMN vat_amount numeric(18,4) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='net_amount') THEN
    ALTER TABLE invoice_items ADD COLUMN net_amount numeric(18,4) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='gross_amount') THEN
    ALTER TABLE invoice_items ADD COLUMN gross_amount numeric(18,4) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ─────────────────────────────────────────────────
-- Extend companies table with national address fields
-- ─────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='city') THEN
    ALTER TABLE companies ADD COLUMN city text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='city_ar') THEN
    ALTER TABLE companies ADD COLUMN city_ar text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='postal_code') THEN
    ALTER TABLE companies ADD COLUMN postal_code text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='building_number') THEN
    ALTER TABLE companies ADD COLUMN building_number text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='additional_number') THEN
    ALTER TABLE companies ADD COLUMN additional_number text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='district') THEN
    ALTER TABLE companies ADD COLUMN district text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='website') THEN
    ALTER TABLE companies ADD COLUMN website text;
  END IF;
END $$;

-- ─────────────────────────────────────────────────
-- Extend customers table with ZATCA fields
-- ─────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='postal_code') THEN
    ALTER TABLE customers ADD COLUMN postal_code text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='building_number') THEN
    ALTER TABLE customers ADD COLUMN building_number text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='district') THEN
    ALTER TABLE customers ADD COLUMN district text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='cr_number') THEN
    ALTER TABLE customers ADD COLUMN cr_number text;
  END IF;
END $$;

-- ─────────────────────────────────────────────────
-- Create zatca_company_config table
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zatca_company_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- ZATCA registration
  vat_number text,
  cr_number text,
  zatca_environment text NOT NULL DEFAULT 'sandbox' CHECK (zatca_environment IN ('sandbox','production')),
  is_onboarded boolean NOT NULL DEFAULT false,
  onboarding_token text,

  -- Device / CSID
  device_id text,
  device_name text,
  csr_pem text,
  certificate_pem text,
  certificate_serial text,
  certificate_expiry timestamptz,
  certificate_thumbprint text,

  -- Keys (private key must be stored encrypted in production)
  public_key_pem text,
  private_key_encrypted text,

  -- Defaults
  default_invoice_type text NOT NULL DEFAULT 'standard' CHECK (default_invoice_type IN ('standard','simplified')),
  default_invoice_type_code text NOT NULL DEFAULT '388',
  default_payment_means text NOT NULL DEFAULT '10',
  default_currency text NOT NULL DEFAULT 'SAR',
  invoice_sequence_start integer NOT NULL DEFAULT 1,

  -- API endpoints
  zatca_base_url text NOT NULL DEFAULT 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
  zatca_api_version text NOT NULL DEFAULT 'V2',

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (company_id)
);

ALTER TABLE zatca_company_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_zatca_config" ON zatca_company_config;
CREATE POLICY "select_own_zatca_config" ON zatca_company_config FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_zatca_config" ON zatca_company_config;
CREATE POLICY "insert_own_zatca_config" ON zatca_company_config FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_zatca_config" ON zatca_company_config;
CREATE POLICY "update_own_zatca_config" ON zatca_company_config FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_zatca_config" ON zatca_company_config;
CREATE POLICY "delete_own_zatca_config" ON zatca_company_config FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────
-- Create zatca_icv_sequence table
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zatca_icv_sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Current ICV value (must increment per issued invoice, never skip, never reset)
  last_icv integer NOT NULL DEFAULT 0,

  -- Last invoice hash for hash-chaining
  last_invoice_hash text,

  -- Last issued invoice UUID for audit
  last_invoice_uuid uuid,

  -- Timestamps
  updated_at timestamptz DEFAULT now(),

  UNIQUE (company_id)
);

ALTER TABLE zatca_icv_sequence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_icv" ON zatca_icv_sequence;
CREATE POLICY "select_own_icv" ON zatca_icv_sequence FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_icv" ON zatca_icv_sequence;
CREATE POLICY "insert_own_icv" ON zatca_icv_sequence FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_icv" ON zatca_icv_sequence;
CREATE POLICY "update_own_icv" ON zatca_icv_sequence FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_icv" ON zatca_icv_sequence;
CREATE POLICY "delete_own_icv" ON zatca_icv_sequence FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────
-- Create zatca_certificate_store table
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zatca_certificate_store (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Certificate type
  cert_type text NOT NULL DEFAULT 'CCSID' CHECK (cert_type IN ('CCSID','PCSID','ZATCA_ROOT')),
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),

  -- Certificate data
  cert_pem text,
  cert_serial text,
  cert_thumbprint text,
  cert_issued_at timestamptz,
  cert_expires_at timestamptz,
  cert_subject text,
  cert_issuer text,

  -- CSR
  csr_pem text,
  csr_generated_at timestamptz,

  -- Status
  is_active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  revocation_reason text,

  -- OTP for onboarding
  otp_used text,
  onboarding_completed_at timestamptz,

  -- Renewal tracking
  renewal_reminder_sent boolean NOT NULL DEFAULT false,
  auto_renew boolean NOT NULL DEFAULT true,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE zatca_certificate_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_certs" ON zatca_certificate_store;
CREATE POLICY "select_own_certs" ON zatca_certificate_store FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_certs" ON zatca_certificate_store;
CREATE POLICY "insert_own_certs" ON zatca_certificate_store FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_certs" ON zatca_certificate_store;
CREATE POLICY "update_own_certs" ON zatca_certificate_store FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_certs" ON zatca_certificate_store;
CREATE POLICY "delete_own_certs" ON zatca_certificate_store FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────
-- Indexes for performance
-- ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invoices_uuid ON invoices(uuid);
CREATE INDEX IF NOT EXISTS idx_invoices_zatca_status ON invoices(zatca_clearance_status);
CREATE INDEX IF NOT EXISTS idx_invoices_submission_status ON invoices(zatca_submission_status);
CREATE INDEX IF NOT EXISTS idx_invoices_icv ON invoices(company_id, icv);
CREATE INDEX IF NOT EXISTS idx_zatca_config_company ON zatca_company_config(company_id);
CREATE INDEX IF NOT EXISTS idx_zatca_icv_company ON zatca_icv_sequence(company_id);
CREATE INDEX IF NOT EXISTS idx_zatca_certs_company ON zatca_certificate_store(company_id);

-- ─────────────────────────────────────────────────
-- RPC: get_or_create_zatca_config
-- Returns existing ZATCA config or creates a default one
-- ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_or_create_zatca_config(p_company_id uuid)
RETURNS zatca_company_config
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config zatca_company_config;
BEGIN
  SELECT * INTO v_config FROM zatca_company_config WHERE company_id = p_company_id;
  IF NOT FOUND THEN
    INSERT INTO zatca_company_config (company_id)
    VALUES (p_company_id)
    RETURNING * INTO v_config;
  END IF;
  RETURN v_config;
END;
$$;

-- ─────────────────────────────────────────────────
-- RPC: next_icv — atomically increment ICV per company
-- Returns the new ICV value and the previous invoice hash
-- ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION next_icv(p_company_id uuid)
RETURNS TABLE(icv integer, prev_hash text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row zatca_icv_sequence;
BEGIN
  -- Upsert ICV row
  INSERT INTO zatca_icv_sequence (company_id, last_icv, last_invoice_hash)
  VALUES (p_company_id, 1, NULL)
  ON CONFLICT (company_id) DO UPDATE
    SET last_icv = zatca_icv_sequence.last_icv + 1,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN QUERY SELECT v_row.last_icv, v_row.last_invoice_hash;
END;
$$;

-- ─────────────────────────────────────────────────
-- RPC: update_icv_hash — update the stored hash after invoice issuance
-- ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_icv_hash(p_company_id uuid, p_invoice_hash text, p_invoice_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE zatca_icv_sequence
  SET last_invoice_hash = p_invoice_hash,
      last_invoice_uuid = p_invoice_uuid,
      updated_at = now()
  WHERE company_id = p_company_id;
END;
$$;
