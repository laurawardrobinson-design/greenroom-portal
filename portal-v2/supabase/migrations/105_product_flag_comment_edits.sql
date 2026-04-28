-- Track edits to product flag comments so we can show a discreet "edited"
-- marker in the UI without losing the original timestamp.

ALTER TABLE public.product_flag_comments
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Authors can edit their own comment body. RLS prevents touching anyone else's.
DROP POLICY IF EXISTS "product_flag_comments_update_own" ON public.product_flag_comments;
CREATE POLICY "product_flag_comments_update_own"
  ON public.product_flag_comments FOR UPDATE
  USING (author_user_id = (SELECT auth.uid()))
  WITH CHECK (author_user_id = (SELECT auth.uid()));

NOTIFY pgrst, 'reload schema';
