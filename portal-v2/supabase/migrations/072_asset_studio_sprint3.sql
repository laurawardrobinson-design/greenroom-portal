-- ============================================================
-- 072: Asset Studio Sprint 3
--
-- Three things:
--   1. Add 'Art Director' to the user_role enum so it can be used
--      in the approval gate (it already exists in the TS UserRole
--      type — this closes the drift).
--   2. Create the asset_studio_audit_log table — immutable
--      append-only record of actions taken on templates, runs, and
--      variants (approvals, rejections, publishes, restores, etc).
--   3. NOTIFY pgrst so PostgREST refreshes its schema cache.
--
-- Uses the public.current_user_has_role(text[]) helper installed
-- in 070. Do NOT write role checks inline against auth.jwt().
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add Art Director to user_role enum
-- ------------------------------------------------------------

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Art Director';

-- ------------------------------------------------------------
-- 2. asset_studio_audit_log
-- ------------------------------------------------------------
--
-- target_type values: 'variant' | 'variant_run' | 'template' | 'brand_tokens'
-- action values:
--   variant:       'approved' | 'rejected' | 'bulk_approved'
--   variant_run:   'created'  | 'rendered' | 'completed' | 'cancelled'
--   template:      'created'  | 'published' | 'version_saved' | 'version_restored'
--   brand_tokens:  'published'
-- (Kept as text rather than an enum so new actions can land without migrations.)

CREATE TABLE IF NOT EXISTS public.asset_studio_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role    text,                                    -- snapshot at time of action
  target_type   text        NOT NULL,
  target_id     uuid        NOT NULL,
  action        text        NOT NULL,
  reason        text,                                    -- e.g. rejection reason
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_studio_audit_target
  ON public.asset_studio_audit_log (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_studio_audit_actor
  ON public.asset_studio_audit_log (actor_id, created_at DESC);

ALTER TABLE public.asset_studio_audit_log ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated asset-studio user can see the log
CREATE POLICY asset_studio_audit_select ON public.asset_studio_audit_log
  FOR SELECT
  USING (
    public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

-- Insert: any authenticated asset-studio user can write their own rows
-- (actor_id must match the caller; keeps the log honest)
CREATE POLICY asset_studio_audit_insert ON public.asset_studio_audit_log
  FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND public.current_user_has_role(
      ARRAY['Admin', 'Producer', 'Post Producer', 'Designer', 'Art Director']
    )
  );

-- No UPDATE / DELETE policies — rows are immutable by omission.
-- (Supabase denies any action that doesn't match at least one policy.)

-- ------------------------------------------------------------
-- 3. Tell PostgREST to reload its schema cache
-- ------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
