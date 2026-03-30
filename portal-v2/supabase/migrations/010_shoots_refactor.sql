-- ============================================================
-- Migration 010: Shoots Refactor
-- Promotes shoots to first-class entities under campaigns.
-- Replaces flat shoot_days + campaign_crew with:
--   shoots → shoot_dates (flexible date patterns)
--   shoots → shoot_crew  (crew per shoot, not per campaign)
-- Also drops UNIQUE(campaign_id, vendor_id) on campaign_vendors
-- to allow multiple POs per vendor per campaign.
-- ============================================================

-- ============================================================
-- 1. Create shoot_type enum
-- ============================================================

CREATE TYPE shoot_type AS ENUM ('Photo', 'Video', 'Hybrid', 'Other');

-- ============================================================
-- 2. Create new tables
-- ============================================================

-- Shoots: a named shoot under a campaign
CREATE TABLE public.shoots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  shoot_type shoot_type NOT NULL DEFAULT 'Photo',
  location text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  crew_varies_by_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Shoot dates: individual dates for a shoot
-- Handles single day, date ranges (as individual rows), and scattered dates
CREATE TABLE public.shoot_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_id uuid NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
  shoot_date date NOT NULL,
  call_time time,
  location text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shoot_id, shoot_date)
);

-- Shoot crew: crew assigned per-shoot
CREATE TABLE public.shoot_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_id uuid NOT NULL REFERENCES shoots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shoot_date_id uuid REFERENCES shoot_dates(id) ON DELETE CASCADE,
  role_on_shoot text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Migrate existing data
-- ============================================================

-- For each campaign that has shoot_days, create one default shoot
INSERT INTO shoots (id, campaign_id, name, shoot_type, location, notes, sort_order)
SELECT
  gen_random_uuid(),
  sd.campaign_id,
  'Shoot',
  'Photo',
  COALESCE((
    SELECT location FROM shoot_days
    WHERE campaign_id = sd.campaign_id AND location != ''
    LIMIT 1
  ), ''),
  '',
  0
FROM (SELECT DISTINCT campaign_id FROM shoot_days) sd;

-- Move dates into shoot_dates
INSERT INTO shoot_dates (shoot_id, shoot_date, call_time, location, notes)
SELECT
  s.id,
  sd.shoot_date,
  CASE
    WHEN sd.call_time ~ '^\d{1,2}:\d{2}' THEN sd.call_time::time
    ELSE NULL
  END,
  COALESCE(sd.location, ''),
  COALESCE(sd.notes, '')
FROM shoot_days sd
JOIN shoots s ON s.campaign_id = sd.campaign_id;

-- Move campaign_crew into shoot_crew (assign to every shoot on their campaign)
INSERT INTO shoot_crew (shoot_id, user_id, role_on_shoot, notes)
SELECT s.id, cc.user_id, cc.role_on_shoot, cc.notes
FROM campaign_crew cc
JOIN shoots s ON s.campaign_id = cc.campaign_id
ON CONFLICT (shoot_id, user_id) DO NOTHING;

-- ============================================================
-- 4. Drop UNIQUE constraint on campaign_vendors
-- Allows multiple POs per vendor per campaign
-- ============================================================

ALTER TABLE public.campaign_vendors DROP CONSTRAINT IF EXISTS campaign_vendors_campaign_id_vendor_id_key;

-- ============================================================
-- 5. Update Studio RLS to use shoot_crew instead of campaign_crew
-- ============================================================

DROP POLICY IF EXISTS "campaigns_studio" ON public.campaigns;
CREATE POLICY "campaigns_studio" ON public.campaigns FOR SELECT
  USING (
    get_my_role() = 'Studio'
    AND id IN (
      SELECT s.campaign_id FROM shoots s
      JOIN shoot_crew sc ON sc.shoot_id = s.id
      WHERE sc.user_id = auth.uid()
    )
  );

-- Update assets policy for Studio too
DROP POLICY IF EXISTS "assets_studio" ON public.campaign_assets;
CREATE POLICY "assets_studio" ON public.campaign_assets FOR SELECT
  USING (
    get_my_role() = 'Studio'
    AND campaign_id IN (
      SELECT s.campaign_id FROM shoots s
      JOIN shoot_crew sc ON sc.shoot_id = s.id
      WHERE sc.user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. Drop old tables and their RLS policies
-- ============================================================

DROP POLICY IF EXISTS "shoot_days_select" ON public.shoot_days;
DROP POLICY IF EXISTS "shoot_days_modify" ON public.shoot_days;
DROP TABLE public.shoot_days;

DROP POLICY IF EXISTS "crew_select" ON public.campaign_crew;
DROP POLICY IF EXISTS "crew_modify" ON public.campaign_crew;
DROP TABLE public.campaign_crew;

-- ============================================================
-- 7. RLS on new tables
-- ============================================================

ALTER TABLE public.shoots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoot_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoot_crew ENABLE ROW LEVEL SECURITY;

-- Shoots: follow campaign access (leverages campaigns RLS)
CREATE POLICY "shoots_select" ON public.shoots FOR SELECT
  USING (campaign_id IN (SELECT id FROM campaigns));

CREATE POLICY "shoots_modify" ON public.shoots FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- Shoot dates: follow shoots → campaigns access
CREATE POLICY "shoot_dates_select" ON public.shoot_dates FOR SELECT
  USING (shoot_id IN (SELECT id FROM shoots));

CREATE POLICY "shoot_dates_modify" ON public.shoot_dates FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- Shoot crew: follow shoots → campaigns access
CREATE POLICY "shoot_crew_select" ON public.shoot_crew FOR SELECT
  USING (shoot_id IN (SELECT id FROM shoots));

CREATE POLICY "shoot_crew_modify" ON public.shoot_crew FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- ============================================================
-- 8. Indexes
-- ============================================================

CREATE INDEX idx_shoots_campaign ON shoots(campaign_id);
CREATE INDEX idx_shoot_dates_shoot ON shoot_dates(shoot_id);
CREATE INDEX idx_shoot_dates_date ON shoot_dates(shoot_date);
CREATE INDEX idx_shoot_crew_shoot ON shoot_crew(shoot_id);
CREATE INDEX idx_shoot_crew_user ON shoot_crew(user_id);

-- ============================================================
-- 9. Triggers
-- ============================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.shoots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 10. Enriched campaigns query for list page
-- Returns campaigns with next shoot date, shoot count, vendor count
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_campaigns_enriched()
RETURNS TABLE(
  id uuid, wf_number text, name text, brand text,
  status campaign_status,
  production_budget numeric, budget_pool_id uuid,
  assets_delivery_date date, notes text, created_by uuid,
  created_at timestamptz, updated_at timestamptz,
  next_shoot_date date, shoot_count bigint, vendor_count bigint
) AS $$
  SELECT
    c.id, c.wf_number, c.name, c.brand,
    c.status,
    c.production_budget, c.budget_pool_id,
    c.assets_delivery_date, c.notes, c.created_by,
    c.created_at, c.updated_at,
    (SELECT MIN(sd.shoot_date) FROM shoot_dates sd
     JOIN shoots s ON s.id = sd.shoot_id
     WHERE s.campaign_id = c.id AND sd.shoot_date >= CURRENT_DATE) as next_shoot_date,
    (SELECT COUNT(DISTINCT s.id) FROM shoots s WHERE s.campaign_id = c.id) as shoot_count,
    (SELECT COUNT(*) FROM campaign_vendors cv WHERE cv.campaign_id = c.id) as vendor_count
  FROM campaigns c;
$$ LANGUAGE sql STABLE;
