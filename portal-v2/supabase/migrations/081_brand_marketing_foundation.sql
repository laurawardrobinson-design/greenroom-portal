-- ============================================================
-- 081: Brand Marketing foundation
-- ============================================================
--
-- Sprint 1, Story 1. Three changes:
--   1. Add the `Brand Marketing Manager` role to the user_role enum.
--      Referred to as "BMM" in product copy; enum value is the full
--      label so the DB matches what users see in the directory.
--   2. Enrich campaigns with `brand_owner_id` (the BMM who owns a
--      campaign) and `line_of_business` (the Publix LOB the campaign
--      serves — Bakery, Deli, Produce, Meat & Seafood, Grocery,
--      Health & Wellness, Pharmacy). Same taxonomy as the RBU
--      departments, which stay external to Portal per the BM Sprint
--      Plan's RBU-external rule.
--   3. RLS policies that let a BMM read + update the campaigns where
--      they are the brand_owner. Other roles keep their existing
--      access via the pre-existing policies.
--
-- Reference: portal-v2/BRAND_MARKETING_SPRINT_PLAN.md §8, §12, §13
-- Story 1. The LOB taxonomy supersedes the brand-tier list sketched
-- in §8/§12 of the plan (confirmed with Laura on 2026-04-22).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Role
-- ------------------------------------------------------------
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Brand Marketing Manager';

-- ------------------------------------------------------------
-- 2. Campaign enrichment
-- ------------------------------------------------------------
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS brand_owner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS line_of_business text;

-- Check constraint lives in a DO block so re-runs don't fail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_line_of_business_check'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_line_of_business_check
      CHECK (line_of_business IS NULL OR line_of_business IN (
        'Bakery',
        'Deli',
        'Produce',
        'Meat & Seafood',
        'Grocery',
        'Health & Wellness',
        'Pharmacy'
      ));
  END IF;
END $$;

-- Backfill: default every existing campaign to 'Grocery' as the
-- catch-all. Migration 084 (seed) reclassifies the demo campaigns to
-- specific LOBs for the Sprint 1 walkthrough; in-app UI lets Admin
-- and BMMs reclassify the rest.
UPDATE public.campaigns
  SET line_of_business = 'Grocery'
  WHERE line_of_business IS NULL;

-- Indexes for the Home Page portfolio query and the LOB filter chips.
CREATE INDEX IF NOT EXISTS idx_campaigns_brand_owner
  ON public.campaigns(brand_owner_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_line_of_business
  ON public.campaigns(line_of_business);

-- ------------------------------------------------------------
-- 3. RLS — Brand Marketing Manager access to their portfolio
-- ------------------------------------------------------------
-- A BMM can SELECT the campaigns they own (brand_owner_id = them).
-- They can't see other BMMs' portfolios in Sprint 1; the cross-BMM
-- CMO overview is deferred to Layer 3 per §10 of the plan.

DROP POLICY IF EXISTS "campaigns_bmm_read" ON public.campaigns;
CREATE POLICY "campaigns_bmm_read" ON public.campaigns FOR SELECT
  USING (
    get_my_role() = 'Brand Marketing Manager'
    AND brand_owner_id = auth.uid()
  );

-- A BMM can UPDATE the campaigns they own (to edit line_of_business,
-- attach brief data in later stories, etc.). The WITH CHECK keeps
-- them from reassigning brand_owner_id away from themselves — that
-- transfer is an Admin action. Admin retains full write via the
-- pre-existing `campaigns_modify` policy.

DROP POLICY IF EXISTS "campaigns_bmm_update" ON public.campaigns;
CREATE POLICY "campaigns_bmm_update" ON public.campaigns FOR UPDATE
  USING (
    get_my_role() = 'Brand Marketing Manager'
    AND brand_owner_id = auth.uid()
  )
  WITH CHECK (
    get_my_role() = 'Brand Marketing Manager'
    AND brand_owner_id = auth.uid()
  );

-- ------------------------------------------------------------
-- 4. Refresh PostgREST schema cache
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
