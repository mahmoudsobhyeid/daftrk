
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS suspended_reason text;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  target_company_name text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_audit_logs" ON admin_audit_logs;
CREATE POLICY "admin_read_audit_logs" ON admin_audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

DROP POLICY IF EXISTS "admin_insert_audit_logs" ON admin_audit_logs;
CREATE POLICY "admin_insert_audit_logs" ON admin_audit_logs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true)
    AND performed_by = auth.uid()
  );

DROP POLICY IF EXISTS "select_own_companies" ON companies;
DROP POLICY IF EXISTS "admin_read_all_companies" ON companies;
CREATE POLICY "admin_read_all_companies" ON companies FOR SELECT
  TO authenticated USING (
    id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

DROP POLICY IF EXISTS "update_own_companies" ON companies;
DROP POLICY IF EXISTS "admin_update_companies" ON companies;
CREATE POLICY "admin_update_companies" ON companies FOR UPDATE
  TO authenticated USING (
    id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND role = 'owner')
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

DROP POLICY IF EXISTS "delete_own_companies" ON companies;
DROP POLICY IF EXISTS "admin_delete_companies" ON companies;
CREATE POLICY "admin_delete_companies" ON companies FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

DROP POLICY IF EXISTS "select_own_customers" ON customers;
DROP POLICY IF EXISTS "admin_read_customers" ON customers;
CREATE POLICY "admin_read_customers" ON customers FOR SELECT
  TO authenticated USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

DROP POLICY IF EXISTS "select_own_products" ON products;
DROP POLICY IF EXISTS "admin_read_products" ON products;
CREATE POLICY "admin_read_products" ON products FOR SELECT
  TO authenticated USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

DROP POLICY IF EXISTS "select_own_invoices" ON invoices;
DROP POLICY IF EXISTS "admin_read_invoices" ON invoices;
CREATE POLICY "admin_read_invoices" ON invoices FOR SELECT
  TO authenticated USING (
    company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

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
      c.id, c.name, c.name_ar, c.email, c.created_at,
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

CREATE OR REPLACE FUNCTION get_admin_analytics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
  ) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT jsonb_build_object(
    'monthly_signups', (
      SELECT COALESCE(jsonb_agg(r ORDER BY r.month), '[]'::jsonb)
      FROM (
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               COUNT(*)::int AS count
        FROM companies
        WHERE created_at >= now() - interval '12 months'
        GROUP BY date_trunc('month', created_at)
      ) r
    ),
    'monthly_revenue', (
      SELECT COALESCE(jsonb_agg(r ORDER BY r.month), '[]'::jsonb)
      FROM (
        SELECT to_char(date_trunc('month', updated_at), 'YYYY-MM') AS month,
               SUM(amount_paid)::numeric AS total
        FROM subscriptions
        WHERE amount_paid > 0 AND updated_at >= now() - interval '12 months'
        GROUP BY date_trunc('month', updated_at)
      ) r
    ),
    'plan_distribution', (
      SELECT COALESCE(jsonb_agg(r ORDER BY r.count DESC), '[]'::jsonb)
      FROM (SELECT plan_id, COUNT(*)::int AS count FROM subscriptions GROUP BY plan_id) r
    ),
    'status_distribution', (
      SELECT COALESCE(jsonb_agg(r ORDER BY r.count DESC), '[]'::jsonb)
      FROM (SELECT status, COUNT(*)::int AS count FROM subscriptions GROUP BY status) r
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION get_system_health()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
  ) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT jsonb_build_object(
    'companies_total',      (SELECT COUNT(*)::int FROM companies),
    'companies_active',     (SELECT COUNT(*)::int FROM companies WHERE NOT is_suspended),
    'companies_suspended',  (SELECT COUNT(*)::int FROM companies WHERE is_suspended),
    'customers_total',      (SELECT COUNT(*)::int FROM customers),
    'products_total',       (SELECT COUNT(*)::int FROM products),
    'invoices_total',       (SELECT COUNT(*)::int FROM invoices),
    'invoices_paid',        (SELECT COUNT(*)::int FROM invoices WHERE status = 'paid'),
    'subs_trialing',        (SELECT COUNT(*)::int FROM subscriptions WHERE status = 'trialing'),
    'subs_active',          (SELECT COUNT(*)::int FROM subscriptions WHERE status = 'active'),
    'subs_expired',         (SELECT COUNT(*)::int FROM subscriptions WHERE status = 'expired'),
    'revenue_total',        (SELECT COALESCE(SUM(amount_paid),0)::numeric FROM subscriptions),
    'signups_last_7d',      (SELECT COUNT(*)::int FROM companies WHERE created_at >= now() - interval '7 days'),
    'signups_last_30d',     (SELECT COUNT(*)::int FROM companies WHERE created_at >= now() - interval '30 days'),
    'audit_logs_total',     (SELECT COUNT(*)::int FROM admin_audit_logs),
    'user_profiles_total',  (SELECT COUNT(*)::int FROM user_profiles),
    'generated_at',         now()
  ) INTO v_result;
  RETURN v_result;
END;
$$;
