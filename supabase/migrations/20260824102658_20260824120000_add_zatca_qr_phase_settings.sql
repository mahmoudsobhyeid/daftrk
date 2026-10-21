/*
# Add ZATCA QR phase settings

1. Purpose
- Adds company-level controls for selecting ZATCA Phase 1 or Phase 2 QR behavior.
- Stores the seller name used in QR tag 1 and non-secret certificate/key placeholders for configuration readiness.

2. Modified Tables
- `zatca_company_config`
- Adds `qr_phase` (`phase1` or `phase2`), selecting the QR payload mode.
- Adds `seller_name`, allowing the registered seller name to differ from the display company name.
- Adds `certificate_placeholder`, a non-secret configuration note or certificate reference shown in settings.

3. Security
- Existing row-level security and company-member policies remain in force.
- No new table or privilege is introduced.

4. Important Notes
- Phase 1 contains the five mandatory seller, VAT, timestamp, total, and VAT TLV fields.
- Phase 2 enables the extended payload path when cryptographic material is available; a placeholder alone does not create a valid ZATCA digital signature.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zatca_company_config' AND column_name = 'qr_phase'
  ) THEN
    ALTER TABLE public.zatca_company_config
      ADD COLUMN qr_phase text NOT NULL DEFAULT 'phase1'
      CHECK (qr_phase IN ('phase1', 'phase2'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zatca_company_config' AND column_name = 'seller_name'
  ) THEN
    ALTER TABLE public.zatca_company_config ADD COLUMN seller_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zatca_company_config' AND column_name = 'certificate_placeholder'
  ) THEN
    ALTER TABLE public.zatca_company_config ADD COLUMN certificate_placeholder text;
  END IF;
END $$;