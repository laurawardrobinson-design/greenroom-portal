# Estimate -> PO -> Invoice v2 Operator Playbook

## Purpose
Run the v2 workflow safely for pilot campaigns, validate cutover readiness, and execute rollback drills without breaking v1 behavior.

## Prerequisites
- Admin access in Portal.
- Feature flags are managed in `feature_flags`.
- Pilot campaign IDs are known.

## Pilot rollout execution (selected campaigns)
1. Open `Finance Handoffs`.
2. Set scope to `Health: Pilot only`.
3. Enter pilot campaign IDs in `Campaign IDs (comma separated)` to run a selected-campaign pilot slice.
4. Confirm `Pilot scope active` is shown.
5. Watch regression alerts and cutover readiness checks for at least one full end-to-end cycle:
   - estimate submit/revision/approval
   - PO upload/signature
   - invoice submit/producer approval/HOP approval
   - finance handoff draft generation

## Feature-flag rollout order
1. `workflow_authz_hardening_v2`
2. `workflow_documents_center_v2`
3. `workflow_estimate_po_signature_v2`
4. `workflow_approval_unification_v2`
5. `workflow_invoice_cap_shadow_v2` (observe)
6. `workflow_invoice_cap_enforcement_v2` (after shadow is clean)
7. `workflow_finance_handoff_v2`

## Rollback drill (required before cutover)
1. During a low-risk window, disable the most recently enabled v2 flag.
2. Verify impacted flow still works in v1 mode.
3. Re-enable the flag.
4. Validate one end-to-end pilot workflow completes.
5. If app behavior regresses, roll back deployment and keep additive DB schema.
6. Record drill completion timestamp:
   - `WORKFLOW_ROLLBACK_DRILL_COMPLETED_AT=<ISO-8601>`

## Operator verification markers
- After reviewing this playbook, record:
  - `WORKFLOW_OPERATOR_PLAYBOOK_REVIEWED_AT=<ISO-8601>`
- Optional override path for this playbook:
  - `WORKFLOW_OPERATOR_PLAYBOOK_PATH=docs/runbooks/estimate-po-invoice-v2-operator-playbook.md`

These markers feed cutover readiness checks surfaced in workflow health telemetry.
