-- Separate platform admins from subscribed company owners/team members.
-- This prevents a subscribed customer from being treated as a platform super-admin
-- just because they created a company or were added to company/team membership.

-- 1) Backfill company owners to the correct tenant role and avoid mixing with platform admins
UPDATE public.user_profiles up
SET account_id = c.id,
    role = 'tenant_owner'
FROM public.companies c
WHERE c.owner_id = up.id
  AND up.is_platform_admin = false
  AND up.account_id IS DISTINCT FROM c.id;

-- 2) Ensure only explicit platform admins keep the super-admin role.
UPDATE public.user_profiles
SET role = 'super_admin'
WHERE is_platform_admin = true
  AND role <> 'super_admin';

UPDATE public.user_profiles
SET role = 'employee'
WHERE is_platform_admin = false
  AND account_id IS NULL
  AND role = 'super_admin';

-- 3) Prevent company/team ownership from being mistaken for platform admin access.
CREATE OR REPLACE FUNCTION public.sync_user_profile_from_tenant_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'company_members' THEN
    IF NEW.role = 'owner' AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles up WHERE up.id = NEW.user_id AND up.is_platform_admin = true
    ) THEN
      UPDATE public.user_profiles
      SET account_id = NEW.company_id,
          role = 'tenant_owner'
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'team_members' THEN
    IF NEW.role = 'owner' AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles up WHERE up.id = NEW.user_id AND up.is_platform_admin = true
    ) THEN
      UPDATE public.user_profiles
      SET account_id = NEW.tenant_id,
          role = 'tenant_owner'
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_profile_from_company_members ON public.company_members;
CREATE TRIGGER trg_sync_user_profile_from_company_members
AFTER INSERT OR UPDATE OF company_id, role ON public.company_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_profile_from_tenant_membership();

DROP TRIGGER IF EXISTS trg_sync_user_profile_from_team_members ON public.team_members;
CREATE TRIGGER trg_sync_user_profile_from_team_members
AFTER INSERT OR UPDATE OF tenant_id, role ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_profile_from_tenant_membership();

-- 4) Safety net: if a company owner is not explicitly marked as platform admin,
-- they remain tenant-scoped and are never treated like a super-admin.
DO $$
BEGIN
  UPDATE public.user_profiles up
  SET role = 'tenant_owner'
  FROM public.companies c
  WHERE c.owner_id = up.id
    AND up.is_platform_admin = false
    AND up.role <> 'tenant_owner';
END $$;
