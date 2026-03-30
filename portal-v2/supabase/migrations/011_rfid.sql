-- ============================================================
-- Migration 011: Add RFID tag support to gear_items
-- ============================================================

ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS rfid_tag text UNIQUE;

-- Index for fast RFID lookups (sparse — only rows with a tag set)
CREATE INDEX IF NOT EXISTS gear_items_rfid_tag_idx
  ON public.gear_items (rfid_tag)
  WHERE rfid_tag IS NOT NULL;
