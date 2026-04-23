-- ============================================================
-- 086: PR pickup phone + public tokens for department sections
-- ============================================================
--
-- Enables Brand Marketing to email each department a link to a
-- read-only, tamper-proof view of their section of the PR.
--
--   • pickup_phone  — producer-supplied cell for the pickup person
--                     (defaults from contact card in UI, overwritable)
--   • public_token  — unguessable token used in /pr/view/[token]
--                     URLs; generated on insert via trigger
--
-- Also backfills users.phone / users.title defensively since several
-- services reference these columns.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Defensive user column backfill
-- ------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

-- ------------------------------------------------------------
-- 2. pickup_phone + public_token on department sections
-- ------------------------------------------------------------
ALTER TABLE public.product_request_dept_sections
  ADD COLUMN IF NOT EXISTS pickup_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS public_token text;

-- Backfill tokens for existing rows
UPDATE public.product_request_dept_sections
SET public_token = encode(gen_random_bytes(18), 'hex')
WHERE public_token IS NULL;

ALTER TABLE public.product_request_dept_sections
  ALTER COLUMN public_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pr_sections_public_token
  ON public.product_request_dept_sections(public_token);

-- Auto-generate token on insert
CREATE OR REPLACE FUNCTION public.assign_pr_section_token()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.public_token IS NULL OR NEW.public_token = '' THEN
    NEW.public_token := encode(gen_random_bytes(18), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pr_sections_assign_token ON public.product_request_dept_sections;
CREATE TRIGGER pr_sections_assign_token
  BEFORE INSERT ON public.product_request_dept_sections
  FOR EACH ROW EXECUTE FUNCTION public.assign_pr_section_token();

-- ------------------------------------------------------------
-- 3. Public read policy (anon) — token-gated via API layer
-- ------------------------------------------------------------
-- RLS is left strict; the /pr/view/[token] route uses the admin
-- client to fetch by token, so we don't need to open anon SELECT.

NOTIFY pgrst, 'reload schema';
