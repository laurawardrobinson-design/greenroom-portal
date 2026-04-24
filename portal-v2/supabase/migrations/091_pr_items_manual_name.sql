-- 091: Freetext name on product_request_items
-- Allows items added without a catalog product link to carry a display name.
ALTER TABLE public.product_request_items
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
