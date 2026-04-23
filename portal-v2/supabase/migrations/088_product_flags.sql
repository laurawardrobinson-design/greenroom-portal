-- ============================================================
-- 088: Product flags (RBU-raised review requests)
-- ============================================================
-- RBU teams cannot edit existing inventory; instead, they flag
-- products as either "inaccurate" or "about_to_change" with a
-- comment. Producers (only) can resolve. Flags appear in a review
-- panel for Brand Marketing + Producers and as a badge on the
-- product in the internal inventory.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_flags (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  flagged_by_dept   text        NOT NULL
                    CHECK (flagged_by_dept IN ('Bakery','Produce','Deli','Meat-Seafood','Grocery')),
  reason            text        NOT NULL
                    CHECK (reason IN ('inaccurate','about_to_change')),
  comment           text        NOT NULL DEFAULT '',
  status            text        NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','resolved')),
  resolved_by       uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at       timestamptz,
  resolution_note   text        NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_flags_product_open
  ON public.product_flags(product_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_product_flags_status_time
  ON public.product_flags(status, created_at DESC);

ALTER TABLE public.product_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_flags_read"
  ON public.product_flags FOR SELECT
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Brand Marketing Manager','Studio'
  ]));

CREATE POLICY "product_flags_update_resolve"
  ON public.product_flags FOR UPDATE
  USING (public.current_user_has_role(ARRAY['Admin','Producer','Post Producer']))
  WITH CHECK (public.current_user_has_role(ARRAY['Admin','Producer','Post Producer']));

NOTIFY pgrst, 'reload schema';
