-- ============================================================
-- Migration 021: Allergies field
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS allergies text NOT NULL DEFAULT '';
