-- ============================================================
-- 077: Asset Studio — DAM sync queue + workflow engine v1
--
-- Adds:
--   1) DAM sync queue primitives (job + job items)
--   2) Campaign-native workflow engine primitives
--   3) Default DAM lifecycle workflow definition
--
-- Product constraints:
--   - External DAM remains authoritative
--   - Allowed lifecycle movers: Admin, Art Director, Producer,
--     Post Producer, Designer
--   - Immutable DAM versions remain the source trigger for sync
-- ============================================================

-- ------------------------------------------------------------
-- 1) DAM sync queue
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dam_sync_jobs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dam_asset_id     uuid        NOT NULL REFERENCES public.dam_assets(id) ON DELETE CASCADE,
  latest_version_id uuid       REFERENCES public.dam_asset_versions(id) ON DELETE SET NULL,
  idempotency_key  text        NOT NULL,
  status           text        NOT NULL DEFAULT 'queued',
  attempts         int         NOT NULL DEFAULT 0,
  max_attempts     int         NOT NULL DEFAULT 5,
  next_attempt_at  timestamptz DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  worker_id        text,
  error_message    text,
  metadata         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by       uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dam_sync_jobs_status_check
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT dam_sync_jobs_attempts_check
    CHECK (attempts >= 0),
  CONSTRAINT dam_sync_jobs_max_attempts_check
    CHECK (max_attempts >= 1),
  CONSTRAINT dam_sync_jobs_idempotency_unique
    UNIQUE (idempotency_key)
);

COMMENT ON TABLE public.dam_sync_jobs IS 'Queue jobs that sync DAM asset versions to authoritative external DAM systems.';
COMMENT ON COLUMN public.dam_sync_jobs.idempotency_key IS 'Deterministic key to dedupe repeated enqueue attempts.';

