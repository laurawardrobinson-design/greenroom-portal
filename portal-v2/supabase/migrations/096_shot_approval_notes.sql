-- ============================================================
-- 096: Shot CD sign-off notes
-- ============================================================
--
-- Adds a CD-only free-text note that rides along with the
-- sign-off state. Producer / Art Director can see the note in
-- the shot list popover but cannot edit it. Notes are cleared
-- when the CD revokes sign-off so they never outlive the
-- approval snapshot they were written against.
-- ============================================================

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS approval_notes text NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';
