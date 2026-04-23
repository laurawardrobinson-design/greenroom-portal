-- ============================================================
-- 087: Department calendar tokens
-- ============================================================
--
-- Each of the 5 merchandising departments (Bakery, Produce, Deli,
-- Meat-Seafood, Grocery) gets one stable public_token. Brand
-- Marketing shares this once with the department's team, and
-- /pr/dept/[token] renders a calendar of all upcoming shoots in
-- that department. Rotating the token is as simple as an UPDATE.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_request_dept_calendars (
  department   text        PRIMARY KEY
               CHECK (department IN ('Bakery','Produce','Deli','Meat-Seafood','Grocery')),
  public_token text        NOT NULL UNIQUE
               DEFAULT encode(gen_random_bytes(18), 'hex'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.product_request_dept_calendars (department) VALUES
  ('Bakery'),
  ('Produce'),
  ('Deli'),
  ('Meat-Seafood'),
  ('Grocery')
ON CONFLICT (department) DO NOTHING;

ALTER TABLE public.product_request_dept_calendars ENABLE ROW LEVEL SECURITY;

-- Only Admin / BMM see tokens through the portal (for copy-link).
-- Public reads happen through the admin-client service layer keyed
-- on the token itself, same pattern as section tokens.
CREATE POLICY "pr_dept_calendars_read"
  ON public.product_request_dept_calendars
  FOR SELECT
  USING (public.current_user_has_role(ARRAY['Admin','Brand Marketing Manager']));

CREATE POLICY "pr_dept_calendars_update"
  ON public.product_request_dept_calendars
  FOR UPDATE
  USING (public.current_user_has_role(ARRAY['Admin','Brand Marketing Manager']))
  WITH CHECK (public.current_user_has_role(ARRAY['Admin','Brand Marketing Manager']));

NOTIFY pgrst, 'reload schema';
