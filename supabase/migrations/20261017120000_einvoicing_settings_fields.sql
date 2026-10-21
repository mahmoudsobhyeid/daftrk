-- E-Invoicing (ZATCA) Settings form fields
-- Adds the columns required by the redesigned "E-Invoicing Settings" tab.
-- Idempotent: safe to run multiple times.

-- ─────────────────────────────────────────────────
-- Company-level ZATCA configuration
-- ─────────────────────────────────────────────────
ALTER TABLE public.zatca_company_config
  ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.zatca_company_config
  ADD COLUMN IF NOT EXISTS common_name text;

ALTER TABLE public.zatca_company_config
  ADD COLUMN IF NOT EXISTS branch_name text;

ALTER TABLE public.zatca_company_config
  ADD COLUMN IF NOT EXISTS organization_name text;

ALTER TABLE public.zatca_company_config
  ADD COLUMN IF NOT EXISTS country_code text DEFAULT 'SA';

ALTER TABLE public.zatca_company_config
  ADD COLUMN IF NOT EXISTS business_category text;

-- ─────────────────────────────────────────────────
-- National address extras (E-Invoicing address details)
-- ─────────────────────────────────────────────────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS street_name text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS short_address text;