CREATE INDEX IF NOT EXISTS idx_dam_sync_jobs_asset_created
  ON public.dam_sync_jobs (dam_asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dam_sync_jobs_pickup
  ON public.dam_sync_jobs (status, next_attempt_at, created_at)
  WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_dam_sync_jobs_latest_version
  ON public.dam_sync_jobs (latest_version_id)
  WHERE latest_version_id IS NOT NULL;

CREATE TRIGGER set_dam_sync_jobs_updated_at
  BEFORE UPDATE ON public.dam_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.dam_sync_job_items (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid        NOT NULL REFERENCES public.dam_sync_jobs(id) ON DELETE CASCADE,
  dam_asset_id        uuid        NOT NULL REFERENCES public.dam_assets(id) ON DELETE CASCADE,
  dam_asset_version_id uuid       NOT NULL REFERENCES public.dam_asset_versions(id) ON DELETE CASCADE,
  status              text        NOT NULL DEFAULT 'queued',
  attempts            int         NOT NULL DEFAULT 0,
  next_attempt_at     timestamptz DEFAULT now(),
  external_dam_id     text,
  synced_at           timestamptz,
  last_error          text,
  payload             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dam_sync_job_items_status_check
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT dam_sync_job_items_attempts_check
    CHECK (attempts >= 0),
  CONSTRAINT dam_sync_job_items_unique
    UNIQUE (job_id, dam_asset_id, dam_asset_version_id)
);

COMMENT ON TABLE public.dam_sync_job_items IS 'Per-asset-version work items processed by DAM sync workers.';

CREATE INDEX IF NOT EXISTS idx_dam_sync_job_items_job_status
  ON public.dam_sync_job_items (job_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_dam_sync_job_items_asset_created
  ON public.dam_sync_job_items (dam_asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dam_sync_job_items_version
  ON public.dam_sync_job_items (dam_asset_version_id, created_at DESC);

CREATE TRIGGER set_dam_sync_job_items_updated_at
  BEFORE UPDATE ON public.dam_sync_job_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.dam_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dam_sync_job_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dam_sync_jobs_select ON public.dam_sync_jobs;
DROP POLICY IF EXISTS dam_sync_jobs_insert ON public.dam_sync_jobs;
DROP POLICY IF EXISTS dam_sync_jobs_update ON public.dam_sync_jobs;
DROP POLICY IF EXISTS dam_sync_jobs_delete ON public.dam_sync_jobs;

CREATE POLICY dam_sync_jobs_select ON public.dam_sync_jobs
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY dam_sync_jobs_insert ON public.dam_sync_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY dam_sync_jobs_update ON public.dam_sync_jobs
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY dam_sync_jobs_delete ON public.dam_sync_jobs
  FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

DROP POLICY IF EXISTS dam_sync_job_items_select ON public.dam_sync_job_items;
DROP POLICY IF EXISTS dam_sync_job_items_insert ON public.dam_sync_job_items;
DROP POLICY IF EXISTS dam_sync_job_items_update ON public.dam_sync_job_items;
DROP POLICY IF EXISTS dam_sync_job_items_delete ON public.dam_sync_job_items;

CREATE POLICY dam_sync_job_items_select ON public.dam_sync_job_items
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY dam_sync_job_items_insert ON public.dam_sync_job_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY dam_sync_job_items_update ON public.dam_sync_job_items
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY dam_sync_job_items_delete ON public.dam_sync_job_items
  FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

-- ------------------------------------------------------------
-- 2) Workflow engine v1
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.workflow_definitions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key            text        NOT NULL,
  entity_type    text        NOT NULL,
  name           text        NOT NULL,
  version        int         NOT NULL DEFAULT 1,
  description    text        NOT NULL DEFAULT '',
  initial_stage  text        NOT NULL,
  stages         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  transitions    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  is_active      boolean     NOT NULL DEFAULT true,
  metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_definitions_version_check CHECK (version >= 1),
  CONSTRAINT workflow_definitions_key_version_unique UNIQUE (key, version)
);

COMMENT ON TABLE public.workflow_definitions IS 'Reusable workflow configs with stage map and role-gated transitions.';

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active
  ON public.workflow_definitions (entity_type, is_active, created_at DESC);

CREATE TRIGGER set_workflow_definitions_updated_at
  BEFORE UPDATE ON public.workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.workflow_instances (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id  uuid        REFERENCES public.workflow_definitions(id) ON DELETE SET NULL,
  entity_type    text        NOT NULL,
  entity_id      uuid        NOT NULL,
  campaign_id    uuid        REFERENCES public.campaigns(id) ON DELETE SET NULL,
  current_stage  text        NOT NULL,
  status         text        NOT NULL DEFAULT 'active',
  metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  last_event_at  timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_instances_status_check
    CHECK (status IN ('active', 'completed', 'cancelled')),
  CONSTRAINT workflow_instances_entity_unique
    UNIQUE (entity_type, entity_id)
);

COMMENT ON TABLE public.workflow_instances IS 'Current stage/status for each workflow-managed entity.';

CREATE INDEX IF NOT EXISTS idx_workflow_instances_stage
  ON public.workflow_instances (entity_type, status, current_stage, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_campaign
  ON public.workflow_instances (campaign_id, updated_at DESC)
  WHERE campaign_id IS NOT NULL;

CREATE TRIGGER set_workflow_instances_updated_at
  BEFORE UPDATE ON public.workflow_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.workflow_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id    uuid        NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  definition_id  uuid        REFERENCES public.workflow_definitions(id) ON DELETE SET NULL,
  entity_type    text        NOT NULL,
  entity_id      uuid        NOT NULL,
  from_stage     text,
  to_stage       text        NOT NULL,
  action         text        NOT NULL,
  actor_id       uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role     text,
  reason         text,
  metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workflow_events IS 'Immutable transition history for workflow instances.';

CREATE INDEX IF NOT EXISTS idx_workflow_events_instance_created
  ON public.workflow_events (instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_events_entity_created
  ON public.workflow_events (entity_type, entity_id, created_at DESC);

ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_definitions_select ON public.workflow_definitions;
DROP POLICY IF EXISTS workflow_definitions_insert ON public.workflow_definitions;
DROP POLICY IF EXISTS workflow_definitions_update ON public.workflow_definitions;
DROP POLICY IF EXISTS workflow_definitions_delete ON public.workflow_definitions;

CREATE POLICY workflow_definitions_select ON public.workflow_definitions
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY workflow_definitions_insert ON public.workflow_definitions
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin']));

CREATE POLICY workflow_definitions_update ON public.workflow_definitions
  FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

CREATE POLICY workflow_definitions_delete ON public.workflow_definitions
  FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

DROP POLICY IF EXISTS workflow_instances_select ON public.workflow_instances;
DROP POLICY IF EXISTS workflow_instances_insert ON public.workflow_instances;
DROP POLICY IF EXISTS workflow_instances_update ON public.workflow_instances;
DROP POLICY IF EXISTS workflow_instances_delete ON public.workflow_instances;

CREATE POLICY workflow_instances_select ON public.workflow_instances
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY workflow_instances_insert ON public.workflow_instances
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY workflow_instances_update ON public.workflow_instances
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY workflow_instances_delete ON public.workflow_instances
  FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

DROP POLICY IF EXISTS workflow_events_select ON public.workflow_events;
DROP POLICY IF EXISTS workflow_events_insert ON public.workflow_events;
DROP POLICY IF EXISTS workflow_events_update ON public.workflow_events;
DROP POLICY IF EXISTS workflow_events_delete ON public.workflow_events;

CREATE POLICY workflow_events_select ON public.workflow_events
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY workflow_events_insert ON public.workflow_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

-- Immutable events; no update/delete policies by default.

-- ------------------------------------------------------------
-- 3) Seed DAM workflow definition + bootstrap existing assets
-- ------------------------------------------------------------

INSERT INTO public.workflow_definitions (
  key,
  entity_type,
  name,
  version,
  description,
  initial_stage,
  stages,
  transitions,
  is_active,
  metadata
)
SELECT
  'dam_asset_lifecycle_v1',
  'dam_asset',
  'DAM Asset Lifecycle V1',
  1,
  'Default DAM lifecycle for Storyteq-parity prototype',
  'ingested',
  '[
    {"key":"ingested","label":"Ingested","queueRoles":["Producer","Art Director","Admin"]},
    {"key":"retouching","label":"Retouching","queueRoles":["Designer","Post Producer","Art Director"]},
    {"key":"retouched","label":"Retouched","queueRoles":["Art Director","Producer","Admin"]},
    {"key":"versioning","label":"Versioning","queueRoles":["Designer","Post Producer","Art Director"]},
    {"key":"ready_for_activation","label":"Ready For Activation","queueRoles":["Producer","Art Director","Admin"]},
    {"key":"archived","label":"Archived","queueRoles":["Admin"]}
  ]'::jsonb,
  '[
    {
      "action":"start_retouching",
      "label":"Start retouching",
      "kind":"advance",
      "from":"ingested",
      "to":"retouching",
      "roles":["Admin","Art Director","Producer"]
    },
    {
      "action":"mark_retouched",
      "label":"Mark retouched",
      "kind":"advance",
      "from":"retouching",
      "to":"retouched",
      "roles":["Admin","Art Director","Designer","Post Producer"]
    },
    {
      "action":"return_to_retouching",
      "label":"Return to retouching",
      "kind":"return",
      "from":"retouched",
      "to":"retouching",
      "roles":["Admin","Art Director","Producer","Post Producer","Designer"]
    },
    {
      "action":"start_versioning",
      "label":"Move to versioning",
      "kind":"advance",
      "from":"retouched",
      "to":"versioning",
      "roles":["Admin","Art Director","Producer","Post Producer"]
    },
    {
      "action":"reject_to_retouching",
      "label":"Return to retouching",
      "kind":"reject",
      "from":"versioning",
      "to":"retouching",
      "roles":["Admin","Art Director","Producer","Post Producer"]
    },
    {
      "action":"mark_ready_for_activation",
      "label":"Ready for activation",
      "kind":"advance",
      "from":"versioning",
      "to":"ready_for_activation",
      "roles":["Admin","Art Director","Producer","Post Producer"]
    },
    {
      "action":"return_to_versioning",
      "label":"Return to versioning",
      "kind":"return",
      "from":"ready_for_activation",
      "to":"versioning",
      "roles":["Admin","Art Director","Producer","Post Producer"]
    },
    {
      "action":"archive_asset",
      "label":"Archive",
      "kind":"advance",
      "from":"ready_for_activation",
      "to":"archived",
      "roles":["Admin","Art Director","Producer"]
    }
  ]'::jsonb,
  true,
  '{"system": "asset_studio", "seeded_by": "077_asset_studio_dam_sync_and_workflow"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.workflow_definitions
  WHERE key = 'dam_asset_lifecycle_v1'
    AND version = 1
);

