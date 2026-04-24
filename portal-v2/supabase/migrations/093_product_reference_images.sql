-- ============================================================
-- 093: Product reference images
-- ============================================================
--
-- Why: the RBU-won't-provide-product-up-to-the-standard-they-
-- approve pain has no single silver bullet, but the portal CAN
-- make the standard *explicit before the shoot* and track what
-- RBU commits to. This table holds every image attached to a
-- product and labels it by purpose:
--
--   reference — what BMM says "good" looks like. The standard to
--               meet. Uploaded by BMM/Admin/Producer.
--   sample    — RBU's working attempt at the product. Uploaded
--               by RBU via their existing department token so we
--               can see progress and catch mismatches early.
--   approved  — a sample promoted to "committed standard." BMM/
--               Admin flips the bit when a sample clears the bar.
--
-- All three types live in one table so the UI can show the full
-- timeline per product: here's the reference, here's RBU's last
-- sample, here's what we approved. That timeline IS the evidence
-- trail when wrong product shows up on shoot day.
--
-- Upload provenance is captured two ways:
--   - `uploaded_by_user_id` for portal uploads (BMM/Admin/etc.)
--   - `uploaded_via_rbu_department` for RBU token uploads
-- Exactly one of the two is set per row (enforced by CHECK).
-- ============================================================

CREATE TABLE public.product_reference_images (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                   uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_type                   text        NOT NULL
                               CHECK (image_type IN ('reference', 'sample', 'approved')),
  file_url                     text        NOT NULL,
  storage_path                 text,
  notes                        text        NOT NULL DEFAULT '',
  uploaded_by_user_id          uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_via_rbu_department  text,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_ref_images_provenance CHECK (
    (uploaded_by_user_id IS NOT NULL)::int
    + (uploaded_via_rbu_department IS NOT NULL)::int = 1
  ),
  CONSTRAINT product_ref_images_rbu_dept_valid CHECK (
    uploaded_via_rbu_department IS NULL
    OR uploaded_via_rbu_department IN ('Bakery','Produce','Deli','Meat-Seafood','Grocery')
  )
);

CREATE INDEX idx_product_ref_images_product
  ON public.product_reference_images(product_id, created_at DESC);

CREATE INDEX idx_product_ref_images_type
  ON public.product_reference_images(product_id, image_type);

-- ------------------------------------------------------------
-- RLS — read for all portal roles; write for Admin/BMM/Producer
-- (RBU writes happen via the service-role admin client in the
-- tokenized API route and bypass RLS.)
-- ------------------------------------------------------------
ALTER TABLE public.product_reference_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_ref_images_read" ON public.product_reference_images FOR SELECT
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Studio','Art Director',
    'Creative Director','Designer','Brand Marketing Manager'
  ]));

CREATE POLICY "product_ref_images_write" ON public.product_reference_images FOR ALL
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Brand Marketing Manager'
  ]))
  WITH CHECK (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Brand Marketing Manager'
  ]));

NOTIFY pgrst, 'reload schema';
