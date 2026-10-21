DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zatca_company_config' AND column_name = 'compliance_csid'
  ) THEN
    ALTER TABLE public.zatca_company_config ADD COLUMN compliance_csid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zatca_company_config' AND column_name = 'production_csid'
  ) THEN
    ALTER TABLE public.zatca_company_config ADD COLUMN production_csid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zatca_company_config' AND column_name = 'private_key'
  ) THEN
    ALTER TABLE public.zatca_company_config ADD COLUMN private_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zatca_company_config' AND column_name = 'zatca_environment'
  ) THEN
    ALTER TABLE public.zatca_company_config ADD COLUMN zatca_environment text NOT NULL DEFAULT 'sandbox';
  ELSE
    ALTER TABLE public.zatca_company_config ALTER COLUMN zatca_environment SET DEFAULT 'sandbox';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zatca_company_config' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.zatca_company_config ADD COLUMN status text NOT NULL DEFAULT 'pending';
  ELSE
    ALTER TABLE public.zatca_company_config ALTER COLUMN status SET DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zatca_company_config' AND column_name = 'secret'
  ) THEN
    ALTER TABLE public.zatca_company_config ADD COLUMN secret text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.zatca_certificate_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  vat_number text,
  cr_number text,
  compliance_csid text,
  production_csid text,
  private_key text,
  secret text,
  zatca_environment text NOT NULL DEFAULT 'sandbox',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zatca_certificate_status_company
ON public.zatca_certificate_status (company_id);

UPDATE public.zatca_company_config
SET zatca_environment = COALESCE(zatca_environment, 'sandbox'),
    status = COALESCE(status, 'pending')
WHERE zatca_environment IS NULL OR status IS NULL;
