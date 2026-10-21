
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

CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
