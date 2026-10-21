/*
# Team invitation system with pending invites

## 1. New Table: team_invitations
Stores invitations for users who haven't registered yet.
- id (uuid, primary key)
- tenant_id (uuid, FK to companies)
- email (text, the invited email)
- role (text: owner/admin/agent)
- invited_by (uuid, FK to auth.users — the inviter)
- token (uuid, unique — secure one-time setup token)
- temp_password (text — temporary password for the invited user)
- status (text: pending/accepted/expired)
- created_at (timestamptz)
- accepted_at (timestamptz, nullable)

## 2. Updated invite_team_member function
Now handles both registered and unregistered users:
- If the email is already registered: adds them to team_members directly (existing behavior)
- If the email is NOT registered: creates an auth user with a temporary password,
  adds them to team_members, and inserts a team_invitation record with a secure token.
  Returns the token and temp_password so the caller can share the setup link.

## 3. accept_team_invitation function
Called by the invited user when they click the setup link.
Validates the token, marks the invitation as accepted, and lets the user set a new password.

## 4. RLS on team_invitations
- Owners/admins of the tenant can read invitations for their company
- Anyone with a valid token can accept (the function validates the token)
*/

CREATE TABLE IF NOT EXISTS team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'agent',
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  temp_password text,
  permissions jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_token_key ON team_invitations(token);
CREATE INDEX IF NOT EXISTS team_invitations_tenant_email_idx ON team_invitations(tenant_id, email);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_invitations_select_tenant" ON team_invitations;
CREATE POLICY "team_invitations_select_tenant" ON team_invitations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.tenant_id = team_invitations.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    ) OR EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = team_invitations.tenant_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
    ) OR EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
    )
  );

-- Rewrite invite_team_member to handle unregistered users
CREATE OR REPLACE FUNCTION public.invite_team_member(
  p_tenant_id uuid,
  p_email text,
  p_role text DEFAULT 'agent',
  p_permissions jsonb DEFAULT '{}'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth', 'extensions' AS $$
DECLARE
  v_user_id uuid;
  v_caller_role text;
  v_existing_count int;
  v_temp_password text;
  v_token uuid;
  v_existing_invite_id uuid;
BEGIN
  -- Validate role (allow legacy admin/agent for compatibility and new tenant roles)
  IF p_role NOT IN ('owner', 'admin', 'agent', 'accountant', 'employee', 'custom') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Check caller authorization (team_members or company_members)
  SELECT role INTO v_caller_role FROM team_members WHERE tenant_id = p_tenant_id AND user_id = auth.uid();
  IF v_caller_role IS NULL OR NOT (v_caller_role IN ('owner', 'admin')) THEN
    SELECT role INTO v_caller_role FROM company_members WHERE company_id = p_tenant_id AND user_id = auth.uid();
    IF v_caller_role IS NULL OR NOT (v_caller_role IN ('owner', 'admin')) THEN
      RAISE EXCEPTION 'Unauthorized: only owners and admins can invite members';
    END IF;
  END IF;

  -- Normalize email
  p_email := lower(trim(p_email));

  -- Check if user already exists in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  IF v_user_id IS NOT NULL THEN
    -- User exists: check if already a team member
    SELECT count(*) INTO v_existing_count FROM team_members WHERE tenant_id = p_tenant_id AND user_id = v_user_id;
    IF v_existing_count > 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'already_member');
    END IF;

    -- Add to team_members (persist permissions if provided)
    INSERT INTO team_members (tenant_id, user_id, role, permissions) VALUES (p_tenant_id, v_user_id, p_role, COALESCE(p_permissions, '{}'::jsonb));
    RETURN jsonb_build_object('ok', true, 'user_id', v_user_id, 'already_registered', true);
  END IF;

  -- User doesn't exist: create auth user with temp password
  v_temp_password := substr(md5(random()::text || now()::text), 1, 12);
  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    v_user_id, '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated', p_email,
    crypt(v_temp_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', split_part(p_email, '@', 1)),
    now(), now()
  );

  -- Create user profile
  INSERT INTO user_profiles (id, full_name) VALUES (v_user_id, split_part(p_email, '@', 1))
    ON CONFLICT (id) DO NOTHING;

  -- Add to team_members (persist permissions if provided)
  INSERT INTO team_members (tenant_id, user_id, role, permissions) VALUES (p_tenant_id, v_user_id, p_role, COALESCE(p_permissions, '{}'::jsonb));

  -- Check for existing pending invitation, update it; otherwise insert new
  SELECT id INTO v_existing_invite_id FROM team_invitations
    WHERE tenant_id = p_tenant_id AND email = p_email AND status = 'pending';

  v_token := gen_random_uuid();

  IF v_existing_invite_id IS NOT NULL THEN
    UPDATE team_invitations
      SET temp_password = v_temp_password, token = v_token, role = p_role, permissions = COALESCE(p_permissions, '{}'::jsonb), expires_at = now() + interval '7 days', created_at = now()
      WHERE id = v_existing_invite_id;
  ELSE
    INSERT INTO team_invitations (tenant_id, email, role, invited_by, token, temp_password, permissions)
      VALUES (p_tenant_id, p_email, p_role, auth.uid(), v_token, v_temp_password, COALESCE(p_permissions, '{}'::jsonb));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'already_registered', false,
    'token', v_token,
    'temp_password', v_temp_password
  );
END;
$$;

-- Accept invitation: validates token and lets user set a new password
CREATE OR REPLACE FUNCTION public.accept_team_invitation(
  p_token uuid,
  p_new_password text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth', 'extensions' AS $$
DECLARE
  v_invite team_invitations%ROWTYPE;
  v_user_id uuid;
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Atomic claim: mark as accepted only if still pending
  -- Only accept if still pending and not expired
  UPDATE team_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE token = p_token AND status = 'pending' AND (expires_at IS NULL OR expires_at > now())
    RETURNING * INTO v_invite;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invitation is invalid, already used, or expired';
  END IF;

  -- Find the user
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_invite.email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User account not found';
  END IF;

  -- Update password
  UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
    WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'email', v_invite.email);
END;
$$;

-- Function to list pending invitations for a tenant
CREATE OR REPLACE FUNCTION public.get_pending_invitations(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  -- Verify caller is owner/admin
  IF NOT EXISTS (
    SELECT 1 FROM team_members WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM company_members WHERE company_id = p_tenant_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'email', email,
    'role', role,
    'status', status,
    'created_at', created_at,
    'accepted_at', accepted_at,
    'expires_at', expires_at,
    'permissions', COALESCE(permissions, '{}'::jsonb)
  )) INTO v_result
  FROM team_invitations
  WHERE tenant_id = p_tenant_id
  ORDER BY created_at DESC;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Revoke a pending invitation
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM team_invitations WHERE id = p_invitation_id;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM team_members WHERE tenant_id = v_tenant_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM company_members WHERE company_id = v_tenant_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM team_invitations WHERE id = p_invitation_id AND status = 'pending';
END;
$$;

-- Grant EXECUTE to authenticated
REVOKE EXECUTE ON FUNCTION accept_team_invitation FROM anon;
GRANT EXECUTE ON FUNCTION accept_team_invitation TO authenticated;
REVOKE EXECUTE ON FUNCTION get_pending_invitations FROM anon;
GRANT EXECUTE ON FUNCTION get_pending_invitations TO authenticated;
REVOKE EXECUTE ON FUNCTION revoke_invitation FROM anon;
GRANT EXECUTE ON FUNCTION revoke_invitation TO authenticated;
