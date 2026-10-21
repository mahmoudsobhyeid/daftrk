-- Company account numbers should be tenant-level, not per customer.
-- This migration:
-- 1) ensures all companies get an account_id starting from ACC-1001
-- 2) removes customer-level account_number logic that was being used in the customer list

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN account_id text UNIQUE;
  END IF;
END $$;

DO $$
DECLARE
  r RECORD;
  next_num bigint := 1001;
BEGIN
  FOR r IN
    SELECT id
    FROM public.companies
    WHERE account_id IS NULL OR account_id !~ '^ACC-[0-9]+$'
    ORDER BY created_at ASC, id ASC
  LOOP
    UPDATE public.companies
    SET account_id = 'ACC-' || next_num
    WHERE id = r.id;

    next_num := next_num + 1;
  END LOOP;

  FOR r IN
    SELECT id, account_id
    FROM public.companies
    WHERE account_id ~ '^ACC-[0-9]+$'
    ORDER BY created_at ASC, id ASC
  LOOP
    IF CAST(REPLACE(r.account_id, 'ACC-', '') AS bigint) < 1001 THEN
      UPDATE public.companies
      SET account_id = 'ACC-' || (1001 + (SELECT COUNT(*) FROM public.companies c2 WHERE c2.created_at < r.created_at OR (c2.created_at = r.created_at AND c2.id <= r.id)))
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.generate_tenant_account_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_num bigint;
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(CAST(REPLACE(account_id, 'ACC-', '') AS bigint)), 1000)
  INTO max_num
  FROM public.companies
  WHERE account_id ~ '^ACC-[0-9]+$';

  NEW.account_id := 'ACC-' || (max_num + 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_tenant_account_id ON public.companies;
CREATE TRIGGER trg_generate_tenant_account_id
  BEFORE INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_tenant_account_id();

CREATE INDEX IF NOT EXISTS idx_companies_account_id ON public.companies(account_id);

-- Remove per-customer account numbers from customer list.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'account_number'
  ) THEN
    ALTER TABLE public.customers DROP COLUMN account_number;
  END IF;
END $$;

DROP TRIGGER IF EXISTS customers_set_account_number ON public.customers;
DROP FUNCTION IF EXISTS public.customers_set_account_number();
DROP SEQUENCE IF EXISTS public.customer_account_number_seq;

-- Clean up any remaining references that would otherwise conflict with the new per-company account format.
-- The company account_id remains the only account number used by the tenant.
