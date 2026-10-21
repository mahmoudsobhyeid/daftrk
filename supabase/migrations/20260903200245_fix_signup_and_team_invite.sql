/*
# Fix signup + team invite

## 1. Auto-confirm email on signup
Email confirmation is enabled in Supabase Auth, which blocks new users from
getting a session until they click the email link. For this app, we want
users to be able to sign up and immediately log in. We auto-confirm by
creating a trigger that sets email_confirmed_at and confirmed_at on insert
to auth.users.

## 2. Team invite function
The TeamPage tried to use supabase.auth.admin.getUserByEmail() from the
frontend, which requires the service role key and always fails with the
anon key. user_profiles also has no email column and only allows selecting
own row. We create a SECURITY DEFINER function that:
- Looks up the user by email in auth.users
- Checks the caller is an owner/admin of the target company
- Inserts into team_members if not already a member
- Returns the user's id or an error message
*/

-- 1. Auto-confirm emails on signup
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_confirm_user_trigger ON auth.users;
CREATE TRIGGER auto_confirm_user_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();

-- 2. Team invite function
CREATE OR REPLACE FUNCTION public.invite_team_member(
  p_tenant_id uuid,
  p_email text,
  p_role text DEFAULT 'agent'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_caller_role text;
  v_existing_count int;
BEGIN
  -- Get the invited user's id from auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(trim(p_email));
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  -- Check the caller is a member with owner/admin role in this tenant
  SELECT role INTO v_caller_role
  FROM team_members
  WHERE tenant_id = p_tenant_id AND user_id = auth.uid();

  IF v_caller_role IS NULL OR NOT (v_caller_role = ANY (ARRAY['owner', 'admin'])) THEN
    -- Also check company_members as fallback
    SELECT role INTO v_caller_role
    FROM company_members
    WHERE company_id = p_tenant_id AND user_id = auth.uid();

    IF v_caller_role IS NULL OR NOT (v_caller_role = ANY (ARRAY['owner', 'admin'])) THEN
      RAISE EXCEPTION 'Unauthorized: only owners and admins can invite members';
    END IF;
  END IF;

  -- Check if already a member
  SELECT count(*) INTO v_existing_count
  FROM team_members
  WHERE tenant_id = p_tenant_id AND user_id = v_user_id;

  IF v_existing_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_member');
  END IF;

  -- Insert the new team member
  INSERT INTO team_members (tenant_id, user_id, role)
  VALUES (p_tenant_id, v_user_id, p_role);

  RETURN jsonb_build_object('ok', true, 'user_id', v_user_id);
END;
$$;

-- 3. Allow team members to read other members' basic profile info
-- The TeamPage needs to display names and emails of team members.
-- Create a view that exposes limited profile info for users in the same tenant.
CREATE OR REPLACE FUNCTION public.get_team_member_profiles(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  -- Verify caller is a member of this tenant
  IF NOT EXISTS (
    SELECT 1 FROM team_members WHERE tenant_id = p_tenant_id AND user_id = auth.uid()
  ) THEN
    -- Also check company_members
    IF NOT EXISTS (
      SELECT 1 FROM company_members WHERE company_id = p_tenant_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'user_id', u.id,
    'email', u.email,
    'full_name', p.full_name
  )) INTO v_result
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.id IN (
    SELECT user_id FROM team_members WHERE tenant_id = p_tenant_id
  );

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
