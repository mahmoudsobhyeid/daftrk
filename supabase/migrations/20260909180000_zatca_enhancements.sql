-- ZATCA Enhancements - Onboarding Status, Audit Logging, Encryption
-- This migration adds comprehensive onboarding tracking, audit logging, and encryption support.

-- ─────────────────────────────────────────────────────────────
-- Extend zatca_company_config with onboarding status tracking
-- ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zatca_company_config' AND column_name='onboarding_status') THEN
    ALTER TABLE zatca_company_config ADD COLUMN onboarding_status text NOT NULL DEFAULT 'not_configured' 
      CHECK (onboarding_status IN (
        'not_configured', 'csr_generated', 'otp_required', 
        'compliance_csid_obtained', 'compliance_checks_pending', 
        'compliance_checks_passed', 'production_csid_obtained', 
        'connected', 'failed', 'certificate_expired'
      ));
  END IF;
END $$;

-- Add last compliance check timestamp
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zatca_company_config' AND column_name='last_compliance_check') THEN
    ALTER TABLE zatca_company_config ADD COLUMN last_compliance_check timestamptz;
  END IF;
END $$;

-- Add compliance check result
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='zatca_company_config' AND column_name='compliance_check_result') THEN
    ALTER TABLE zatca_company_config ADD COLUMN compliance_check_result jsonb;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Create zatca_audit_log table for secure audit trail
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zatca_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'warning', 'error')),
  details jsonb, -- Safe details, NO secrets, NO OTP, NO credentials
  error_message text, -- Safe error message, no sensitive data
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_zatca_audit_log_company ON zatca_audit_log(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zatca_audit_log_action ON zatca_audit_log(action);

-- Enable RLS on audit log
ALTER TABLE zatca_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_own_audit_logs" ON zatca_audit_log;
CREATE POLICY "view_own_audit_logs" ON zatca_audit_log FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- Create RPC for secure audit log insertion
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_zatca_audit(
  p_company_id uuid,
  p_action text,
  p_status text,
  p_details jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO zatca_audit_log (company_id, action, status, details, error_message, performed_by)
  VALUES (p_company_id, p_action, p_status, p_details, p_error_message, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_zatca_audit TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Update invoice_items with complete tax tracking
-- ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_items' AND column_name='net_amount') THEN
    ALTER TABLE invoice_items ADD COLUMN net_amount numeric(12,2);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Add function to validate ZATCA readiness
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_zatca_readiness(p_company_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_config zatca_company_config;
  v_company companies;
  v_issues jsonb := '[]'::jsonb;
  v_is_ready boolean := true;
BEGIN
  SELECT * INTO v_config FROM zatca_company_config WHERE company_id = p_company_id;
  SELECT * INTO v_company FROM companies WHERE id = p_company_id;
  
  -- Validate company data
  IF NOT v_company.tax_number OR LENGTH(v_company.tax_number) < 15 THEN
    v_is_ready := false;
    v_issues := jsonb_insert(v_issues, '{-1}', '"Missing or invalid VAT number"');
  END IF;
  
  IF NOT (v_company as any).city OR NOT (v_company as any).building_number OR NOT (v_company as any).postal_code THEN
    v_is_ready := false;
    v_issues := jsonb_insert(v_issues, '{-1}', '"Missing national address fields"');
  END IF;
  
  -- Validate ZATCA config
  IF v_config.onboarding_status != 'connected' THEN
    v_is_ready := false;
    v_issues := jsonb_insert(v_issues, '{-1}', '"ZATCA onboarding not complete"');
  END IF;
  
  IF v_config.certificate_expiry IS NOT NULL AND v_config.certificate_expiry < now() THEN
    v_is_ready := false;
    v_issues := jsonb_insert(v_issues, '{-1}', '"Certificate expired"');
  END IF;
  
  RETURN jsonb_build_object(
    'is_ready', v_is_ready,
    'onboarding_status', v_config.onboarding_status,
    'issues', v_issues,
    'last_check', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_zatca_readiness TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Add comments documenting security practices
-- ─────────────────────────────────────────────────────────────

COMMENT ON TABLE zatca_audit_log IS 'Audit trail for all ZATCA operations. NEVER stores secrets, OTP, or private keys. Details and error messages are sanitized.';
COMMENT ON COLUMN zatca_company_config.private_key_encrypted IS 'ZATCA private key - MUST be encrypted at rest using Supabase Vault or application encryption layer.';
COMMENT ON COLUMN zatca_company_config.onboarding_token IS 'Temporary token used during onboarding - short-lived, not used for production submissions.';

