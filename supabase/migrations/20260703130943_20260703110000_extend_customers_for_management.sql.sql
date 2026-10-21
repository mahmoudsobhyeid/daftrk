/*
# Extend customers table for full customer management

## Overview
Adds city, country, and status columns to the customers table to support
the full customer-management feature set (address breakdown, active/inactive
status filtering).

## New columns on public.customers
- city (text): city portion of the address.
- country (text): customer's country.
- status (text): 'active' | 'inactive', defaults to 'active'.

All columns are nullable (except status which has a default) so existing
rows keep working without backfill.

## Security
- No RLS policy changes. New columns are covered by the existing
  membership-based policies already on public.customers.

## Notes
1. Columns are added with IF NOT EXISTS via a DO block for idempotency.
2. No data is dropped or renamed.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'city') THEN
    ALTER TABLE public.customers ADD COLUMN city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'country') THEN
    ALTER TABLE public.customers ADD COLUMN country text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'status') THEN
    ALTER TABLE public.customers ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
