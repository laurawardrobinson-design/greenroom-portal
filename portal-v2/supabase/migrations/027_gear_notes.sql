-- ============================================================
-- Migration 027: Gear Notes (attributed user notes per gear item)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gear_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gear_item_id uuid       NOT NULL REFERENCES public.gear_items(id) ON DELETE CASCADE,
  text        text        NOT NULL,
  author_id   uuid        NOT NULL REFERENCES public.users(id),
  author_name text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gear_notes_item_id_idx
  ON public.gear_notes (gear_item_id, created_at);

ALTER TABLE public.gear_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read gear notes"
  ON public.gear_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert their own gear notes"
  ON public.gear_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);
