/*
# Simplified ZATCA OTP-Based Onboarding Schema

This migration simplifies the ZATCA onboarding process to use only:
- Commercial Registration Number (CR Number)
- VAT Registration Number (15-digit Tax Number)
- National Address Details (already in companies table)
- ZATCA OTP (short-lived, never stored permanently)

The system will automatically:
1. Generate ECDSA private key and CSR on the fly
2. Exchange OTP for CSID via ZATCA Compliance API
3. Run compliance checks automatically
4. Obtain Production CSID
5. Store credentials securely
*/

-- Simplify zatca_company_config to focus on automated OTP onboarding
DO $$
BEGIN
  -- Remove unnecessary fields that will be generated automatically
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'csr_pem'
  ) THEN
    ALTER TABLE zatca_company_config DROP COLUMN IF EXISTS csr_pem;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'onboarding_token'
  ) THEN
    ALTER TABLE zatca_company_config DROP COLUMN IF EXISTS onboarding_token;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE zatca_company_config DROP COLUMN IF EXISTS device_id;
  END IF;

  -- Add OTP field (temporary, cleared after onboarding)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'zatca_otp'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN zatca_otp text;
  END IF;

  -- Add onboarding status tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'onboarding_status'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN onboarding_status text
      NOT NULL DEFAULT 'not_configured'
      CHECK (onboarding_status IN (
        'not_configured',
        'otp_submitted',
        'compliance_csid_obtained',
        'compliance_checks_running',
        'compliance_checks_passed',
        'production_csid_obtained',
        'connected',
        'failed'
      ));
  END IF;

  -- Add certificate status for monitoring
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'certificate_status'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN certificate_status text
      NOT NULL DEFAULT 'no_certificate'
      CHECK (certificate_status IN (
        'no_certificate',
        'compliance_certificate',
        'production_certificate',
        'certificate_expired',
        'certificate_revoked'
      ));
  END IF;

  -- Ensure CSID fields exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'compliance_csid'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN compliance_csid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'production_csid'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN production_csid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'secret'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN secret text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'private_key'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN private_key text;
  END IF;

  -- Add certificate metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'certificate_pem'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN certificate_pem text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'certificate_expiry'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN certificate_expiry timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'certificate_serial'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN certificate_serial text;
  END IF;

  -- Add public key for QR code generation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'public_key_pem'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN public_key_pem text;
  END IF;

  -- Add last error message for troubleshooting
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'last_error'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN last_error text;
  END IF;

  -- Add last sync timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zatca_company_config' AND column_name = 'last_sync_at'
  ) THEN
    ALTER TABLE zatca_company_config ADD COLUMN last_sync_at timestamptz;
  END IF;

END $$;

-- Create index for quick status lookups
CREATE INDEX IF NOT EXISTS idx_zatca_config_status
ON zatca_company_config (onboarding_status, certificate_status);

-- Create index for expiry monitoring
CREATE INDEX IF NOT EXISTS idx_zatca_config_expiry
ON zatca_company_config (certificate_expiry)
WHERE certificate_expiry IS NOT NULL;

-- Drop the redundant zatca_certificate_status table if it exists
DROP TABLE IF EXISTS public.zatca_certificate_status;

-- Function to clear OTP after successful onboarding (security)
CREATE OR REPLACE FUNCTION clear_zatca_otp()
RETURNS TRIGGER AS $$
BEGIN
  -- Clear OTP when status reaches 'connected'
  IF NEW.onboarding_status = 'connected' AND OLD.onboarding_status != 'connected' THEN
    NEW.zatca_otp := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically clear OTP
DROP TRIGGER IF EXISTS trg_clear_zatca_otp ON zatca_company_config;
CREATE TRIGGER trg_clear_zatca_otp
  BEFORE UPDATE ON zatca_company_config
  FOR EACH ROW
  EXECUTE FUNCTION clear_zatca_otp();

-- Function to update last_sync_at on successful sync
CREATE OR REPLACE FUNCTION update_zatca_sync_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.onboarding_status = 'connected' AND (
    NEW.production_csid IS DISTINCT FROM OLD.production_csid OR
    NEW.certificate_pem IS DISTINCT FROM OLD.certificate_pem
  ) THEN
    NEW.last_sync_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_zatca_sync ON zatca_company_config;
CREATE TRIGGER trg_update_zatca_sync
  BEFORE UPDATE ON zatca_company_config
  FOR EACH ROW
  EXECUTE FUNCTION update_zatca_sync_timestamp();

COMMENT ON TABLE zatca_company_config IS 'Simplified ZATCA configuration with automated OTP-based onboarding. Only CR number, VAT number, and National Address are required from the user. The system automatically handles CSR generation, CSID exchange, compliance checks, and certificate management.';
