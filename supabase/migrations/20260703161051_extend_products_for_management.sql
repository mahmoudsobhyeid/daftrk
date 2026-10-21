
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'barcode') THEN
    ALTER TABLE public.products ADD COLUMN barcode text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'category') THEN
    ALTER TABLE public.products ADD COLUMN category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'cost') THEN
    ALTER TABLE public.products ADD COLUMN cost numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'stock_quantity') THEN
    ALTER TABLE public.products ADD COLUMN stock_quantity numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'min_stock') THEN
    ALTER TABLE public.products ADD COLUMN min_stock numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_path') THEN
    ALTER TABLE public.products ADD COLUMN image_path text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'status') THEN
    ALTER TABLE public.products ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_stock ON public.products(stock_quantity);

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
CREATE POLICY "public_read_product_images" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "owner_insert_product_images" ON storage.objects;
CREATE POLICY "owner_insert_product_images" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id::text = (storage.foldername(name))[1]
      AND p.company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "owner_update_product_images" ON storage.objects;
CREATE POLICY "owner_update_product_images" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id::text = (storage.foldername(name))[1]
      AND p.company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "owner_delete_product_images" ON storage.objects;
CREATE POLICY "owner_delete_product_images" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id::text = (storage.foldername(name))[1]
      AND p.company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    )
  );
