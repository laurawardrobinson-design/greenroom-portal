-- ============================================================
-- 092: BMM desk department
-- ============================================================
--
-- Each Brand Marketing Manager has a "desk" assignment — the one
-- RBU department they own the weekly conversation with. They still
-- plan campaigns across every department; the desk just determines
-- which items on their home page are highlighted as "mine."
--
-- Stored on users.desk_department (nullable) so the field can be
-- reused if Admin or other roles ever need a desk affiliation.
-- Constrained to the same department set used by
-- product_request_dept_sections (migration 085) so the two stay in
-- lockstep as the taxonomy evolves.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS desk_department text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_desk_department_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_desk_department_check
      CHECK (desk_department IS NULL OR desk_department IN (
        'Bakery','Produce','Deli','Meat-Seafood','Grocery'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_desk_department
  ON public.users(desk_department)
  WHERE desk_department IS NOT NULL;

-- Seed the Bakery desk for the lone Brand Marketing Manager we
-- currently have. When additional BMMs land, Admin assigns their
-- desk from the Settings → user management screen.
UPDATE public.users
  SET desk_department = 'Bakery'
  WHERE role = 'Brand Marketing Manager'
    AND desk_department IS NULL;

NOTIFY pgrst, 'reload schema';
