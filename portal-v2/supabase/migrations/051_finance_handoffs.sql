-- ============================================================
-- Migration 051: Finance Handoff Records
-- Stores retryable finance handoff + draft email summary per invoice.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'finance_handoff_status'
  ) THEN
    CREATE TYPE finance_handoff_status AS ENUM (
      'pending',
      'draft_ready',
      'sent',
      'failed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.finance_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.vendor_invoices(id) ON DELETE CASCADE,
  campaign_vendor_id uuid NOT NULL REFERENCES public.campaign_vendors(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  hop_approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  hop_approved_at timestamptz,
  status finance_handoff_status NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_error text NOT NULL DEFAULT '',
  email_to text[] NOT NULL DEFAULT '{}',
  email_cc text[] NOT NULL DEFAULT '{}',
  email_subject text NOT NULL DEFAULT '',
  email_body text NOT NULL DEFAULT '',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_handoffs_status
  ON public.finance_handoffs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_finance_handoffs_campaign_vendor
  ON public.finance_handoffs(campaign_vendor_id);

DROP TRIGGER IF EXISTS set_updated_at_finance_handoffs ON public.finance_handoffs;
CREATE TRIGGER set_updated_at_finance_handoffs
  BEFORE UPDATE ON public.finance_handoffs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.finance_handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_handoffs_admin_producer_read ON public.finance_handoffs;
CREATE POLICY finance_handoffs_admin_producer_read
  ON public.finance_handoffs FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));
