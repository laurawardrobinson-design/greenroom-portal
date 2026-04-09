-- Add food, props, and gear counts to get_campaigns_enriched
DROP FUNCTION IF EXISTS public.get_campaigns_enriched();

CREATE FUNCTION public.get_campaigns_enriched()
RETURNS TABLE(
  id uuid, wf_number text, name text, brand text,
  status campaign_status,
  production_budget numeric, budget_pool_id uuid,
  assets_delivery_date date, notes text, created_by uuid,
  created_at timestamptz, updated_at timestamptz,
  producer_id uuid, art_director_id uuid,
  next_shoot_date date, shoot_count bigint, vendor_count bigint,
  food_count bigint, props_count bigint, gear_count bigint
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
    (SELECT COUNT(*) FROM campaign_vendors cv WHERE cv.campaign_id = c.id) as vendor_count,
    (SELECT COUNT(*) FROM campaign_products cp WHERE cp.campaign_id = c.id) as food_count,
    (SELECT COUNT(*) FROM campaign_gear cg JOIN gear_items gi ON gi.id = cg.gear_item_id WHERE cg.campaign_id = c.id AND gi.section = 'Props') as props_count,
    (SELECT COUNT(*) FROM campaign_gear cg JOIN gear_items gi ON gi.id = cg.gear_item_id WHERE cg.campaign_id = c.id AND gi.section = 'Gear') as gear_count
  FROM campaigns c
  WHERE c.deleted_at IS NULL;
$$ LANGUAGE sql STABLE;
