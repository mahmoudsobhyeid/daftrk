/*
# Fix Company Logo Upload RLS Policy

## Problem
The original policy uses storage.foldername() which may not correctly parse UUIDs in paths.
Path format is: `<company-uuid>/logo.ext`
Need to verify that the authenticated user is the owner of the company in that path.

## Solution
1. Parse the path using string_to_array to extract company ID
2. Check if authenticated user owns the company
3. Provide full READ, WRITE, DELETE permissions to company owner
*/

-- Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Remove old policies
DROP POLICY IF EXISTS "public_read_company_logos" ON storage.objects;
DROP POLICY IF EXISTS "owner_insert_company_logos" ON storage.objects;
DROP POLICY IF EXISTS "owner_update_company_logos" ON storage.objects;
DROP POLICY IF EXISTS "owner_delete_company_logos" ON storage.objects;

-- PUBLIC READ: Anyone can read company logos (they appear on invoices)
CREATE POLICY "public_read_company_logos" ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'company-logos');

-- OWNER INSERT: Authenticated user can upload if they own the company
CREATE POLICY "owner_insert_company_logos" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE id::text = (string_to_array(name, '/'))[1]
    AND owner_id = auth.uid()
  )
);

-- OWNER UPDATE: Authenticated user can update if they own the company
CREATE POLICY "owner_update_company_logos" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE id::text = (string_to_array(name, '/'))[1]
    AND owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'company-logos'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE id::text = (string_to_array(name, '/'))[1]
    AND owner_id = auth.uid()
  )
);

-- OWNER DELETE: Authenticated user can delete if they own the company
CREATE POLICY "owner_delete_company_logos" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE id::text = (string_to_array(name, '/'))[1]
    AND owner_id = auth.uid()
  )
);
