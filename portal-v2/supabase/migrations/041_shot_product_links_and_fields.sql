-- ============================================================
-- Migration 041: Shot ↔ Product linking + new shot fields
-- Adds shot_product_links join table (like shot_deliverable_links)
-- and new columns: surface, lighting, food_styling, priority,
-- retouching_notes on shot_list_shots.
-- ============================================================

-- New shot fields
ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS surface text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lighting text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS food_styling text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS retouching_notes text NOT NULL DEFAULT '';

-- Shot ↔ Product join table
CREATE TABLE public.shot_product_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id uuid NOT NULL REFERENCES shot_list_shots(id) ON DELETE CASCADE,
  campaign_product_id uuid NOT NULL REFERENCES campaign_products(id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '',
  quantity text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shot_id, campaign_product_id)
);

-- Indexes
CREATE INDEX idx_shot_product_links_shot ON shot_product_links(shot_id);
CREATE INDEX idx_shot_product_links_product ON shot_product_links(campaign_product_id);
