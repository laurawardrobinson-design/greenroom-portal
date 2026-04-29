-- Allow the user who raised a product flag to edit the original flag comment.
-- Mirrors the comment-edit pattern from migration 105.

ALTER TABLE public.product_flags
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

DROP POLICY IF EXISTS "product_flags_update_own_comment" ON public.product_flags;
CREATE POLICY "product_flags_update_own_comment"
  ON public.product_flags FOR UPDATE
  USING (raised_by_user_id = (SELECT auth.uid()))
  WITH CHECK (raised_by_user_id = (SELECT auth.uid()));

NOTIFY pgrst, 'reload schema';
