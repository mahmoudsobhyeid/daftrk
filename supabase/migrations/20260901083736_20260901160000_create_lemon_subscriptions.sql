/*
# Lemon Squeezy Subscription Tracking

1. New Table
- `lemon_subscriptions`: Tracks Lemon Squeezy subscription state per tenant.
  - `id` uuid PK
  - `tenant_id` uuid FK -> companies(id) ON DELETE CASCADE
  - `lemon_subscription_id` text unique — Lemon Squeezy's subscription ID
  - `status` text CHECK ('active'|'past_due'|'cancelled')
  - `variant_id` text — Lemon Squeezy variant (plan) ID
  - `current_period_end` timestamptz — billing period end
  - `created_at`, `updated_at` timestamps

2. Security
- RLS enabled. Tenant isolation via user_company_ids().
- Authenticated users can read their own tenant's subscription.
- No insert/update/delete from the client — the edge function uses the service role key.
*/

CREATE TABLE IF NOT EXISTS lemon_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lemon_subscription_id text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','cancelled')),
  variant_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lemon_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lemon_subscriptions_tenant ON lemon_subscriptions(tenant_id);

DROP POLICY IF EXISTS "select_own_lemon_subscriptions" ON lemon_subscriptions;
CREATE POLICY "select_own_lemon_subscriptions" ON lemon_subscriptions FOR SELECT
  TO authenticated USING (tenant_id IN (SELECT public.user_company_ids()));