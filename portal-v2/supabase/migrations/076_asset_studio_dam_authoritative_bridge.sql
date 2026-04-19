-- ============================================================
-- 076: DAM authoritative bridge + multi-campaign linking
--
-- Decisions captured:
--   - External DAM is authoritative (placeholder sync fields for now)
--   - One DAM asset can belong to multiple campaigns
--   - No hard rights enforcement in prototype
-- ============================================================

-- ------------------------------------------------------------
-- 1) External-DAM authority metadata on dam_assets
-- ------------------------------------------------------------

ALTER TABLE public.dam_assets
  ADD COLUMN IF NOT EXISTS external_dam_id text,
  ADD COLUMN IF NOT EXISTS external_dam_system text NOT NULL DEFAULT 'placeholder',
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'pending_sync',
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_error text NOT NULL DEFAULT '';

ALTER TABLE public.dam_assets
  DROP CONSTRAINT IF EXISTS dam_assets_sync_status_check;

ALTER TABLE public.dam_assets
  ADD CONSTRAINT dam_assets_sync_status_check
  CHECK (sync_status IN ('pending_sync', 'synced', 'stale', 'error'));

CREATE INDEX IF NOT EXISTS idx_dam_assets_external_dam_id
  ON public.dam_assets (external_dam_id)
  WHERE external_dam_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dam_assets_sync_status
  ON public.dam_assets (sync_status, updated_at DESC);

-- ------------------------------------------------------------
-- 2) Many-to-many campaign linkage for DAM assets
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dam_asset_campaigns (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_asset_id uuid       NOT NULL REFERENCES public.dam_assets(id) ON DELETE CASCADE,
  campaign_id uuid        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  linked_by   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  linked_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dam_asset_campaigns_unique UNIQUE (dam_asset_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_dam_asset_campaigns_campaign
  ON public.dam_asset_campaigns (campaign_id, linked_at DESC);

CREATE INDEX IF NOT EXISTS idx_dam_asset_campaigns_asset
  ON public.dam_asset_campaigns (dam_asset_id, linked_at DESC);

-- Backfill links from the legacy single campaign_id column.
INSERT INTO public.dam_asset_campaigns (dam_asset_id, campaign_id, linked_at)
SELECT id, campaign_id, now()
FROM public.dam_assets
WHERE campaign_id IS NOT NULL
ON CONFLICT (dam_asset_id, campaign_id) DO NOTHING;

-- ------------------------------------------------------------
-- 3) RLS for bridge table
-- ------------------------------------------------------------

ALTER TABLE public.dam_asset_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dam_asset_campaigns_select ON public.dam_asset_campaigns;
DROP POLICY IF EXISTS dam_asset_campaigns_insert ON public.dam_asset_campaigns;
DROP POLICY IF EXISTS dam_asset_campaigns_update ON public.dam_asset_campaigns;
DROP POLICY IF EXISTS dam_asset_campaigns_delete ON public.dam_asset_campaigns;

CREATE POLICY dam_asset_campaigns_select ON public.dam_asset_campaigns
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY dam_asset_campaigns_insert ON public.dam_asset_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

-- Bridge rows are append-only in normal usage.
CREATE POLICY dam_asset_campaigns_update ON public.dam_asset_campaigns
  FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

CREATE POLICY dam_asset_campaigns_delete ON public.dam_asset_campaigns
  FOR DELETE TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

-- ------------------------------------------------------------
-- 4) Refresh PostgREST schema cache
-- ------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
