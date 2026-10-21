-- Add permissions JSONB column to team_members and backfill sensible defaults
ALTER TABLE IF EXISTS team_members ADD COLUMN IF NOT EXISTS permissions jsonb;

-- Backfill: owners get full permissions; others empty object
DO $$
BEGIN
  UPDATE team_members SET permissions = (
    jsonb_build_object(
      'sales', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true),
      'purchases', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true),
      'inventory', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true),
      'customers', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true),
      'suppliers', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true),
      'invoices', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true),
      'expenses', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true),
      'reports', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true),
      'user_management', jsonb_build_object('view', true, 'create', true, 'edit', true, 'delete', true)
    )
  ) WHERE role = 'owner';

  UPDATE team_members SET permissions = COALESCE(permissions, '{}'::jsonb) WHERE permissions IS NULL;
END;
$$;

-- Optional index for querying permissions (example)
CREATE INDEX IF NOT EXISTS idx_team_members_permissions ON team_members USING gin (permissions jsonb_path_ops);
