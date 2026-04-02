-- ============================================================
-- Migration 031: Vendor Preferences + Title
-- ============================================================

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS favorite_drinks text NOT NULL DEFAULT '';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS favorite_snacks text NOT NULL DEFAULT '';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS dietary_restrictions text NOT NULL DEFAULT '';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS allergies text NOT NULL DEFAULT '';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS energy_boost text NOT NULL DEFAULT '';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS favorite_publix_product text NOT NULL DEFAULT '';

-- Seed title from category for existing vendors
UPDATE public.vendors SET title = category WHERE title = '' AND category != '';
