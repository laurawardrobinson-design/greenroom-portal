-- ============================================================
-- Migration 029: User Praise Notes ("What we love about...")
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text        text        NOT NULL,
  author_id   uuid        NOT NULL REFERENCES public.users(id),
  author_name text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notes_user_id_idx
  ON public.user_notes (user_id, created_at);

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read user notes"
  ON public.user_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert their own user notes"
  ON public.user_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);
