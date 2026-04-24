-- ============================================================
-- 095: Shot approval workflow + user campaign preferences
-- ============================================================
--
-- Wave 2 of the Producer Docs plan.
--
-- Adds approval state, variant / orientation / retouch metadata,
-- and a frozen approved_snapshot jsonb to shot_list_shots so
-- Creative Director approvals are auditable and survive edits.
--
-- Creates user_campaign_preferences for the Shot List density
-- toggle (Detailed / On Set) — persisted per user per campaign
-- so a producer doing prep and a producer on set default to
-- different views of the same data.
-- ============================================================

-- ------------------------------------------------------------
-- 1. New columns on shot_list_shots
-- ------------------------------------------------------------
ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS variant_type text
    CHECK (variant_type IS NULL OR variant_type IN ('hero_still','motion','social_vertical','other'));

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS orientation text
    CHECK (orientation IS NULL OR orientation IN ('horizontal','vertical','square','custom'));

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS retouch_level text
    CHECK (retouch_level IS NULL OR retouch_level IN ('comp','light','heavy'));

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS hero_sku text;

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS is_hero boolean NOT NULL DEFAULT false;

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS approved_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS approved_snapshot jsonb;

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS needs_reapproval boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 2. Staleness trigger
--    When an approved shot's load-bearing fields change
--    (description, reference_image, setup, media_type, priority,
--    retouch_level, orientation, variant_type), flip
--    needs_reapproval = true. Changes to duration, sort order,
--    notes, completed_at, scheduling metadata do NOT invalidate.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shot_list_check_approval_staleness()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Only care about rows that are currently approved and not already stale
  IF OLD.approved_at IS NULL OR OLD.needs_reapproval THEN
    RETURN NEW;
  END IF;

  -- If the user is explicitly clearing/overwriting approval state,
  -- don't stomp on that
  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RETURN NEW;
  END IF;

  IF NEW.description         IS DISTINCT FROM OLD.description
  OR NEW.reference_image_url IS DISTINCT FROM OLD.reference_image_url
  OR NEW.setup_id            IS DISTINCT FROM OLD.setup_id
  OR NEW.media_type          IS DISTINCT FROM OLD.media_type
  OR NEW.priority            IS DISTINCT FROM OLD.priority
  OR NEW.retouch_level       IS DISTINCT FROM OLD.retouch_level
  OR NEW.orientation         IS DISTINCT FROM OLD.orientation
  OR NEW.variant_type        IS DISTINCT FROM OLD.variant_type
  THEN
    NEW.needs_reapproval := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shot_list_shots_approval_staleness ON public.shot_list_shots;
CREATE TRIGGER shot_list_shots_approval_staleness
  BEFORE UPDATE ON public.shot_list_shots
  FOR EACH ROW EXECUTE FUNCTION public.shot_list_check_approval_staleness();

-- ------------------------------------------------------------
-- 3. user_campaign_preferences
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_campaign_preferences (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id          uuid        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  shot_list_density    text        NOT NULL DEFAULT 'detailed'
                       CHECK (shot_list_density IN ('detailed','on_set')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_ucp_user ON public.user_campaign_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_ucp_campaign ON public.user_campaign_preferences(campaign_id);

CREATE OR REPLACE FUNCTION public.touch_user_campaign_preferences_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS ucp_touch ON public.user_campaign_preferences;
CREATE TRIGGER ucp_touch
  BEFORE UPDATE ON public.user_campaign_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_campaign_preferences_updated_at();

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------
ALTER TABLE public.user_campaign_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ucp_select_own" ON public.user_campaign_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ucp_insert_own" ON public.user_campaign_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ucp_update_own" ON public.user_campaign_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ucp_delete_own" ON public.user_campaign_preferences FOR DELETE
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
