-- ============================================================
-- 068: Asset Studio core
-- Adds Designer role + brand tokens + templates + variant runs.
--
-- Design intent (mirrors greenroom-asset-studio-plan.md):
--   - brand_tokens: versioned, single-active-per-brand design system.
--   - templates + template_layers + template_output_specs: a template
--     is a layout with N layers and renders to M output sizes.
--   - variant_runs + variants: a run binds a template to a data source
--     (campaign products) and emits one variant per (product × output_spec).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Designer role
-- ------------------------------------------------------------

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Designer';

-- ------------------------------------------------------------
-- 2. brand_tokens — versioned design system per brand
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS brand_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand       text NOT NULL DEFAULT 'Publix',
  version     int  NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,
  tokens      jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes       text NOT NULL DEFAULT '',
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand, version)
);

-- Only one active version per brand.
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_tokens_active_per_brand
  ON brand_tokens (brand)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_brand_tokens_brand ON brand_tokens (brand);

CREATE TRIGGER set_brand_tokens_updated_at
  BEFORE UPDATE ON brand_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 3. templates — design templates that produce variants
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'draft',
  category        text NOT NULL DEFAULT 'general',
  brand_tokens_id uuid REFERENCES brand_tokens(id) ON DELETE SET NULL,
  thumbnail_url   text,
  -- Canvas: layers position via percentages, but the canvas itself
  -- has a nominal aspect for the editor preview.
  canvas_width    int NOT NULL DEFAULT 1080,
  canvas_height   int NOT NULL DEFAULT 1080,
  background_color text NOT NULL DEFAULT '#FFFFFF',
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_status_check
    CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_templates_status      ON templates (status);
CREATE INDEX IF NOT EXISTS idx_templates_created_by  ON templates (created_by);

CREATE TRIGGER set_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 4. template_layers — text / image / logo layers
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS template_layers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid REFERENCES templates(id) ON DELETE CASCADE NOT NULL,
  name          text NOT NULL,
  layer_type    text NOT NULL,
  is_dynamic    boolean NOT NULL DEFAULT false,
  is_locked     boolean NOT NULL DEFAULT false,
  -- Where the value comes from when is_dynamic = true.
  -- Examples: 'product.image_url', 'product.name', 'product.price', 'shot.talent[0].name'.
  data_binding  text NOT NULL DEFAULT '',
  -- Static fallback / default value (text content, image url, logo url).
  static_value  text NOT NULL DEFAULT '',
  -- Layout (percentages of canvas)
  x_pct         numeric(7,3) NOT NULL DEFAULT 0,
  y_pct         numeric(7,3) NOT NULL DEFAULT 0,
  width_pct     numeric(7,3) NOT NULL DEFAULT 100,
  height_pct    numeric(7,3) NOT NULL DEFAULT 100,
  rotation_deg  numeric(7,3) NOT NULL DEFAULT 0,
  z_index       int NOT NULL DEFAULT 0,
  sort_order    int NOT NULL DEFAULT 0,
  -- Free-form layer style: font_size, font_weight, color, fit ('cover' | 'contain'), etc.
  props         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_layer_type_check
    CHECK (layer_type IN ('text', 'image', 'logo', 'shape'))
);

CREATE INDEX IF NOT EXISTS idx_template_layers_template
  ON template_layers (template_id, sort_order);

CREATE TRIGGER set_template_layers_updated_at
  BEFORE UPDATE ON template_layers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 5. template_output_specs — output sizes the template renders to
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS template_output_specs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES templates(id) ON DELETE CASCADE NOT NULL,
  label       text NOT NULL,
  width       int NOT NULL,
  height      int NOT NULL,
  channel     text NOT NULL DEFAULT '',
  format      text NOT NULL DEFAULT 'png',
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_output_format_check
    CHECK (format IN ('png', 'jpg', 'webp'))
);

CREATE INDEX IF NOT EXISTS idx_template_output_specs_template
  ON template_output_specs (template_id, sort_order);

