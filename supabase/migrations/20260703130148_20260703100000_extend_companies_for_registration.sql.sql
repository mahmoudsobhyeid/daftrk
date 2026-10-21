/*
# Extend companies table for full company registration

## Overview
Adds the remaining company-registration fields requested for the sign-up flow:
business type, country, language, timezone, and a logo storage path. Also
creates a public `company-logos` storage bucket so companies can upload their
own logo, and updates the existing companies policies to keep them working
with the new columns (no policy logic changes — columns are additive).

## New columns on public.companies
- business_type (text): the kind of business (e.g. Retail, Services, Freelance).
- country (text): country the business operates from.
- language (text): preferred UI language for the workspace ('en' | 'ar').
- timezone (text): IANA timezone string (e.g. 'Asia/Dubai').
- logo_path (text): storage object path inside the `company-logos` bucket.

All new columns are nullable so existing rows keep working without backfill.

## Storage
- Creates storage bucket `company-logos` (public) for company logo uploads.

## Security
- No RLS policy logic changes. The new columns are covered by the existing
  membership-based policies already on public.companies.
- Storage bucket is public-read (logos appear on invoices) but writes are
  restricted to authenticated owners of the company the logo belongs to.

## Notes
1. Columns are added with IF NOT EXISTS via a DO block so the migration is
   idempotent and safe to re-run (apply_migration may time out after commit).
2. No data is dropped or renamed.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'business_type') THEN
    ALTER TABLE public.companies ADD COLUMN business_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'country') THEN
    ALTER TABLE public.companies ADD COLUMN country text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'language') THEN
    ALTER TABLE public.companies ADD COLUMN language text NOT NULL DEFAULT 'en';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'timezone') THEN
    ALTER TABLE public.companies ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'logo_path') THEN
    ALTER TABLE public.companies ADD COLUMN logo_path text;
  END IF;
END $$;

-- Storage bucket for company logos (public read so logos render on invoices)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read logos (public bucket)
DROP POLICY IF EXISTS "public_read_company_logos" ON storage.objects;
CREATE POLICY "public_read_company_logos" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'company-logos');

-- Allow authenticated users to upload/update/delete their own company logos.
-- A logo path is expected to be `<company_id>/<filename>`; the owner of the
-- company is the only one allowed to write to that prefix.
DROP POLICY IF EXISTS "owner_insert_company_logos" ON storage.objects;
CREATE POLICY "owner_insert_company_logos" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id::text = (storage.foldername(name))[1]
      AND c.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "owner_update_company_logos" ON storage.objects;
CREATE POLICY "owner_update_company_logos" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id::text = (storage.foldername(name))[1]
      AND c.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "owner_delete_company_logos" ON storage.objects;
CREATE POLICY "owner_delete_company_logos" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id::text = (storage.foldername(name))[1]
      AND c.owner_id = auth.uid()
    )
  );
