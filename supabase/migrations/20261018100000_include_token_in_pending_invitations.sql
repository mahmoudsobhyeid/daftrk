-- Include token in get_pending_invitations so team owners can copy/send the invite link anytime
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
    'token', token,
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

REVOKE EXECUTE ON FUNCTION public.get_pending_invitations(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pending_invitations(uuid) TO authenticated;
