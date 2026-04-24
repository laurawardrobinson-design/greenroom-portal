-- ============================================================
-- 090: Product lifecycle phase
-- ============================================================
-- Introduces a lifecycle phase on products so Brand Marketing can
-- corral items they need to review before the next shoot:
--   * planning    — pre-announcement, internal BMM ideation
--   * coming_soon — publicly teased / seasonal holds
--   * live        — standard inventory (default)
--   * discontinued — retired
--
-- Partial index speeds up BMM per-dept review queries where we
-- only care about non-live items per department.
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS lifecycle_phase text
    NOT NULL DEFAULT 'live'
    CHECK (lifecycle_phase IN ('planning','coming_soon','live','discontinued'));

CREATE INDEX IF NOT EXISTS idx_products_phase_dept
  ON public.products(lifecycle_phase, department)
  WHERE lifecycle_phase <> 'live';

COMMENT ON COLUMN public.products.lifecycle_phase IS
  'Product state for BMM review: planning | coming_soon | live | discontinued';

NOTIFY pgrst, 'reload schema';