-- ------------------------------------------------------------
-- 6. variant_runs — a batch of variant generations
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS variant_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id        uuid REFERENCES templates(id) ON DELETE SET NULL,
  campaign_id        uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  name               text NOT NULL,
  status             text NOT NULL DEFAULT 'queued',
  total_variants     int  NOT NULL DEFAULT 0,
  completed_variants int  NOT NULL DEFAULT 0,
  failed_variants    int  NOT NULL DEFAULT 0,
  -- Free-form: which products, which output specs, copy overrides, etc.
  bindings           jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes              text NOT NULL DEFAULT '',
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  started_at         timestamptz,
  completed_at       timestamptz,
  CONSTRAINT variant_run_status_check
    CHECK (status IN ('queued', 'rendering', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_variant_runs_template  ON variant_runs (template_id);
CREATE INDEX IF NOT EXISTS idx_variant_runs_campaign  ON variant_runs (campaign_id);
CREATE INDEX IF NOT EXISTS idx_variant_runs_status    ON variant_runs (status);
CREATE INDEX IF NOT EXISTS idx_variant_runs_created_at ON variant_runs (created_at DESC);

CREATE TRIGGER set_variant_runs_updated_at
  BEFORE UPDATE ON variant_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 7. variants — individual rendered assets
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS variants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              uuid REFERENCES variant_runs(id) ON DELETE CASCADE NOT NULL,
  template_id         uuid REFERENCES templates(id) ON DELETE SET NULL,
  output_spec_id      uuid REFERENCES template_output_specs(id) ON DELETE SET NULL,
  campaign_product_id uuid REFERENCES campaign_products(id) ON DELETE SET NULL,
  -- Snapshotted output dimensions so variants survive output spec deletion.
  width               int NOT NULL,
  height              int NOT NULL,
  status              text NOT NULL DEFAULT 'pending',
  asset_url           text,
  storage_path        text,
  thumbnail_url       text,
  bindings            jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message       text,
  approved_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at         timestamptz,
  rejected_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  rejected_at         timestamptz,
  rejection_reason    text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT variant_status_check
    CHECK (status IN ('pending', 'rendering', 'rendered', 'approved', 'rejected', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_variants_run          ON variants (run_id);
CREATE INDEX IF NOT EXISTS idx_variants_template     ON variants (template_id);
CREATE INDEX IF NOT EXISTS idx_variants_status       ON variants (status);
CREATE INDEX IF NOT EXISTS idx_variants_product      ON variants (campaign_product_id);

CREATE TRIGGER set_variants_updated_at
  BEFORE UPDATE ON variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

ALTER TABLE brand_tokens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_layers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_output_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants              ENABLE ROW LEVEL SECURITY;

-- brand_tokens
-- Read: any authenticated user (so client renders can reference colors)
-- Write: Designer + Admin
CREATE POLICY "brand_tokens_select" ON brand_tokens FOR SELECT TO authenticated USING (true);
CREATE POLICY "brand_tokens_insert" ON brand_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Designer'));
CREATE POLICY "brand_tokens_update" ON brand_tokens FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Designer'));
CREATE POLICY "brand_tokens_delete" ON brand_tokens FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin'));

-- templates
-- Read: anyone in the production team
-- Write: Designer + Admin + Producer + Post Producer
CREATE POLICY "templates_select" ON templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates_insert" ON templates FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer'));
CREATE POLICY "templates_update" ON templates FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer'));
CREATE POLICY "templates_delete" ON templates FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Designer'));

-- template_layers
CREATE POLICY "template_layers_select" ON template_layers FOR SELECT TO authenticated USING (true);
CREATE POLICY "template_layers_insert" ON template_layers FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer'));
CREATE POLICY "template_layers_update" ON template_layers FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer'));
CREATE POLICY "template_layers_delete" ON template_layers FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer'));

-- template_output_specs
CREATE POLICY "template_output_specs_select" ON template_output_specs FOR SELECT TO authenticated USING (true);
CREATE POLICY "template_output_specs_insert" ON template_output_specs FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer'));
CREATE POLICY "template_output_specs_update" ON template_output_specs FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer'));
CREATE POLICY "template_output_specs_delete" ON template_output_specs FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer'));

-- variant_runs
-- Read: anyone authenticated
-- Write: Producer / Admin / Post Producer / Designer (Designer can also kick runs to test)
CREATE POLICY "variant_runs_select" ON variant_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "variant_runs_insert" ON variant_runs FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer'));
CREATE POLICY "variant_runs_update" ON variant_runs FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer'));
CREATE POLICY "variant_runs_delete" ON variant_runs FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin'));

-- variants
-- Read: anyone authenticated
-- Approve/reject/update: Admin + Producer + Post Producer (and Designer for QA)
CREATE POLICY "variants_select" ON variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "variants_insert" ON variants FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer'));
CREATE POLICY "variants_update" ON variants FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer'));
CREATE POLICY "variants_delete" ON variants FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin'));
