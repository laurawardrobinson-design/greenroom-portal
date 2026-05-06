-- ============================================================
-- 114: Product flag proposed changes
-- ============================================================
-- Adds an "edit proposal" mode to product_flags. RBU/BMM can
-- submit a structured field-level diff instead of a free-text
-- comment; Producers see the diff inline and can Accept (which
-- applies the changes to the product) or Decline (resolve with
-- a note).
--
-- - kind = 'comment' (default) preserves the existing flow.
-- - kind = 'edit' carries a JSON object of {field: {from, to}}.
-- ============================================================

ALTER TABLE public.product_flags
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'comment'
    CHECK (kind IN ('comment','edit')),
  ADD COLUMN IF NOT EXISTS proposed_changes jsonb;

CREATE INDEX IF NOT EXISTS idx_product_flags_kind_open
  ON public.product_flags(kind) WHERE status = 'open';

NOTIFY pgrst, 'reload schema';
