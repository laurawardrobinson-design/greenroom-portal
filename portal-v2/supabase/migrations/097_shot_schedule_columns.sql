-- Restore schedule columns on shot_list_shots that were declared in migration 024
-- but are missing from the live database. The one-liner / day-by-day views and the
-- /api/campaigns/[id]/schedule PATCH all depend on these columns to assign shots
-- to a shoot date and order them within the day.

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS shoot_date_id uuid REFERENCES public.shoot_dates(id) ON DELETE SET NULL;

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS sort_order_in_day integer DEFAULT 0;

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer DEFAULT 15;

CREATE INDEX IF NOT EXISTS idx_shots_shoot_date
  ON public.shot_list_shots(shoot_date_id)
  WHERE shoot_date_id IS NOT NULL;
