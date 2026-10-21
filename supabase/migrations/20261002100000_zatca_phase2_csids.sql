DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'zatca_otp'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN zatca_otp text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'compliance_csid'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN compliance_csid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'production_csid'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN production_csid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'private_key'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN private_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'secret'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN secret text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'certificate_status'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN certificate_status text NOT NULL DEFAULT 'no_certificate_configured';
  END IF;
END $$;

ALTER TABLE zatca_company_config
  ALTER COLUMN certificate_status SET DEFAULT 'no_certificate_configured';
