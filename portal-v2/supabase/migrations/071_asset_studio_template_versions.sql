-- ============================================================
-- 071: Asset Studio — template versioning
--
-- Sprint 1 shipped templates as a single mutable row. That means
-- editing a layer invalidates the audit story for every variant
-- previously rendered against the "same" template. For brand
-- governance + compliance we want: every run pinned to the exact
-- template snapshot it rendered against, and every published
-- template getting an immutable version record.
--
-- This migration introduces:
--   - template_versions: immutable snapshots of the layer tree +
--     output specs taken at publish time.
--   - variant_runs.template_version_id: each run records which
--     snapshot it ran against.
--   - current_version on templates for quick lookup of the most
--     recently published version.
--
-- Templates themselves stay mutable for active editing (drafts);
-- the snapshot is taken when the Designer publishes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. template_versions — immutable snapshots
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS template_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid REFERENCES templates(id) ON DELETE CASCADE NOT NULL,
  version         int  NOT NULL,
  label           text NOT NULL DEFAULT '',
  notes           text NOT NULL DEFAULT '',
  -- Full snapshot of the template state at publish time.
  -- Shape: { template: {...}, layers: [...], output_specs: [...] }
  snapshot        jsonb NOT NULL,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template
  ON template_versions (template_id, version DESC);

-- ------------------------------------------------------------
-- 2. templates.current_version_id — pointer to latest published
-- ------------------------------------------------------------

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS current_version_id uuid
  REFERENCES template_versions(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 3. variant_runs.template_version_id — pin runs to a snapshot
-- ------------------------------------------------------------

ALTER TABLE variant_runs
  ADD COLUMN IF NOT EXISTS template_version_id uuid
  REFERENCES template_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_variant_runs_template_version
  ON variant_runs (template_version_id);

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------

ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_versions_select" ON template_versions
  FOR SELECT TO authenticated USING (true);

-- Only Designers + Admins can write versions; versions are immutable
-- after create so we don't grant UPDATE / DELETE to anyone except
-- Admin cleanup.
CREATE POLICY "template_versions_insert" ON template_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));

CREATE POLICY "template_versions_delete" ON template_versions
  FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

-- ------------------------------------------------------------
-- 5. Refresh PostgREST
-- ------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
