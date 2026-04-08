-- ============================================================
-- Migration 049: Workflow Feature Flags
-- Add runtime flags so workflow v2 can be rolled out safely.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT NOT NULL DEFAULT '',
  rollout_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_flags_admin_read" ON public.feature_flags;
CREATE POLICY "feature_flags_admin_read" ON public.feature_flags
  FOR SELECT
  USING (public.get_my_role() = 'Admin');

DROP POLICY IF EXISTS "feature_flags_admin_write" ON public.feature_flags;
CREATE POLICY "feature_flags_admin_write" ON public.feature_flags
  FOR ALL
  USING (public.get_my_role() = 'Admin')
  WITH CHECK (public.get_my_role() = 'Admin');

DROP TRIGGER IF EXISTS set_updated_at_feature_flags ON public.feature_flags;
CREATE TRIGGER set_updated_at_feature_flags
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.feature_flags (key, enabled, description, rollout_notes)
VALUES
  (
    'workflow_authz_hardening_v2',
    false,
    'Strict auth and ownership checks for estimate/PO/invoice flows',
    'Enable after role-path API tests pass'
  ),
  (
    'workflow_documents_center_v2',
    false,
    'Unified, role-scoped estimate/PO/invoice document center',
    'Enable for pilot campaigns after document migration verification'
  ),
  (
    'workflow_estimate_po_signature_v2',
    false,
    'Immutable PO snapshot + stronger electronic signature evidence',
    'Enable after legal/audit acceptance on signed packet format'
  ),
  (
    'workflow_invoice_cap_enforcement_v2',
    false,
    'Hard enforce invoice <= approved estimate/PO',
    'Run shadow validation first, then enable enforcement'
  ),
  (
    'workflow_invoice_cap_shadow_v2',
    false,
    'Log invoice-over-cap and parse-not-ready attempts without blocking approvals',
    'Enable before hard enforcement to gather pilot telemetry'
  ),
  (
    'workflow_approval_unification_v2',
    false,
    'Single approval path for Producer and HOP decisions',
    'Enable after parallel-run parity confirms metadata consistency'
  ),
  (
    'workflow_finance_handoff_v2',
    false,
    'Create finance handoff record and draft summary after HOP approval',
    'Enable after finance field mapping and retry monitoring are verified'
  )
ON CONFLICT (key) DO NOTHING;
