-- ============================================================
-- 094: Call Sheets — persistence, versioning, distribution
-- ============================================================
--
-- Wave 1 of the Producer Docs plan (PRODUCER_DOCS_IMPLEMENTATION_PLAN.md).
--
-- Replaces the ephemeral React-state Call Sheet with a persisted,
-- versioned, distributable record.
--
-- Model:
--   call_sheets                  ← mutable working draft (one per shoot_date)
--     call_sheet_versions        ← immutable snapshots on publish
--       call_sheet_distributions ← per-recipient delivery + ack
--   call_sheet_attachments       ← releases / permits / COI / safety bulletin
--
-- Content is stored as jsonb so the field set can evolve without
-- migrations (new fields like sunrise, allergen bulletin, company
-- moves are added in the payload, not the schema).
--
-- Auto-draft mirrors the PR 093 pattern: every shoot_date gets an
-- auto-draft call_sheet. Re-dating a shoot_date syncs the
-- denormalized date. Deleting a shoot_date cascades-delete drafts
-- only (published call sheets survive, with null shoot_date_id).
-- ============================================================

-- ------------------------------------------------------------
-- 1. call_sheets — mutable working draft
-- ------------------------------------------------------------
CREATE TABLE public.call_sheets (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  shoot_date_id       uuid        REFERENCES public.shoot_dates(id) ON DELETE SET NULL,
  shoot_date          date        NOT NULL,
  status              text        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','published','archived')),
  content_draft       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  current_version_id  uuid,
  created_by          uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_call_sheets_campaign    ON public.call_sheets(campaign_id);
CREATE INDEX idx_call_sheets_status      ON public.call_sheets(status, shoot_date DESC);
CREATE INDEX idx_call_sheets_shoot_date  ON public.call_sheets(shoot_date_id)
  WHERE shoot_date_id IS NOT NULL;

-- One draft per shoot_date; published sheets can accumulate if the
-- shoot_date was reused, but only one draft can exist.
CREATE UNIQUE INDEX idx_call_sheets_one_draft_per_date
  ON public.call_sheets(shoot_date_id)
  WHERE status = 'draft' AND shoot_date_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_call_sheet_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER call_sheets_touch
  BEFORE UPDATE ON public.call_sheets
  FOR EACH ROW EXECUTE FUNCTION public.touch_call_sheet_updated_at();

-- ------------------------------------------------------------
-- 2. call_sheet_versions — immutable publish snapshots
-- ------------------------------------------------------------
CREATE TABLE public.call_sheet_versions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id   uuid        NOT NULL REFERENCES public.call_sheets(id) ON DELETE CASCADE,
  v_number        integer     NOT NULL,
  payload         jsonb       NOT NULL,
  published_by    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  published_at    timestamptz NOT NULL DEFAULT now(),
  superseded_at   timestamptz,
  UNIQUE (call_sheet_id, v_number)
);

CREATE INDEX idx_call_sheet_versions_sheet
  ON public.call_sheet_versions(call_sheet_id, v_number DESC);

-- Wire current_version_id now that versions table exists.
ALTER TABLE public.call_sheets
  ADD CONSTRAINT call_sheets_current_version_fkey
  FOREIGN KEY (current_version_id)
  REFERENCES public.call_sheet_versions(id)
  ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 3. call_sheet_distributions — per-recipient tracking
-- ------------------------------------------------------------
CREATE TABLE public.call_sheet_distributions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      uuid        NOT NULL REFERENCES public.call_sheet_versions(id) ON DELETE CASCADE,
  recipient_name  text        NOT NULL DEFAULT '',
  recipient_email text        NOT NULL,
  tier            text        NOT NULL CHECK (tier IN ('full','redacted')),
  channel         text        NOT NULL CHECK (channel IN ('email','in_portal')),
  ack_token       text        NOT NULL UNIQUE,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  acked_at        timestamptz,
  sent_by         uuid        REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_call_sheet_dist_version ON public.call_sheet_distributions(version_id);
CREATE INDEX idx_call_sheet_dist_token   ON public.call_sheet_distributions(ack_token);
CREATE INDEX idx_call_sheet_dist_email   ON public.call_sheet_distributions(recipient_email);

-- ------------------------------------------------------------
-- 4. call_sheet_attachments — releases / permits / COI / bulletin
-- ------------------------------------------------------------
CREATE TABLE public.call_sheet_attachments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id   uuid        NOT NULL REFERENCES public.call_sheets(id) ON DELETE CASCADE,
  kind            text        NOT NULL CHECK (kind IN (
                    'talent_release','minor_release','location_permit','coi','safety_bulletin','other'
                  )),
  label           text        NOT NULL DEFAULT '',
  file_url        text        NOT NULL,
  expires_at      date,
  required        boolean     NOT NULL DEFAULT false,
  uploaded_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_call_sheet_attachments_sheet
  ON public.call_sheet_attachments(call_sheet_id);

