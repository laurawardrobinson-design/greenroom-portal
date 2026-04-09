-- Studio users can view ALL campaigns (no crew-membership restriction)
DROP POLICY IF EXISTS "campaigns_studio" ON public.campaigns;
CREATE POLICY "campaigns_studio" ON public.campaigns FOR SELECT
  USING (get_my_role() = 'Studio');
