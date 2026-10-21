/*
# Extend products table for full product/inventory management

## Overview
Adds barcode, category, cost, stock_quantity, min_stock, image_path, and
status columns to the products table to support the full product-management
feature set including inventory tracking and stock alerts.

## New columns on public.products
- barcode (text): product barcode (EAN/UPC/etc).
- category (text): product category for grouping/filtering.
- cost (numeric): cost price per unit (for margin calculation).
- stock_quantity (numeric): current stock on hand.
- min_stock (numeric): minimum stock threshold for low-stock alerts.
- image_path (text): storage object path inside the `product-images` bucket.
- status (text): 'active' | 'inactive', defaults to 'active'.

All columns are nullable (except status which has a default) so existing
rows keep working without backfill.

## Storage
- Creates storage bucket `product-images` (public) for product image uploads.

## Security
- No RLS policy logic changes to public.products. New columns are covered by
  the existing membership-based policies.
- Storage bucket is public-read (images appear on invoices/catalog) but
  writes are restricted to authenticated owners of the company the product
  belongs to.

## Notes
1. Columns are added with IF NOT EXISTS via a DO block for idempotency.
2. No data is dropped or renamed.
*/

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

-- Storage bucket for product images (public read so images render on invoices)
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
