-- ============================================================
-- Migration 022: Energy boost order field
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS energy_boost text NOT NULL DEFAULT '';
