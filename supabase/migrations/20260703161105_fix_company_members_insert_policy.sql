
DROP POLICY IF EXISTS "insert_own_memberships" ON public.company_members;
CREATE POLICY "insert_own_memberships" ON public.company_members FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND (
      company_id IN (SELECT public.user_company_ids())
      OR EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = company_id AND c.owner_id = auth.uid()
      )
    )
  );
