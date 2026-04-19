-- ============================================================
-- 074: Asset Studio — Render Queue Foundation
--
-- Phase 1 (no-publish-first):
--   - Add async render queue primitives:
--       * render_jobs
--       * render_job_items
--   - Add indexes for run/job polling and worker pickup.
--   - Add RLS policies aligned to the Asset Studio role model.
--
-- No delivery/publish connectors in this phase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. render_jobs
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.render_jobs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid        REFERENCES public.variant_runs(id) ON DELETE CASCADE NOT NULL,
  priority       int         NOT NULL DEFAULT 100,
  status         text        NOT NULL DEFAULT 'queued',
  queued_at      timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz,
  completed_at   timestamptz,
  error_message  text,
  created_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT render_jobs_status_check
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_render_jobs_run_created
  ON public.render_jobs (run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_render_jobs_status_queued
  ON public.render_jobs (status, queued_at)
  WHERE status IN ('queued', 'processing');

CREATE INDEX IF NOT EXISTS idx_render_jobs_created_by
  ON public.render_jobs (created_by, created_at DESC);

CREATE TRIGGER set_render_jobs_updated_at
  BEFORE UPDATE ON public.render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 2. render_job_items
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.render_job_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid        REFERENCES public.render_jobs(id) ON DELETE CASCADE NOT NULL,
  variant_id     uuid        REFERENCES public.variants(id) ON DELETE CASCADE NOT NULL,
  status         text        NOT NULL DEFAULT 'queued',
  attempts       int         NOT NULL DEFAULT 0,
  worker_id      text,
  last_error     text,
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT render_job_items_status_check
    CHECK (status IN ('queued', 'rendering', 'rendered', 'failed', 'skipped')),
  CONSTRAINT render_job_items_attempts_check
    CHECK (attempts >= 0),
  CONSTRAINT render_job_items_job_variant_unique
    UNIQUE (job_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_render_job_items_job_status
  ON public.render_job_items (job_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_render_job_items_variant
  ON public.render_job_items (variant_id);

CREATE TRIGGER set_render_job_items_updated_at
  BEFORE UPDATE ON public.render_job_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------

ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_job_items ENABLE ROW LEVEL SECURITY;

-- render_jobs
DROP POLICY IF EXISTS render_jobs_select ON public.render_jobs;
DROP POLICY IF EXISTS render_jobs_insert ON public.render_jobs;
DROP POLICY IF EXISTS render_jobs_update ON public.render_jobs;
DROP POLICY IF EXISTS render_jobs_delete ON public.render_jobs;

CREATE POLICY render_jobs_select ON public.render_jobs
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY render_jobs_insert ON public.render_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']
    )
  );

CREATE POLICY render_jobs_update ON public.render_jobs
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']
    )
  );

CREATE POLICY render_jobs_delete ON public.render_jobs
  FOR DELETE TO authenticated
  USING (
    public.current_user_has_role(ARRAY['Admin'])
  );

-- render_job_items
DROP POLICY IF EXISTS render_job_items_select ON public.render_job_items;
DROP POLICY IF EXISTS render_job_items_insert ON public.render_job_items;
DROP POLICY IF EXISTS render_job_items_update ON public.render_job_items;
DROP POLICY IF EXISTS render_job_items_delete ON public.render_job_items;

CREATE POLICY render_job_items_select ON public.render_job_items
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

CREATE POLICY render_job_items_insert ON public.render_job_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']
    )
  );

CREATE POLICY render_job_items_update ON public.render_job_items
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']
    )
  );

CREATE POLICY render_job_items_delete ON public.render_job_items
  FOR DELETE TO authenticated
  USING (
    public.current_user_has_role(ARRAY['Admin'])
  );

-- ------------------------------------------------------------
-- 4. Tell PostgREST to refresh
-- ------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
