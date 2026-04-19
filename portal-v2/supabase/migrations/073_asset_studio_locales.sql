-- ============================================================
-- 073: Asset Studio — Locales
--
-- Minimum-viable multi-language output for the demo. Keep it
-- simple:
--
--   1. Each text layer can carry per-locale content in a jsonb
--      column (layer.locales: { "es-US": "Hola", "fr-CA": "Bonjour" }).
--      Kept ON the layer row rather than in a side table so the
--      version-snapshot helpers in 071 capture translations for
--      free (no separate fan-out / join path to maintain).
--
--   2. Each run names the locales it wants to render via a new
--      variant_runs.locale_codes text[]. Defaults to ['en-US'] so
--      existing runs keep producing a single variant per
--      product × spec.
--
--   3. Each variant records the locale it renders in
--      variants.locale_code — null means "default" (the layer.content
--      fallback). UI and gallery surface a locale badge from this.
--
-- No new tables, no new RLS. Rollout-safe: old code path that
-- doesn't know about locale_codes keeps working (the default keeps
-- single-locale behavior identical to today).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Per-layer translations
-- ------------------------------------------------------------

ALTER TABLE public.template_layers
  ADD COLUMN IF NOT EXISTS locales jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.template_layers.locales IS
  'Per-locale content overrides for text layers. Shape: { localeCode: string }. Falls back to template_layers.content when a locale is missing or empty.';

-- ------------------------------------------------------------
-- 2. Run-level locale set
-- ------------------------------------------------------------

ALTER TABLE public.variant_runs
  ADD COLUMN IF NOT EXISTS locale_codes text[] NOT NULL DEFAULT ARRAY['en-US']::text[];

COMMENT ON COLUMN public.variant_runs.locale_codes IS
  'Locales rendered for this run. Variant count = products × specs × locale_codes. Default is en-US so pre-073 code paths render a single locale.';

-- ------------------------------------------------------------
-- 3. Per-variant locale
-- ------------------------------------------------------------

ALTER TABLE public.variants
  ADD COLUMN IF NOT EXISTS locale_code text;

CREATE INDEX IF NOT EXISTS idx_variants_locale_code
  ON public.variants (locale_code)
  WHERE locale_code IS NOT NULL;

COMMENT ON COLUMN public.variants.locale_code IS
  'Which locale this variant was rendered in. Null means "default" (pre-073 variants, or single-locale runs that never set the column).';

-- ------------------------------------------------------------
-- 4. Tell PostgREST to reload
-- ------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
