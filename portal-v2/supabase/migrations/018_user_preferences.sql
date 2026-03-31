-- ============================================================
-- Migration 018: User Preferences (drinks, snacks, dietary)
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS favorite_drinks text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS favorite_snacks text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dietary_restrictions text NOT NULL DEFAULT '';
