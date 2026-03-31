-- ============================================================
-- Migration 019: Product Notes (attributed shoot notes)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  text        text        NOT NULL,
  author_id   uuid        NOT NULL REFERENCES public.users(id),
  author_name text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_notes_product_id_idx
  ON public.product_notes (product_id, created_at);

ALTER TABLE public.product_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read product notes"
  ON public.product_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert their own notes"
  ON public.product_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);
