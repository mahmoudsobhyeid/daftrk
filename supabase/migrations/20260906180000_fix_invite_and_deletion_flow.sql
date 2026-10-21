-- Fix invitation flow: do not create auth.users or send temp passwords; make tokens single-use and add deactivation RPC

-- 1. Add soft-delete columns and audit table for team_members
ALTER TABLE IF EXISTS team_members ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE IF EXISTS team_members ADD COLUMN IF NOT EXISTS removed_at timestamptz;

CREATE TABLE IF NOT EXISTS team_members_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  performed_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Replace invite_team_member: do not create auth.users or temp passwords. Return token for setup link.
CREATE OR REPLACE FUNCTION public.invite_team_member(
  p_tenant_id uuid,
  p_email text,
  p_role text DEFAULT 'agent',
  p_permissions jsonb DEFAULT '{}'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_caller_role text;
  v_existing_count int;
  v_token uuid;
  v_existing_invite_id uuid;
BEGIN
  IF p_role NOT IN ('owner','admin','agent','accountant','employee','custom') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Authorization: allow owners/admins from team_members or company_members or platform admins
  SELECT role INTO v_caller_role FROM team_members WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND active = true;
  IF v_caller_role IS NULL OR NOT (v_caller_role IN ('owner','admin')) THEN
    SELECT role INTO v_caller_role FROM company_members WHERE company_id = p_tenant_id AND user_id = auth.uid();
    IF v_caller_role IS NULL OR NOT (v_caller_role IN ('owner','admin')) THEN
      IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true) THEN
        RAISE EXCEPTION 'Unauthorized: only owners and admins can invite members';
      END IF;
    END IF;
  END IF;

  p_email := lower(trim(p_email));

  -- If user already exists in auth.users, add to team_members
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NOT NULL THEN
    SELECT count(*) INTO v_existing_count FROM team_members WHERE tenant_id = p_tenant_id AND user_id = v_user_id AND active = true;
    IF v_existing_count > 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'already_member');
    END IF;
    INSERT INTO team_members (tenant_id, user_id, role, created_at) VALUES (p_tenant_id, v_user_id, p_role, now());
    RETURN jsonb_build_object('ok', true, 'user_id', v_user_id, 'already_registered', true);
  END IF;

  -- Create/refresh a pending invitation without creating auth user or temp password
  SELECT id INTO v_existing_invite_id FROM team_invitations WHERE tenant_id = p_tenant_id AND email = p_email AND status = 'pending';
  v_token := gen_random_uuid();
  IF v_existing_invite_id IS NOT NULL THEN
    UPDATE team_invitations
      SET token = v_token, role = p_role, permissions = COALESCE(p_permissions, '{}'::jsonb), expires_at = now() + interval '72 hours', invited_by = auth.uid(), created_at = now(), status = 'pending'
      WHERE id = v_existing_invite_id;
  ELSE
    INSERT INTO team_invitations (tenant_id, email, role, invited_by, token, permissions, expires_at)
      VALUES (p_tenant_id, p_email, p_role, auth.uid(), v_token, COALESCE(p_permissions, '{}'::jsonb), now() + interval '72 hours');
  END IF;

  RETURN jsonb_build_object('ok', true, 'already_registered', false, 'token', v_token);
END;
$$;

-- 3. Accept invitation: create user if not exists and set password; mark invitation accepted
CREATE OR REPLACE FUNCTION public.accept_team_invitation(
  p_token uuid,
  p_new_password text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invite team_invitations%ROWTYPE;
  v_user_id uuid;
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE team_invitations
    SET status = 'accepted', accepted_at = now(), expires_at = expires_at
    WHERE token = p_token AND status = 'pending' AND (expires_at IS NULL OR expires_at > now())
    RETURNING * INTO v_invite;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invitation is invalid, already used, or expired';
  END IF;

  -- If auth user exists, update password; otherwise create user
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_invite.email;
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      VALUES (v_user_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', v_invite.email, crypt(p_new_password, gen_salt('bf')), now(), jsonb_build_object('provider','email','providers',jsonb_build_array('email')), jsonb_build_object('full_name', split_part(v_invite.email,'@',1)), now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now() WHERE id = v_user_id;
  END IF;

  -- Create user profile
  INSERT INTO user_profiles (id, full_name) VALUES (v_user_id, split_part(v_invite.email, '@', 1)) ON CONFLICT (id) DO NOTHING;

  -- Add to team_members if not present
  IF NOT EXISTS (SELECT 1 FROM team_members WHERE tenant_id = v_invite.tenant_id AND user_id = v_user_id AND active = true) THEN
    INSERT INTO team_members (tenant_id, user_id, role, created_at, permissions) VALUES (v_invite.tenant_id, v_user_id, v_invite.role, now(), COALESCE(v_invite.permissions, '{}'::jsonb));
  END IF;

  RETURN jsonb_build_object('ok', true, 'email', v_invite.email, 'user_id', v_user_id);
END;
$$;

-- 4. Deactivate (soft-delete) a team member with safety checks and audit
CREATE OR REPLACE FUNCTION public.deactivate_team_member(p_member_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_member RECORD;
  v_owner_count int;
BEGIN
  SELECT * INTO v_member FROM team_members WHERE id = p_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  -- Must be in same tenant and caller must be owner/admin (allow company_members owners too)
  IF NOT EXISTS (
    SELECT 1 FROM team_members tm WHERE tm.tenant_id = v_member.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner','admin') AND tm.active = true
  ) AND NOT EXISTS (
    SELECT 1 FROM company_members cm WHERE cm.company_id = v_member.tenant_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Prevent deleting self
  IF v_member.user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot delete yourself'; END IF;

  -- Prevent deleting last active owner
  SELECT count(*) INTO v_owner_count FROM team_members WHERE tenant_id = v_member.tenant_id AND role = 'owner' AND active = true;
  IF v_member.role = 'owner' AND v_owner_count <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last owner';
  END IF;

  -- Soft-delete membership
  UPDATE team_members SET active = false, removed_at = now() WHERE id = p_member_id;

  -- Revoke sessions (best-effort; requires sufficient privileges)
  BEGIN
    DELETE FROM auth.refresh_tokens WHERE user_id = v_member.user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Log but do not fail
    RAISE NOTICE 'Session revoke attempted but failed: %', SQLERRM;
  END;

  -- Audit
  INSERT INTO team_members_audit (tenant_id, user_id, action, performed_by, created_at)
    VALUES (v_member.tenant_id, v_member.user_id, 'deactivated', auth.uid(), now());

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.deactivate_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(uuid, text) TO public;
GRANT EXECUTE ON FUNCTION public.invite_team_member(uuid, text, text, jsonb) TO authenticated;
