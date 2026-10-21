Summary of frontend changes

- Added permission types and `PermissionSet` to `src/lib/types.ts`.
- Updated `TeamRole` to include tenant-focused roles: `owner`, `accountant`, `employee`, `custom` (kept `admin`/`agent` for compatibility).
- Extended `src/pages/TeamPage.tsx`:
  - Invite form now includes a permissions matrix (View/Create/Edit/Delete) per module.
  - Invite RPC call now sends `p_permissions` as JSON (frontend only; backend handling required).
  - Member row includes an "Edit permissions" action and a permissions editor modal.
  - Deletion is prevented for self and for the last active Owner.

Required backend / DB follow-ups

1. Persist permissions
   - Add a `permissions jsonb` column to `team_members` (or store in a separate `member_permissions` table).
   - Update RPC `invite_team_member` to accept `p_permissions` and store it alongside the invitation/team_member row.
   - When the invited user accepts (`accept_team_invitation`), attach the permissions to the created team_member row.

2. Invitations
   - Ensure invitation tokens expire and are single-use.
   - Include company name and assigned role in the invite email body (frontend already sends this metadata to the function).

3. RBAC enforcement
   - Add server-side checks on all API endpoints and row-level security policies to enforce `tenant_id`/`company_id` isolation.
   - Ensure platform staff accounts are segregated from tenant users and cannot access tenant data unless explicit `support` permission is present.

4. Migrations
   - Map existing roles to new roles (e.g., `admin` -> `accountant` or `employee`) as decided by product policy.
   - Backfill a sensible `permissions` JSON for existing team members (e.g., owners = full access).

Notes

- Frontend changes are conservative and send permissions to the backend where applicable; backend implementation is required to fully enable secure RBAC.
- I can implement the database migrations and RPC updates if you'd like — tell me which DB migration tool you prefer (SQL migration files are present in `migrations/`).
