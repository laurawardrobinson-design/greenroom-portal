-- ============================================================
-- 075: Asset Studio — DAM placeholder for campaign-native ingest
--
-- Prototype goals:
--   - Represent an internal DAM handoff point before external DAM integration.
--   - Track campaign-shot asset ingest, retouch lifecycle, and immutable versions.
--   - Keep this temporary model API-compatible with a future external connector.
-- ============================================================

-- ------------------------------------------------------------
-- 1. dam_assets (current state per source asset)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dam_assets (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id               uuid        REFERENCES public.campaigns(id) ON DELETE SET NULL,
  source_campaign_asset_id  uuid        REFERENCES public.campaign_assets(id) ON DELETE SET NULL,
  name                      text        NOT NULL,
  file_url                  text        NOT NULL,
  file_type                 text        NOT NULL DEFAULT '',
  status                    text        NOT NULL DEFAULT 'ingested',
  photoshop_status          text        NOT NULL DEFAULT 'not_requested',
  photoshop_note            text        NOT NULL DEFAULT '',
  last_photoshop_request_at timestamptz,
  retouching_notes          text        NOT NULL DEFAULT '',
  metadata                  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by                uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dam_assets_status_check CHECK (
    status IN (
      'ingested',
      'retouching',
      'retouched',
      'versioning',
      'ready_for_activation',
      'archived'
    )
  ),
  CONSTRAINT dam_assets_photoshop_status_check CHECK (
    photoshop_status IN ('not_requested', 'requested', 'in_progress', 'completed')
  )
);

CREATE INDEX IF NOT EXISTS idx_dam_assets_campaign_status
  ON public.dam_assets (campaign_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dam_assets_source_asset
  ON public.dam_assets (source_campaign_asset_id)
  WHERE source_campaign_asset_id IS NOT NULL;

CREATE TRIGGER set_dam_assets_updated_at
  BEFORE UPDATE ON public.dam_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 2. dam_asset_versions (immutable history)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dam_asset_versions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_asset_id   uuid        REFERENCES public.dam_assets(id) ON DELETE CASCADE NOT NULL,
  version_number int         NOT NULL,
  label          text        NOT NULL DEFAULT '',
  stage          text        NOT NULL DEFAULT 'ingested',
  file_url       text        NOT NULL,
  metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  notes          text        NOT NULL DEFAULT '',
  created_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dam_asset_versions_stage_check CHECK (
    stage IN ('ingested', 'retouching', 'retouched', 'versioning', 'ready_for_activation', 'archived')
  ),
  CONSTRAINT dam_asset_versions_unique_per_asset UNIQUE (dam_asset_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_dam_asset_versions_asset_created
  ON public.dam_asset_versions (dam_asset_id, created_at DESC);

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------

ALTER TABLE public.dam_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dam_asset_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dam_assets_select ON public.dam_assets;
DROP POLICY IF EXISTS dam_assets_insert ON public.dam_assets;
DROP POLICY IF EXISTS dam_assets_update ON public.dam_assets;
DROP POLICY IF EXISTS dam_assets_delete ON public.dam_assets;

CREATE POLICY dam_assets_select ON public.dam_assets
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY dam_assets_insert ON public.dam_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY dam_assets_update ON public.dam_assets
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY dam_assets_delete ON public.dam_assets
  FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

DROP POLICY IF EXISTS dam_asset_versions_select ON public.dam_asset_versions;
DROP POLICY IF EXISTS dam_asset_versions_insert ON public.dam_asset_versions;
DROP POLICY IF EXISTS dam_asset_versions_update ON public.dam_asset_versions;
DROP POLICY IF EXISTS dam_asset_versions_delete ON public.dam_asset_versions;

CREATE POLICY dam_asset_versions_select ON public.dam_asset_versions
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY dam_asset_versions_insert ON public.dam_asset_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

-- Versions are immutable in normal operation.
CREATE POLICY dam_asset_versions_update ON public.dam_asset_versions
  FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

CREATE POLICY dam_asset_versions_delete ON public.dam_asset_versions
  FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

-- ------------------------------------------------------------
-- 4. Refresh PostgREST schema cache
-- ------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