-- ------------------------------------------------------------
-- 5. Re-date trigger: keep denormalized call_sheets.shoot_date in sync
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.call_sheets_sync_shoot_date()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.shoot_date IS DISTINCT FROM OLD.shoot_date THEN
    UPDATE public.call_sheets
       SET shoot_date = NEW.shoot_date
     WHERE shoot_date_id = NEW.id
       AND status <> 'archived';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shoot_dates_sync_call_sheets ON public.shoot_dates;
CREATE TRIGGER shoot_dates_sync_call_sheets
  AFTER UPDATE ON public.shoot_dates
  FOR EACH ROW EXECUTE FUNCTION public.call_sheets_sync_shoot_date();

-- ------------------------------------------------------------
-- 6. Cascade-delete: remove draft call sheets when shoot_date deleted
--    Published call sheets keep historical value; shoot_date_id
--    clears via ON DELETE SET NULL defined above.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.call_sheets_cascade_draft_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.call_sheets
   WHERE shoot_date_id = OLD.id
     AND status = 'draft';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS shoot_dates_cascade_call_sheet_drafts ON public.shoot_dates;
CREATE TRIGGER shoot_dates_cascade_call_sheet_drafts
  BEFORE DELETE ON public.shoot_dates
  FOR EACH ROW EXECUTE FUNCTION public.call_sheets_cascade_draft_delete();

-- ------------------------------------------------------------
-- 7. Auto-draft trigger: every new shoot_date gets a draft call sheet
--    (Mirrors the PR auto-draft pattern from 093, but DB-side so it
--    fires for seed inserts and service inserts alike.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.call_sheets_auto_draft_on_shoot_date()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  SELECT s.campaign_id INTO v_campaign_id
    FROM public.shoots s
   WHERE s.id = NEW.shoot_id;

  IF v_campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.call_sheets (campaign_id, shoot_date_id, shoot_date, status)
  VALUES (v_campaign_id, NEW.id, NEW.shoot_date, 'draft')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shoot_dates_auto_draft_call_sheet ON public.shoot_dates;
CREATE TRIGGER shoot_dates_auto_draft_call_sheet
  AFTER INSERT ON public.shoot_dates
  FOR EACH ROW EXECUTE FUNCTION public.call_sheets_auto_draft_on_shoot_date();

-- ------------------------------------------------------------
-- 8. RLS
-- ------------------------------------------------------------
ALTER TABLE public.call_sheets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sheet_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sheet_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sheet_attachments   ENABLE ROW LEVEL SECURITY;

-- Reading a call sheet: any portal role on the production team
CREATE POLICY "call_sheets_read" ON public.call_sheets FOR SELECT
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director','Studio',
    'Creative Director','Designer','Brand Marketing Manager'
  ]));

-- Writing a call sheet: producers and admins
CREATE POLICY "call_sheets_write" ON public.call_sheets FOR ALL
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director'
  ]))
  WITH CHECK (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director'
  ]));

-- Versions: read broad, insert producer, update only to supersede
CREATE POLICY "call_sheet_versions_read" ON public.call_sheet_versions FOR SELECT
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director','Studio',
    'Creative Director','Designer','Brand Marketing Manager'
  ]));

CREATE POLICY "call_sheet_versions_insert" ON public.call_sheet_versions FOR INSERT
  WITH CHECK (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director'
  ]));

CREATE POLICY "call_sheet_versions_update" ON public.call_sheet_versions FOR UPDATE
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director'
  ]))
  WITH CHECK (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director'
  ]));

-- Distributions: producers read and write; signed-link endpoint uses
-- service-role client to resolve ack_token without RLS.
CREATE POLICY "call_sheet_dist_read" ON public.call_sheet_distributions FOR SELECT
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director','Studio'
  ]));

CREATE POLICY "call_sheet_dist_write" ON public.call_sheet_distributions FOR ALL
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director'
  ]))
  WITH CHECK (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director'
  ]));

-- Attachments: producers read and write, others read-only
CREATE POLICY "call_sheet_attach_read" ON public.call_sheet_attachments FOR SELECT
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director','Studio',
    'Creative Director','Designer','Brand Marketing Manager'
  ]));

CREATE POLICY "call_sheet_attach_write" ON public.call_sheet_attachments FOR ALL
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director'
  ]))
  WITH CHECK (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Art Director'
  ]));

-- ------------------------------------------------------------
-- 9. Backfill: one auto-draft per existing shoot_date
-- ------------------------------------------------------------
INSERT INTO public.call_sheets (campaign_id, shoot_date_id, shoot_date, status)
SELECT s.campaign_id, sd.id, sd.shoot_date, 'draft'
  FROM public.shoot_dates sd
  JOIN public.shoots s ON s.id = sd.shoot_id
  LEFT JOIN public.call_sheets cs
         ON cs.shoot_date_id = sd.id AND cs.status = 'draft'
 WHERE cs.id IS NULL;

NOTIFY pgrst, 'reload schema';
