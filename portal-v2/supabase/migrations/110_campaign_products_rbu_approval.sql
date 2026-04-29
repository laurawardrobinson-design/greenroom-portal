-- ============================================================
-- 110: RBU accuracy approval on campaign_products
-- ============================================================
--
-- Adds an "approved by RBU as accurate" state to each
-- (campaign × product) link so the Products → Review tab can
-- track which upcoming uses have been signed off on by the
-- Retail Business Unit and which still need attention.
-- ============================================================

ALTER TABLE public.campaign_products
  ADD COLUMN IF NOT EXISTS rbu_approved_at timestamptz;

ALTER TABLE public.campaign_products
  ADD COLUMN IF NOT EXISTS rbu_approved_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_products_rbu_approved_at
  ON public.campaign_products(rbu_approved_at);

NOTIFY pgrst, 'reload schema';
