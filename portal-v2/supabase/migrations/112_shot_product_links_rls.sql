-- Enable RLS on shot_product_links — flagged CRITICAL by Supabase advisor
-- because the table is exposed via PostgREST without row-level security.
--
-- Mirrors the shot_deliverable_links policy from migration 099: vendors can
-- read links for shots in campaigns they're assigned to via campaign_vendors;
-- internal users (everyone non-Vendor) can read/write everything.

BEGIN;

ALTER TABLE public.shot_product_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shot_product_links_scoped_select" ON public.shot_product_links FOR SELECT TO authenticated
  USING (
    public.get_my_role() <> 'Vendor'
    OR EXISTS (
      SELECT 1 FROM public.shot_list_shots s
      JOIN public.campaign_vendors cv ON cv.campaign_id = s.campaign_id
      WHERE s.id = shot_product_links.shot_id
        AND cv.vendor_id = public.get_my_vendor_id()
    )
  );

CREATE POLICY "shot_product_links_internal_write" ON public.shot_product_links FOR ALL TO authenticated
  USING (public.get_my_role() <> 'Vendor')
  WITH CHECK (public.get_my_role() <> 'Vendor');

COMMIT;
