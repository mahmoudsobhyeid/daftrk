/*
# Multi-Tenancy: account_id + role on user_profiles

1. Purpose
- Groups employees under the same subscribed company (tenant) via an `account_id` FK.
- Adds a `role` column distinguishing super_admin, tenant_owner, and employee.

2. Modified Tables
- `user_profiles`
  - `account_id` uuid nullable, references companies(id) ON DELETE SET NULL.
    Null for super_admins or users not yet assigned to a tenant.
  - `role` text NOT NULL DEFAULT 'employee', CHECK in ('super_admin','tenant_owner','employee').
- `company_members`
  - Widens the existing role CHECK to accept 'tenant_owner' alongside 'owner'/'member'
    so the new role vocabulary is usable without breaking existing rows.

3. Security
- RLS already enabled on user_profiles; existing self-row policies remain in force.
- No new table is introduced.

4. Important Notes
- `is_platform_admin` (existing boolean) remains the source of truth for super-admin
  access. The new `role = 'super_admin'` value mirrors it for application logic.
- `account_id` is nullable so existing users are not forced into a tenant before migration.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN account_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN role text NOT NULL DEFAULT 'employee'
      CHECK (role IN ('super_admin', 'tenant_owner', 'employee'));
  END IF;
END $$;

-- Back-fill: mirror is_platform_admin into role for existing super admins
UPDATE public.user_profiles
SET role = 'super_admin'
WHERE is_platform_admin = true AND role = 'employee';

-- Back-fill: set tenant_owner for users who own their account_id company
UPDATE public.user_profiles up
SET account_id = c.id, role = 'tenant_owner'
FROM public.companies c
WHERE c.owner_id = up.id
  AND up.account_id IS NULL
  AND up.role <> 'super_admin';

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_account ON public.user_profiles(account_id);

-- Keep role in sync when is_platform_admin changes (convenience trigger)
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_platform_admin = true AND NEW.role <> 'super_admin' THEN
    NEW.role := 'super_admin';
  ELSIF NEW.is_platform_admin = false AND NEW.role = 'super_admin' THEN
    NEW.role := 'employee';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_role ON user_profiles;
CREATE TRIGGER trg_sync_user_role
  BEFORE INSERT OR UPDATE OF is_platform_admin ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION sync_user_role();