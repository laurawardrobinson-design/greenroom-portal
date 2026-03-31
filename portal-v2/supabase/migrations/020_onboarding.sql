-- ============================================================
-- Migration 020: Onboarding fields
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS favorite_publix_product text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lunch_place text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS preferred_contact text NOT NULL DEFAULT 'Email',
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