WITH active_def AS (
  SELECT id
  FROM public.workflow_definitions
  WHERE key = 'dam_asset_lifecycle_v1'
    AND entity_type = 'dam_asset'
    AND is_active = true
  ORDER BY version DESC
  LIMIT 1
), inserted_instances AS (
  INSERT INTO public.workflow_instances (
    definition_id,
    entity_type,
    entity_id,
    campaign_id,
    current_stage,
    status,
    metadata,
    last_event_at
  )
  SELECT
    active_def.id,
    'dam_asset',
    assets.id,
    assets.campaign_id,
    assets.status,
    CASE WHEN assets.status = 'archived' THEN 'completed' ELSE 'active' END,
    '{"bootstrapped": true, "source": "migration_077"}'::jsonb,
    now()
  FROM public.dam_assets assets
  CROSS JOIN active_def
  LEFT JOIN public.workflow_instances existing
    ON existing.entity_type = 'dam_asset'
   AND existing.entity_id = assets.id
  WHERE existing.id IS NULL
  RETURNING id, definition_id, entity_type, entity_id, current_stage
)
INSERT INTO public.workflow_events (
  instance_id,
  definition_id,
  entity_type,
  entity_id,
  from_stage,
  to_stage,
  action,
  actor_id,
  actor_role,
  reason,
  metadata
)
SELECT
  id,
  definition_id,
  entity_type,
  entity_id,
  NULL,
  current_stage,
  'bootstrapped',
  NULL,
  NULL,
  'Workflow instance created from existing DAM asset state',
  '{"source": "migration_077"}'::jsonb
FROM inserted_instances;

-- ------------------------------------------------------------
-- 4) Refresh schema cache
-- ------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
