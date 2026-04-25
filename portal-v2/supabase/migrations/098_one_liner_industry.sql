-- One-liner enhancements: INT/EXT designation per shot, plus inline day-events
-- (company moves, meals, wrap) that interleave with shot rows.

ALTER TABLE public.shot_list_shots
  ADD COLUMN IF NOT EXISTS int_ext text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.shoot_day_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shoot_date_id uuid NOT NULL REFERENCES public.shoot_dates(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('move', 'lunch', 'wrap', 'other')),
  label text NOT NULL DEFAULT '',
  time text,
  sort_order_in_day integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shoot_day_events_date
  ON public.shoot_day_events(shoot_date_id);
