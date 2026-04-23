-- ============================================================
-- 089: Bidirectional product flags + comment thread
-- ============================================================
-- Extends 088 so flags can also be raised by internal Producers
-- (directed at BMM + the RBU dept that owns the item) and adds a
-- comment thread so both sides can discuss before the flag clears.
-- ============================================================

-- 1. Flag source + raiser -----------------------------------------------

ALTER TABLE public.product_flags
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'rbu'
    CHECK (source IN ('rbu', 'producer'));

ALTER TABLE public.product_flags
  ADD COLUMN IF NOT EXISTS raised_by_user_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL;

-- `flagged_by_dept` keeps its existing meaning: the RBU/BMM department
-- this flag concerns. For source='producer' it's the dept the internal
-- producer picked as the audience.

COMMENT ON COLUMN public.product_flags.source IS
  'rbu = raised by an RBU dept via token-gated flow; producer = raised by internal Producer from inventory';
COMMENT ON COLUMN public.product_flags.flagged_by_dept IS
  'For source=rbu: the dept that raised it. For source=producer: the dept whose attention is requested (BMM + that RBU dept).';
COMMENT ON COLUMN public.product_flags.raised_by_user_id IS
  'Internal user who raised the flag. NULL when source=rbu.';


-- 2. Comment thread ------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.product_flag_comments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id         uuid        NOT NULL REFERENCES public.product_flags(id) ON DELETE CASCADE,
  author_user_id  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  author_dept     text        CHECK (author_dept IN ('Bakery','Produce','Deli','Meat-Seafood','Grocery')),
  author_label    text        NOT NULL DEFAULT '',
  body            text        NOT NULL CHECK (char_length(btrim(body)) > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (author_user_id IS NOT NULL OR author_dept IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_product_flag_comments_flag_time
  ON public.product_flag_comments(flag_id, created_at);

ALTER TABLE public.product_flag_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_flag_comments_read"
  ON public.product_flag_comments FOR SELECT
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Brand Marketing Manager','Studio'
  ]));

-- Internal users (BMM + producers + admins) can add comments.
-- RBU-side comments are inserted via service-role from the token route.
CREATE POLICY "product_flag_comments_insert_internal"
  ON public.product_flag_comments FOR INSERT
  WITH CHECK (
    public.current_user_has_role(ARRAY[
      'Admin','Producer','Post Producer','Brand Marketing Manager'
    ])
    AND author_user_id = (
      SELECT auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
