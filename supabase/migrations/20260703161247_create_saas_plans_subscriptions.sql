
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  name_ar text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric NOT NULL DEFAULT 0,
  max_customers int,
  max_products int,
  max_invoices int,
  features jsonb NOT NULL DEFAULT '[]',
  highlight boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_plans" ON plans;
CREATE POLICY "public_read_plans" ON plans FOR SELECT
  TO anon, authenticated USING (true);

INSERT INTO plans (id, name, name_ar, price_monthly, price_yearly, max_customers, max_products, max_invoices, features, highlight, sort_order)
VALUES
  ('free_trial', 'Free Trial', 'تجربة مجانية', 0, 0, 100, 100, 100,
   '["14-day free trial","100 customers","100 products","100 invoices","3 invoice templates","PDF export & sharing"]',
   false, 0),
  ('starter', 'Starter', 'المبتدئ', 29, 290, 100, 100, 100,
   '["100 customers","100 products","100 invoices","3 invoice templates","PDF export & sharing","Email support"]',
   false, 1),
  ('pro', 'Pro', 'الاحترافي', 79, 790, NULL, NULL, NULL,
   '["Unlimited customers","Unlimited products","Unlimited invoices","All templates","PDF export & sharing","Priority support","Advanced analytics"]',
   true, 2),
  ('business', 'Business', 'الأعمال', 149, 1490, NULL, NULL, NULL,
   '["Everything in Pro","Multi-user access","Custom invoice domain","API access","Dedicated account manager","SLA 99.9%"]',
   false, 3),
  ('enterprise', 'Enterprise', 'المؤسسي', 0, 0, NULL, NULL, NULL,
   '["Everything in Business","Unlimited workspaces","On-premises option","Custom integrations","24/7 dedicated support","Custom contracts"]',
   false, 4)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id),
  status text NOT NULL DEFAULT 'trialing',
  trial_ends_at timestamptz,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  amount_paid numeric NOT NULL DEFAULT 0,
  payment_reference text,
  notes text,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_subscription" ON subscriptions;
CREATE POLICY "members_read_subscription" ON subscriptions FOR SELECT
  TO authenticated USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

DROP POLICY IF EXISTS "admin_insert_subscription" ON subscriptions;
CREATE POLICY "admin_insert_subscription" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

DROP POLICY IF EXISTS "admin_update_subscription" ON subscriptions;
CREATE POLICY "admin_update_subscription" ON subscriptions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

DROP POLICY IF EXISTS "admin_delete_subscription" ON subscriptions;
CREATE POLICY "admin_delete_subscription" ON subscriptions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

CREATE OR REPLACE FUNCTION create_trial_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.subscriptions (
    company_id, plan_id, status,
    trial_ends_at,
    current_period_start, current_period_end
  ) VALUES (
    NEW.id, 'free_trial', 'trialing',
    now() + interval '14 days',
    now(),
    now() + interval '14 days'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_company_created_trial ON companies;
CREATE TRIGGER on_company_created_trial
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION create_trial_subscription();

INSERT INTO subscriptions (company_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
SELECT
  c.id, 'free_trial', 'trialing',
  c.created_at + interval '14 days',
  c.created_at,
  c.created_at + interval '14 days'
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.company_id = c.id)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION get_admin_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC) INTO v_result
  FROM (
    SELECT
      c.id, c.name, c.name_ar, c.email, c.created_at,
      s.id AS subscription_id,
      s.plan_id, s.status,
      s.trial_ends_at, s.current_period_end,
      s.amount_paid, s.payment_reference, s.notes,
      s.updated_at AS sub_updated_at,
      (SELECT COUNT(*)::int FROM customers WHERE company_id = c.id) AS customer_count,
      (SELECT COUNT(*)::int FROM products  WHERE company_id = c.id) AS product_count,
      (SELECT COUNT(*)::int FROM invoices  WHERE company_id = c.id) AS invoice_count,
      (SELECT COALESCE(SUM(total),0) FROM invoices WHERE company_id = c.id AND status = 'paid') AS total_revenue
    FROM companies c
    LEFT JOIN subscriptions s ON s.company_id = c.id
  ) r;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
