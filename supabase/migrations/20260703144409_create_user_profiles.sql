/*
# Create user_profiles table

1. New Tables
   - `user_profiles`
     - `id` (uuid, primary key, references auth.users)
     - `full_name` (text, nullable)
     - `phone` (text, nullable)
     - `avatar_path` (text, nullable) — path in Supabase Storage bucket `avatars`
     - `notify_invoice_paid` (boolean, default true) — in-app notification preference
     - `notify_invoice_overdue` (boolean, default true)
     - `notify_new_customer` (boolean, default false)
     - `notify_low_stock` (boolean, default true)
     - `notify_marketing` (boolean, default false)
     - `updated_at` (timestamptz, auto-updated)

2. Security
   - Enable RLS on `user_profiles`.
   - Each authenticated user can only SELECT/INSERT/UPDATE/DELETE their own row.

3. Automation
   - Trigger `handle_new_user` fires after signup and auto-inserts a profile row
     seeded with the `full_name` stored in auth.users user_metadata.
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_path text,
  notify_invoice_paid boolean NOT NULL DEFAULT true,
  notify_invoice_overdue boolean NOT NULL DEFAULT true,
  notify_new_customer boolean NOT NULL DEFAULT false,
  notify_low_stock boolean NOT NULL DEFAULT true,
  notify_marketing boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON user_profiles;
CREATE POLICY "select_own_profile" ON user_profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON user_profiles;
CREATE POLICY "insert_own_profile" ON user_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;
CREATE POLICY "update_own_profile" ON user_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON user_profiles;
CREATE POLICY "delete_own_profile" ON user_profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- Auto-create profile row on new signup
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_profile();

-- Back-fill profiles for existing users (no-op if already present)
INSERT INTO user_profiles (id, full_name)
SELECT id, raw_user_meta_data->>'full_name'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
