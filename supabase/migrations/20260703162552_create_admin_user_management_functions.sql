
-- Admin function to list all platform users with their profile and company info
CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
  ) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC) INTO v_result
  FROM (
    SELECT
      u.id,
      u.email,
      u.created_at,
      u.last_sign_in_at,
      u.raw_user_meta_data->>'full_name' AS full_name,
      u.email_confirmed_at IS NOT NULL AS email_confirmed,
      COALESCE(p.is_platform_admin, false) AS is_platform_admin,
      p.phone,
      p.avatar_path,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'role', cm.role
        ))
        FROM company_members cm
        JOIN companies c ON c.id = cm.company_id
        WHERE cm.user_id = u.id
      ) AS companies
    FROM auth.users u
    LEFT JOIN user_profiles p ON p.id = u.id
  ) r;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Admin function to set/unset platform admin status
CREATE OR REPLACE FUNCTION set_platform_admin(p_user_id uuid, p_is_admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
  ) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  -- Prevent removing own admin status
  IF p_user_id = auth.uid() AND p_is_admin = false THEN
    RAISE EXCEPTION 'Cannot remove your own admin status';
  END IF;

  INSERT INTO user_profiles (id, is_platform_admin)
  VALUES (p_user_id, p_is_admin)
  ON CONFLICT (id) DO UPDATE SET is_platform_admin = p_is_admin;
END;
$$;

-- Admin function to create a new user account
CREATE OR REPLACE FUNCTION admin_invite_user(p_email text, p_full_name text, p_password text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
  ) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  -- Use Supabase admin API pattern — create via auth.users direct insert
  -- Note: password is hashed by Supabase auth infrastructure
  RAISE EXCEPTION 'Use Supabase auth admin API to create users';
END;
$$;
