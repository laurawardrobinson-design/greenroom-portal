-- ============================================================
-- Migration 040: Art Director assignment on campaigns
-- Adds art_director_id field to campaigns (mirrors producer_id)
-- ============================================================

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS art_director_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_art_director ON public.campaigns(art_director_id);

-- Update the enriched campaigns RPC to include producer_id and art_director_id
DROP FUNCTION IF EXISTS public.get_campaigns_enriched();

CREATE FUNCTION public.get_campaigns_enriched()
RETURNS TABLE(
  id uuid, wf_number text, name text, brand text,
  status campaign_status,
  production_budget numeric, budget_pool_id uuid,
  assets_delivery_date date, notes text, created_by uuid,
  created_at timestamptz, updated_at timestamptz,
  producer_id uuid, art_director_id uuid,
  next_shoot_date date, shoot_count bigint, vendor_count bigint
) AS $$
  SELECT
    c.id, c.wf_number, c.name, c.brand,
    c.status,
    c.production_budget, c.budget_pool_id,
    c.assets_delivery_date, c.notes, c.created_by,
    c.created_at, c.updated_at,
    c.producer_id, c.art_director_id,
    (SELECT MIN(sd.shoot_date) FROM shoot_dates sd
     JOIN shoots s ON s.id = sd.shoot_id
     WHERE s.campaign_id = c.id AND sd.shoot_date >= CURRENT_DATE) as next_shoot_date,
    (SELECT COUNT(DISTINCT s.id) FROM shoots s WHERE s.campaign_id = c.id) as shoot_count,
    (SELECT COUNT(*) FROM campaign_vendors cv WHERE cv.campaign_id = c.id) as vendor_count
  FROM campaigns c;
$$ LANGUAGE sql STABLE;
