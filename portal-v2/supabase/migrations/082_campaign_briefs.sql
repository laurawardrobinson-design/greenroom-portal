-- ============================================================
-- 082: Campaign briefs (structured record + lightweight audit)
-- ============================================================
--
-- Sprint 1, Story 3. Portal holds the brief as a structured record
-- rather than linking out to a Google Doc (see §9 Decision 1).
--   • One brief per campaign (enforced by UNIQUE).
--   • Six first-class fields + references[]; each save bumps the
--     version counter and drops a row in campaign_brief_versions.
--   • Completeness is derived in the service layer, not stored.
--
-- Reference: portal-v2/BRAND_MARKETING_SPRINT_PLAN.md §12 Story 3.
-- ============================================================

-- ------------------------------------------------------------
-- 1. campaign_briefs
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_briefs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      uuid        NOT NULL UNIQUE REFERENCES public.campaigns(id) ON DELETE CASCADE,
  objective        text        NOT NULL DEFAULT '',
  audience         text        NOT NULL DEFAULT '',
  proposition      text        NOT NULL DEFAULT '',
  mandatories      text        NOT NULL DEFAULT '',
  success_measure  text        NOT NULL DEFAULT '',
  "references"     text[]      NOT NULL DEFAULT '{}',
  author_id        uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  last_edited_by   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  version          integer     NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_briefs_campaign_id
  ON public.campaign_briefs(campaign_id);

-- ------------------------------------------------------------
-- 2. campaign_brief_versions (light audit / undo)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_brief_versions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id      uuid        NOT NULL REFERENCES public.campaign_briefs(id) ON DELETE CASCADE,
  version       integer     NOT NULL,
  snapshot_json jsonb       NOT NULL,
  edited_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  edited_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_brief_versions_brief_id
  ON public.campaign_brief_versions(brief_id, version DESC);

-- ------------------------------------------------------------
-- 3. updated_at auto-touch
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_campaign_brief_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_briefs_touch_updated_at ON public.campaign_briefs;
CREATE TRIGGER campaign_briefs_touch_updated_at
  BEFORE UPDATE ON public.campaign_briefs
  FOR EACH ROW EXECUTE FUNCTION public.touch_campaign_brief_updated_at();

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------
-- Read: Producer/Post Producer/Art Director/Creative Director/
--       Designer/Admin always. Brand Marketing Manager only on the
--       campaigns they own.
-- Write: Producer/Post Producer/Admin always. BMM only on owned
--       campaigns. Creative team can read to stay in sync but not
--       edit (briefs are a BMM/Producer artifact).

ALTER TABLE public.campaign_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_brief_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_briefs_read" ON public.campaign_briefs;
CREATE POLICY "campaign_briefs_read" ON public.campaign_briefs FOR SELECT
  USING (
    public.current_user_has_role(ARRAY[
      'Admin','Producer','Post Producer','Art Director','Creative Director','Designer','Studio'
    ])
    OR (
      get_my_role() = 'Brand Marketing Manager'
      AND EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_briefs.campaign_id AND c.brand_owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "campaign_briefs_write" ON public.campaign_briefs;
CREATE POLICY "campaign_briefs_write" ON public.campaign_briefs FOR ALL
  USING (
    public.current_user_has_role(ARRAY['Admin','Producer','Post Producer'])
    OR (
      get_my_role() = 'Brand Marketing Manager'
      AND EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_briefs.campaign_id AND c.brand_owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.current_user_has_role(ARRAY['Admin','Producer','Post Producer'])
    OR (
      get_my_role() = 'Brand Marketing Manager'
      AND EXISTS (
        SELECT 1 FROM public.campaigns c
        WHERE c.id = campaign_briefs.campaign_id AND c.brand_owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "campaign_brief_versions_read" ON public.campaign_brief_versions;
CREATE POLICY "campaign_brief_versions_read" ON public.campaign_brief_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_briefs b
      WHERE b.id = campaign_brief_versions.brief_id
    )
  );

DROP POLICY IF EXISTS "campaign_brief_versions_write" ON public.campaign_brief_versions;
CREATE POLICY "campaign_brief_versions_write" ON public.campaign_brief_versions FOR INSERT
  WITH CHECK (
    public.current_user_has_role(ARRAY['Admin','Producer','Post Producer','Brand Marketing Manager'])
  );

NOTIFY pgrst, 'reload schema';
