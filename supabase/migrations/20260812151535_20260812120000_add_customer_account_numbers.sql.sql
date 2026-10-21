/*
# Customer Account Number System

## Purpose
Adds a unique, auto-generated, concurrency-safe Account Number to every customer.
Account Numbers start at 10001 and increment by 1 for each new customer.
Deleted customers' account numbers are never reused (the sequence only moves forward).

## Changes

### 1. New column: account_number
- Added `account_number` (integer) to `public.customers`.
- UNIQUE constraint ensures no two customers ever share an account number.
- NOT NULL after backfill (set during migration so existing rows get values first).

### 2. Sequence: customer_account_number_seq
- A PostgreSQL SEQUENCE starting at 10001, increment by 1.
- The sequence is global across all companies (not per-company), so every customer
  in the system gets a unique account number.
- Sequences are concurrency-safe: even if two customers are inserted simultaneously,
  each gets a distinct nextval().
- Sequences never reuse values — deleting a customer does not roll the sequence back.

### 3. Trigger: customers_set_account_number
- A BEFORE INSERT trigger calls nextval() on the sequence and sets account_number
  if the INSERT did not supply one. This guarantees the database — not the frontend —
  generates the account number, preventing duplicates under concurrent inserts.
- If the INSERT explicitly provides an account_number, the trigger respects it
  (useful for imports/migrations) but the UNIQUE constraint still prevents duplicates.

### 4. Backfill existing customers
- All existing customers without an account_number are assigned sequential numbers
  starting from 10001, ordered by created_at (oldest first).

### 5. Indexes for search performance
- UNIQUE index on account_number (enforces uniqueness + fast exact search).
- Index on phone (supports partial mobile number search).
- Index on lower(email) (supports case-insensitive email search).

### 6. Security
- RLS remains enabled. No policy changes — existing CRUD policies still apply.
- The trigger function is SECURITY DEFINER so it can call nextval() regardless of
  the calling role, but it only reads/sets the account_number column (no other access).
*/

-- ── Step 1: Add the column (nullable initially so backfill can run) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'account_number'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN account_number integer;
  END IF;
END $$;

-- ── Step 2: Create the sequence (starts at 10001) ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'customer_account_number_seq') THEN
    CREATE SEQUENCE public.customer_account_number_seq START 10001 INCREMENT 1;
  END IF;
END $$;

-- ── Step 3: Backfill existing customers that have no account_number ──
-- Assign 10001, 10002, ... ordered by created_at (oldest first) so the first
-- customer registered gets 10001.
DO $$
DECLARE
  r RECORD;
  next_num integer;
BEGIN
  FOR r IN
    SELECT id FROM public.customers
    WHERE account_number IS NULL
    ORDER BY created_at ASC, id ASC
  LOOP
    next_num := nextval('public.customer_account_number_seq');
    UPDATE public.customers SET account_number = next_num WHERE id = r.id;
  END LOOP;
END $$;

-- ── Step 4: Set column to NOT NULL (safe now that all rows have values) ──
ALTER TABLE public.customers ALTER COLUMN account_number SET NOT NULL;

-- ── Step 5: Unique constraint on account_number ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_account_number_key'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_account_number_key UNIQUE (account_number);
  END IF;
END $$;

-- ── Step 6: Trigger function to auto-assign account_number on INSERT ──
CREATE OR REPLACE FUNCTION public.customers_set_account_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_number IS NULL THEN
    NEW.account_number := nextval('public.customer_account_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_set_account_number ON public.customers;
CREATE TRIGGER customers_set_account_number
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.customers_set_account_number();

-- ── Step 7: Indexes for search ──
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON public.customers (lower(email));
-- account_number already has a unique index from the constraint above

-- Revoke execute from anon/authenticated — only the trigger (SECURITY DEFINER) should call it
REVOKE ALL ON FUNCTION public.customers_set_account_number() FROM PUBLIC;
