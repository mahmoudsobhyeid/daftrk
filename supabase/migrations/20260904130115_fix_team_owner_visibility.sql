/*
# Fix team invite — owner visibility + backfill

## Problem
`create_company` only inserts the owner into `company_members`, never into
`team_members`. The TeamPage queries `team_members`, so the owner sees an
empty team list and can't see themselves. The invite function works (it
checks `company_members` as fallback), but the team list looks broken.

## Fix
1. Update `create_company` to also insert the owner into `team_members`.
2. Backfill existing company owners into `team_members`.
3. Update `get_team_member_profiles` to include members from both
   `team_members` and `company_members` so nobody is invisible.
*/

-- 1. Update create_company to also insert into team_members
CREATE OR REPLACE FUNCTION public.create_company(
  p_name text, p_name_ar text, p_business_type text, p_country text,
  p_phone text, p_currency text, p_language text, p_timezone text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_company_id uuid;
  v_user_id    uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.companies (
    name, name_ar, business_type, country, phone,
    currency, language, timezone, owner_id
  ) VALUES (
    p_name, p_name_ar, p_business_type, p_country, p_phone,
    p_currency, p_language, p_timezone, v_user_id
  ) RETURNING id INTO v_company_id;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (v_company_id, v_user_id, 'owner');

  INSERT INTO public.team_members (tenant_id, user_id, role)
  VALUES (v_company_id, v_user_id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN v_company_id;
END;
$$;

-- 2. Backfill existing owners into team_members
INSERT INTO team_members (tenant_id, user_id, role)
SELECT company_id, user_id, 'owner'::text
FROM company_members cm
WHERE NOT EXISTS (
  SELECT 1 FROM team_members tm
  WHERE tm.tenant_id = cm.company_id AND tm.user_id = cm.user_id
)
ON CONFLICT DO NOTHING;

-- 3. Update get_team_member_profiles to include company_members too
CREATE OR REPLACE FUNCTION public.get_team_member_profiles(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  -- Verify caller is a member of this tenant (either table)
  IF NOT EXISTS (
    SELECT 1 FROM team_members WHERE tenant_id = p_tenant_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM company_members WHERE company_id = p_tenant_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Gather user ids from both team_members and company_members
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', u.id,
    'email', u.email,
    'full_name', p.full_name,
    'role', COALESCE(tm.role, cm.role)
  )) INTO v_result
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  LEFT JOIN team_members tm ON tm.tenant_id = p_tenant_id AND tm.user_id = u.id
  LEFT JOIN company_members cm ON cm.company_id = p_tenant_id AND cm.user_id = u.id
  WHERE u.id IN (
    SELECT user_id FROM team_members WHERE tenant_id = p_tenant_id
    UNION
    SELECT user_id FROM company_members WHERE company_id = p_tenant_id
  );

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
