
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

INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_company_logos" ON storage.objects;
CREATE POLICY "public_read_company_logos" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'company-logos');

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
