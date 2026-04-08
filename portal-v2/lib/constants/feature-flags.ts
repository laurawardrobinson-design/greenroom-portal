export const WORKFLOW_FEATURE_FLAGS = [
  "workflow_authz_hardening_v2",
  "workflow_documents_center_v2",
  "workflow_estimate_po_signature_v2",
  "workflow_invoice_cap_enforcement_v2",
  "workflow_invoice_cap_shadow_v2",
  "workflow_approval_unification_v2",
  "workflow_finance_handoff_v2",
] as const;

export type WorkflowFeatureFlagKey = (typeof WORKFLOW_FEATURE_FLAGS)[number];
