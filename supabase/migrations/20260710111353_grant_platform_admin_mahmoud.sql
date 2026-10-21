/*
# Grant Platform Admin to mahmoud.sobhy36@gmail.com

1. If the user already exists: update their user_profiles row to is_platform_admin = true.
2. Create/replace a trigger on auth.users so that when this email signs up,
   their profile is automatically created with is_platform_admin = true.
   (The existing handle_new_user trigger creates the profile row on signup;
   this trigger fires AFTER that to set the admin flag for the specific email.)
*/

-- If user already exists and has a profile, grant admin now
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'mahmoud.sobhy36@gmail.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_profiles (id, is_platform_admin)
    VALUES (v_user_id, true)
    ON CONFLICT (id) DO UPDATE SET is_platform_admin = true;
  END IF;
END $$;

-- Trigger function: auto-grant admin on signup for specific emails
CREATE OR REPLACE FUNCTION public.auto_grant_platform_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.email = 'mahmoud.sobhy36@gmail.com' THEN
    INSERT INTO public.user_profiles (id, is_platform_admin)
    VALUES (NEW.id, true)
    ON CONFLICT (id) DO UPDATE SET is_platform_admin = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if present, then recreate
DROP TRIGGER IF EXISTS trg_auto_grant_platform_admin ON auth.users;
CREATE TRIGGER trg_auto_grant_platform_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_grant_platform_admin();
