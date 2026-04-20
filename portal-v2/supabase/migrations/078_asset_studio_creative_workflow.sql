-- ============================================================
-- 078: Asset Studio — creative workflow reshape
--
-- Captures the real greenroom flow that Sprints 1-6 didn't model:
--   1. Campaigns own copy (headline, CTA, disclaimer, legal).
--   2. Deliverables can override any of the four; NULL = inherit campaign.
--   3. Creative Director is a distinct role and the sole approver gate.
--   4. Designers / Art Directors are assigned to campaigns (one primary
--      of each role, plus additional viewers).
--   5. DAM assets can be tagged with product SKUs so the photographer's
--      upload surfaces under the right campaign/product in Asset Studio.
--
-- Non-breaking: all additions are nullable or defaulted; no data loss.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Creative Director role
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role'
      AND e.enumlabel = 'Creative Director'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'Creative Director';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 2) Campaign copy fields
-- ------------------------------------------------------------

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS headline   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta        text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS disclaimer text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS legal      text NOT NULL DEFAULT '';

-- ------------------------------------------------------------
-- 3) Deliverable copy overrides (NULL = inherit from campaign)
-- ------------------------------------------------------------

ALTER TABLE public.campaign_deliverables
  ADD COLUMN IF NOT EXISTS headline_override   text,
  ADD COLUMN IF NOT EXISTS cta_override        text,
  ADD COLUMN IF NOT EXISTS disclaimer_override text,
  ADD COLUMN IF NOT EXISTS legal_override      text;

-- ------------------------------------------------------------
-- 4) Campaign assignments (creative ownership, distinct from
--    campaign_crew which captures shoot-day crew)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  assignment_role text        NOT NULL,
  assigned_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_assignments_role_check CHECK (
    assignment_role IN ('primary_designer', 'primary_art_director', 'viewer')
  ),
  CONSTRAINT campaign_assignments_unique UNIQUE (campaign_id, user_id, assignment_role)
);

-- Only one primary_designer per campaign.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_campaign_primary_designer
  ON public.campaign_assignments (campaign_id)
  WHERE assignment_role = 'primary_designer';

-- Only one primary_art_director per campaign.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_campaign_primary_art_director
  ON public.campaign_assignments (campaign_id)
  WHERE assignment_role = 'primary_art_director';

CREATE INDEX IF NOT EXISTS idx_campaign_assignments_user
  ON public.campaign_assignments (user_id, assignment_role);

CREATE INDEX IF NOT EXISTS idx_campaign_assignments_campaign
  ON public.campaign_assignments (campaign_id);

-- ------------------------------------------------------------
-- 5) DAM asset product tagging (SKU-keyed, no FK to products
--    since that table's creation lives outside this migrations
--    folder — keeps the reshape decoupled from product-table drift)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dam_asset_products (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_asset_id uuid        NOT NULL REFERENCES public.dam_assets(id) ON DELETE CASCADE,
  product_sku  text        NOT NULL,
  tagged_by    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  tagged_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dam_asset_products_unique UNIQUE (dam_asset_id, product_sku)
);

CREATE INDEX IF NOT EXISTS idx_dam_asset_products_sku
  ON public.dam_asset_products (product_sku);

CREATE INDEX IF NOT EXISTS idx_dam_asset_products_asset
  ON public.dam_asset_products (dam_asset_id);

-- ------------------------------------------------------------
-- 6) RLS — reuse the 070 role helper
-- ------------------------------------------------------------

ALTER TABLE public.campaign_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_assignments_select ON public.campaign_assignments;
DROP POLICY IF EXISTS campaign_assignments_insert ON public.campaign_assignments;
DROP POLICY IF EXISTS campaign_assignments_update ON public.campaign_assignments;
DROP POLICY IF EXISTS campaign_assignments_delete ON public.campaign_assignments;

CREATE POLICY campaign_assignments_select
  ON public.campaign_assignments FOR SELECT
  USING (
    public.current_user_has_role(ARRAY[
      'Admin','Producer','Post Producer','Designer','Art Director','Creative Director'
    ])
  );

CREATE POLICY campaign_assignments_insert
  ON public.campaign_assignments FOR INSERT
  WITH CHECK (
    public.current_user_has_role(ARRAY['Admin','Producer','Creative Director'])
  );

CREATE POLICY campaign_assignments_update
  ON public.campaign_assignments FOR UPDATE
  USING (
    public.current_user_has_role(ARRAY['Admin','Producer','Creative Director'])
  );

CREATE POLICY campaign_assignments_delete
  ON public.campaign_assignments FOR DELETE
  USING (
    public.current_user_has_role(ARRAY['Admin','Producer','Creative Director'])
  );

ALTER TABLE public.dam_asset_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dam_asset_products_select ON public.dam_asset_products;
DROP POLICY IF EXISTS dam_asset_products_insert ON public.dam_asset_products;
DROP POLICY IF EXISTS dam_asset_products_delete ON public.dam_asset_products;

CREATE POLICY dam_asset_products_select
  ON public.dam_asset_products FOR SELECT
  USING (
    public.current_user_has_role(ARRAY[
      'Admin','Producer','Post Producer','Designer','Art Director','Creative Director','Studio'
    ])
  );

CREATE POLICY dam_asset_products_insert
  ON public.dam_asset_products FOR INSERT
  WITH CHECK (
    -- Photographer uploads run under the Studio role today; Producers
    -- and creative roles can also tag after the fact.
    public.current_user_has_role(ARRAY[
      'Admin','Producer','Post Producer','Studio','Art Director','Creative Director'
    ])
  );

CREATE POLICY dam_asset_products_delete
  ON public.dam_asset_products FOR DELETE
  USING (
    public.current_user_has_role(ARRAY['Admin','Producer','Creative Director'])
  );
