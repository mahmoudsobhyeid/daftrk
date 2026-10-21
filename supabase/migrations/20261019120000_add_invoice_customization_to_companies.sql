-- Add invoice_customization jsonb column to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS invoice_customization jsonb DEFAULT '{}'::jsonb;
