CREATE OR REPLACE FUNCTION public.admin_invite_user(
  p_email text,
  p_full_name text,
  p_password text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth', 'extensions' AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_existing uuid;
  v_hashed text;
BEGIN
  -- Verify caller is a platform admin
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_platform_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Check for existing user
  SELECT id INTO v_existing FROM auth.users WHERE email = lower(trim(p_email));
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

  -- Hash password with bcrypt
  v_hashed := crypt(p_password, gen_salt('bf'));

  -- Insert into auth.users (confirmed_at is generated from email_confirmed_at)
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    lower(trim(p_email)),
    v_hashed,
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    CASE WHEN p_full_name IS NOT NULL AND p_full_name <> ''
      THEN jsonb_build_object('full_name', p_full_name)
      ELSE '{}'::jsonb END,
    now(),
    now()
  );

  -- Create user profile
  INSERT INTO user_profiles (id, full_name)
  VALUES (v_user_id, NULLIF(p_full_name, ''))
  ON CONFLICT (id) DO NOTHING;

  RETURN v_user_id;
END;
$$;
