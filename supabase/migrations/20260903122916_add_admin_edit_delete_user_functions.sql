/*
# Add admin functions to edit and delete users

1. New Functions
- `admin_update_user(p_user_id, p_email, p_full_name, p_phone)` — updates a user's email in auth.users, and full_name/phone in user_profiles. Admin-only (checks is_platform_admin).
- `admin_delete_user(p_user_id)` — deletes a user from auth.users (cascades to user_profiles via FK). Admin-only. Prevents self-deletion.

2. Security
- Both functions are SECURITY DEFINER and check is_platform_admin on the calling user.
- admin_delete_user prevents the admin from deleting their own account.

3. Notes
- Email updates use auth.users update which requires service-role-level access; the SECURITY DEFINER function runs as the postgres owner, so this works.
- user_profiles is updated via upsert to handle the case where a profile row doesn't exist yet.
*/

CREATE OR REPLACE FUNCTION admin_update_user(
  p_user_id uuid,
  p_email text,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
  ) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  -- Update email in auth.users if changed
  IF p_email IS NOT NULL AND p_email <> '' THEN
    UPDATE auth.users SET email = p_email WHERE id = p_user_id;
  END IF;

  -- Update profile fields via upsert
  INSERT INTO user_profiles (id, full_name, phone)
  VALUES (p_user_id, p_full_name, p_phone)
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(p_full_name, user_profiles.full_name),
    phone = COALESCE(p_phone, user_profiles.phone);
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
  ) THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  -- Prevent self-deletion
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
