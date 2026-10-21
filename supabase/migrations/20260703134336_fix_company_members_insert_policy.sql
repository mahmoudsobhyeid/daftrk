-- Fix chicken-and-egg: allow a user to insert themselves as a member of a
-- company they own, even before a membership row exists.
DROP POLICY IF EXISTS "insert_own_memberships" ON public.company_members;
CREATE POLICY "insert_own_memberships" ON public.company_members FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND (
      -- existing member adding another route (unused currently, kept for safety)
      company_id IN (SELECT public.user_company_ids())
      -- OR the company's owner bootstrapping their first membership row
      OR EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = company_id AND c.owner_id = auth.uid()
      )
    )
  );
