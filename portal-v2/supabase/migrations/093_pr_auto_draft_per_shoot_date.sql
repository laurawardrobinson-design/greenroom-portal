-- ============================================================
-- 093: PR auto-draft per shoot date
-- ============================================================
--
-- Each shoot date on a campaign now auto-prompts a draft PRDoc.
-- Producers can still create additional PRs manually for the same
-- shoot date (useful when, e.g., a second pickup window is needed).
--
-- Model changes:
--   * product_request_docs gains a FK to shoot_dates(id) so the
--     draft tracks the physical shoot-date row, not just its date
--     value. Re-dating a shoot date then flows through to its draft.
--   * The old unique (campaign_id, shoot_date) constraint is dropped
--     — multiple PRs per date are now allowed (1 auto-draft + N manual).
--   * Auto-drafts are created with submitted_by = NULL. RLS is
--     relaxed so Producers/Post Producers can edit an unclaimed
--     draft; on claim, the draft is assigned to the editor
--     (handled app-side, not here).
--
-- Service-side hooks (createShoot / addShootDates) take care of
-- auto-creation + shot-list product sync for new shoot dates. This
-- migration handles the schema, the re-date + cascade triggers, and
-- a one-time backfill for campaigns that already had shoot dates
-- when this feature shipped.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add shoot_date_id FK (nullable — legacy rows allowed)
-- ------------------------------------------------------------
ALTER TABLE public.product_request_docs
  ADD COLUMN IF NOT EXISTS shoot_date_id uuid
    REFERENCES public.shoot_dates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pr_docs_shoot_date_id
  ON public.product_request_docs(shoot_date_id)
  WHERE shoot_date_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Drop the old (campaign_id, shoot_date) uniqueness
--    Multiple PRs per shoot date are now legitimate.
-- ------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_pr_docs_campaign_date;

-- ------------------------------------------------------------
-- 3. Re-date trigger
--    When a shoot_dates row's date value changes, keep any
--    linked PRDocs in sync. Only the denormalized `shoot_date`
--    column needs updating — the FK already points to the row.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pr_docs_sync_shoot_date()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.shoot_date IS DISTINCT FROM OLD.shoot_date THEN
    UPDATE public.product_request_docs
       SET shoot_date = NEW.shoot_date
     WHERE shoot_date_id = NEW.id
       AND status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shoot_dates_sync_pr_docs ON public.shoot_dates;
CREATE TRIGGER shoot_dates_sync_pr_docs
  AFTER UPDATE ON public.shoot_dates
  FOR EACH ROW EXECUTE FUNCTION public.pr_docs_sync_shoot_date();

-- ------------------------------------------------------------
-- 4. Cascade-delete trigger
--    Deleting a shoot_dates row wipes the auto-draft, but keeps
--    any submitted / forwarded / fulfilled PR — those carry
--    historical weight and just lose the FK (ON DELETE SET NULL).
--    A BEFORE trigger so the delete happens while the shoot_date
--    id still resolves; the FK clears itself on the survivors
--    afterwards.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pr_docs_cascade_draft_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.product_request_docs
   WHERE shoot_date_id = OLD.id
     AND status = 'draft';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS shoot_dates_cascade_pr_drafts ON public.shoot_dates;
CREATE TRIGGER shoot_dates_cascade_pr_drafts
  BEFORE DELETE ON public.shoot_dates
  FOR EACH ROW EXECUTE FUNCTION public.pr_docs_cascade_draft_delete();

-- ------------------------------------------------------------
-- 5. Relax RLS — unclaimed drafts are editable by Producers
--    Auto-drafts have submitted_by = NULL until a Producer
--    touches one; the original policy only allowed edits by
--    author / Admin / BMM / Studio, which would lock out the
--    very Producers the feature is built for. The new policy
--    adds: "if this doc is an unclaimed draft, any Producer
--    or Post Producer can update it."
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "pr_docs_update" ON public.product_request_docs;
CREATE POLICY "pr_docs_update" ON public.product_request_docs FOR UPDATE
  USING (
    submitted_by = auth.uid()
    OR (submitted_by IS NULL AND status = 'draft'
        AND public.current_user_has_role(ARRAY['Producer','Post Producer']))
    OR public.current_user_has_role(ARRAY['Admin','Brand Marketing Manager','Studio'])
  )
  WITH CHECK (
    submitted_by = auth.uid()
    OR (submitted_by IS NULL AND status = 'draft'
        AND public.current_user_has_role(ARRAY['Producer','Post Producer']))
    OR public.current_user_has_role(ARRAY['Admin','Brand Marketing Manager','Studio'])
  );

-- Allow insert with submitted_by = NULL when the inserter is an
-- Admin (used by the backfill below; the normal create path still
-- sets submitted_by = auth.uid()).
DROP POLICY IF EXISTS "pr_docs_insert" ON public.product_request_docs;
CREATE POLICY "pr_docs_insert" ON public.product_request_docs FOR INSERT
  WITH CHECK (
    (public.current_user_has_role(ARRAY['Admin','Producer','Post Producer'])
     AND submitted_by = auth.uid())
    OR (submitted_by IS NULL
        AND public.current_user_has_role(ARRAY['Admin']))
  );

-- ------------------------------------------------------------
-- 6. Backfill
--    a) Existing PRDocs → link to their shoot_dates row where
--       (campaign_id, shoot_date) matches. A campaign can have
--       multiple shoots that happen to share a date; pick the
--       earliest-created shoot_date row so the match is
--       deterministic.
--    b) Any shoot_date with no PRDoc → insert an auto-draft.
--       submitted_by stays NULL (unclaimed).
-- ------------------------------------------------------------
WITH ranked_dates AS (
  SELECT sd.id, sd.shoot_date, s.campaign_id,
         ROW_NUMBER() OVER (
           PARTITION BY s.campaign_id, sd.shoot_date
           ORDER BY sd.created_at ASC, sd.id ASC
         ) AS rn
    FROM public.shoot_dates sd
    JOIN public.shoots s ON s.id = sd.shoot_id
)
UPDATE public.product_request_docs d
   SET shoot_date_id = rd.id
  FROM ranked_dates rd
 WHERE d.shoot_date_id IS NULL
   AND d.campaign_id = rd.campaign_id
   AND d.shoot_date = rd.shoot_date
   AND rd.rn = 1;

-- Fast-forward the PR number sequence past any existing doc numbers
-- before the backfill below. (If an existing row was inserted with
-- an explicit doc_number, the sequence is behind reality.)
SELECT setval(
  'product_request_number_seq',
  GREATEST(
    (SELECT COALESCE(MAX(
       NULLIF(regexp_replace(doc_number, '^PR', ''), '')::bigint
     ), 100000) FROM public.product_request_docs),
    (SELECT last_value FROM product_request_number_seq)
  )
);

INSERT INTO public.product_request_docs
  (campaign_id, shoot_date, shoot_date_id, status, submitted_by, notes, doc_number)
SELECT s.campaign_id, sd.shoot_date, sd.id, 'draft', NULL, '', ''
  FROM public.shoot_dates sd
  JOIN public.shoots s ON s.id = sd.shoot_id
  LEFT JOIN public.product_request_docs d
         ON d.shoot_date_id = sd.id
 WHERE d.id IS NULL;

NOTIFY pgrst, 'reload schema';
