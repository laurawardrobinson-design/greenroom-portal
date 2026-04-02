-- ============================================================
-- Migration 032: Vendor Praise Notes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendor_praise_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid        NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  text        text        NOT NULL,
  author_id   uuid        NOT NULL REFERENCES public.users(id),
  author_name text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_praise_notes_vendor_id_idx
  ON public.vendor_praise_notes (vendor_id, created_at);

ALTER TABLE public.vendor_praise_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vendor praise notes"
  ON public.vendor_praise_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert their own vendor praise notes"
  ON public.vendor_praise_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);
