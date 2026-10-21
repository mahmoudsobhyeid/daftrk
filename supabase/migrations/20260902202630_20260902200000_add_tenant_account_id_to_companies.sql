-- Add unique tenant Account ID to companies (not end-customers)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.companies
      ADD COLUMN account_id text UNIQUE;
  END IF;
END $$;

-- Back-fill existing companies with sequential account IDs
DO $$
DECLARE r RECORD; counter int := 1000;
BEGIN
  FOR r IN SELECT id FROM public.companies WHERE account_id IS NULL ORDER BY created_at LOOP
    UPDATE public.companies SET account_id = 'ACC-' || counter WHERE id = r.id;
    counter := counter + 1;
  END LOOP;
END $$;

-- Ensure future inserts get an account_id automatically
CREATE OR REPLACE FUNCTION public.generate_tenant_account_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE max_num int;
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX(CAST(REPLACE(account_id, 'ACC-', '') AS int)), 999)
  INTO max_num FROM public.companies WHERE account_id ~ '^ACC-[0-9]+$';
  NEW.account_id := 'ACC-' || (max_num + 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_tenant_account_id ON public.companies;
CREATE TRIGGER trg_generate_tenant_account_id
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.generate_tenant_account_id();

CREATE INDEX IF NOT EXISTS idx_companies_account_id ON public.companies(account_id);

-- Update get_admin_overview to include account_id and phone
CREATE OR REPLACE FUNCTION get_admin_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
  ) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC) INTO v_result
  FROM (
    SELECT
      c.id, c.name, c.name_ar, c.email, c.phone, c.account_id, c.created_at,
      c.is_suspended, c.suspended_at, c.suspended_reason,
      s.id AS subscription_id,
      s.plan_id, s.status,
      s.trial_ends_at, s.current_period_end,
      s.amount_paid, s.payment_reference, s.notes,
      s.updated_at AS sub_updated_at,
      (SELECT COUNT(*)::int FROM customers WHERE company_id = c.id) AS customer_count,
      (SELECT COUNT(*)::int FROM products  WHERE company_id = c.id) AS product_count,
      (SELECT COUNT(*)::int FROM invoices  WHERE company_id = c.id) AS invoice_count,
      (SELECT COALESCE(SUM(total),0) FROM invoices WHERE company_id = c.id AND status = 'paid') AS total_revenue,
      (SELECT u.email FROM auth.users u
       JOIN company_members cm ON cm.user_id = u.id
       WHERE cm.company_id = c.id AND cm.role = 'owner' LIMIT 1) AS owner_email
    FROM companies c
    LEFT JOIN subscriptions s ON s.company_id = c.id
  ) r;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
