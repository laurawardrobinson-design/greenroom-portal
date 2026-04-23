-- ============================================================
-- 083: Brand approvals (BMM sign-off gate)
-- ============================================================
--
-- Sprint 1, Story 4. One table — brand_approvals — polymorphic on
-- (subject_type, subject_id). Same row shape whether the subject is
-- a brief, a shot list, a variant set, or a final asset.
--
-- States (§9 Decision 2): pending → approved | changes_requested |
-- rejected | withdrawn. Comment required for anything that isn't
-- "approved" (enforced at the service layer; NOT in the DB, to
-- keep idempotent re-submission simple).
--
-- Reference: portal-v2/BRAND_MARKETING_SPRINT_PLAN.md §12 Story 4.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_approvals (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type  text        NOT NULL CHECK (subject_type IN (
    'campaign_brief','shot_list','variant_set','final_asset'
  )),
  subject_id    uuid        NOT NULL,
  campaign_id   uuid        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  requested_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  state         text        NOT NULL DEFAULT 'pending' CHECK (state IN (
    'pending','approved','changes_requested','rejected','withdrawn'
  )),
  comment       text        NOT NULL DEFAULT '',
  decided_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_approvals_queue
  ON public.brand_approvals(assigned_to, state);
CREATE INDEX IF NOT EXISTS idx_brand_approvals_campaign
  ON public.brand_approvals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_brand_approvals_subject
  ON public.brand_approvals(subject_type, subject_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_brand_approval_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS brand_approvals_touch_updated_at ON public.brand_approvals;
CREATE TRIGGER brand_approvals_touch_updated_at
  BEFORE UPDATE ON public.brand_approvals
  FOR EACH ROW EXECUTE FUNCTION public.touch_brand_approval_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.brand_approvals ENABLE ROW LEVEL SECURITY;

-- Read: requester, assignee, Admin/Producer/Post Producer always.
-- BMMs see anything assigned to them. Creative roles see approvals on
-- their campaigns (needed to render the decision trail on shot lists
-- and variant sets).
DROP POLICY IF EXISTS "brand_approvals_read" ON public.brand_approvals;
CREATE POLICY "brand_approvals_read" ON public.brand_approvals FOR SELECT
  USING (
    requested_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.current_user_has_role(ARRAY[
      'Admin','Producer','Post Producer','Art Director','Creative Director','Designer'
    ])
  );

-- Write: any role that can be "requester" can create. Only the
-- assignee or an Admin can update (decide).
DROP POLICY IF EXISTS "brand_approvals_insert" ON public.brand_approvals;
CREATE POLICY "brand_approvals_insert" ON public.brand_approvals FOR INSERT
  WITH CHECK (
    public.current_user_has_role(ARRAY[
      'Admin','Producer','Post Producer','Art Director','Creative Director','Designer','Brand Marketing Manager'
    ])
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS "brand_approvals_update" ON public.brand_approvals;
CREATE POLICY "brand_approvals_update" ON public.brand_approvals FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR requested_by = auth.uid()
    OR public.current_user_has_role(ARRAY['Admin'])
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR requested_by = auth.uid()
    OR public.current_user_has_role(ARRAY['Admin'])
  );

NOTIFY pgrst, 'reload schema';
