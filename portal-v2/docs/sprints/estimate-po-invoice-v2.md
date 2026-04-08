# Estimate / PO / Invoice V2 Sprint Plan

## Goal
Ship a safer and smoother Vendor -> Producer -> HOP workflow for estimates, POs, signatures, and invoices with role-scoped visibility and rollback-safe rollout controls.

## Guardrails
- Keep existing v1 behavior available until cutover.
- Ship additive DB changes first; avoid destructive schema changes until stabilization.
- Gate all v2 behavior with `feature_flags`.
- Log critical transitions for audit and rollback analysis.

## Sprint 0: Foundation (In Progress)
### Stories
- [x] Add workflow feature flags in database and server helpers.
- [x] Add workflow audit logging helper for non-table-change events.
- [x] Add shared sprint execution document with acceptance criteria and rollout checks.

### Acceptance
- [x] All v2 flags exist and default to `false`.
- [x] Flag reads fail safely to `false` when DB is unavailable.
- [x] Audit helper can log events without blocking workflow code paths on failure.

## Sprint 1: Auth + Visibility Hardening
### Stories
- [x] Enforce ownership checks in estimate/PO/invoice view endpoints (behind `workflow_authz_hardening_v2`).
- [x] Enforce strict role checks for vendor submissions and approvals (behind `workflow_authz_hardening_v2`).
- [x] Add role-path endpoint tests for guard and flag behavior.
- [x] Add route-level integration tests for invoice approval auth hardening.

### Acceptance
- [x] Vendor cannot access documents outside their assignment when v2 flag is enabled.
- [x] Only intended roles can advance each workflow transition when v2 flag is enabled.
- [x] Existing valid flows remain functional under v1 flags.

## Sprint 2: Document Reliability + Center
### Stories
- [x] Normalize upload response contract and client consumers (`fileUrl` with backward-compatible `url` alias).
- [x] Persist estimate file metadata on submit-estimate flow.
- [x] Persist PO metadata consistency across upload surfaces and status transitions.
- [x] Add a role-scoped document center for all related estimate/PO/invoice records (`/documents` + `/api/financial-documents`).

### Acceptance
- [x] No status can move to PO Uploaded without a persisted PO document reference.
- [x] Producer and HOP can review complete document packet from one surface.

## Sprint 3: Estimate -> PO -> Signature Hardening
### Stories
- [x] Add estimate rejection/resubmission feedback loop.
- [x] Generate immutable PO snapshot before signature.
- [x] Capture stronger signature evidence: signer IP is now server-captured on PO Signed transitions.

### Acceptance
- Signed PO references immutable source version.
- Signature audit data is complete and queryable.

## Sprint 4: Invoice Cap + Approval Unification
### Stories
- [x] Add parse-complete + invoice-over-cap enforcement at producer approval (behind `workflow_invoice_cap_enforcement_v2`).
- [x] Add shadow validation telemetry mode for over-cap and parse-not-ready attempts (`workflow_invoice_cap_shadow_v2`).
- [x] Switch HOP approval UI surfaces to `/api/invoices` approval path to keep invoice metadata in sync.
- [x] Finish approval-path unification for explicit invoice approve transitions in UI callers.

### Acceptance
- [x] Over-cap invoice submission is blocked when v2 flag is enabled.
- [x] Approval timestamps, approver IDs, and statuses are in sync for HOP approvals from `Approvals` and `Budget` pages.

## Sprint 5: Finance Handoff + Draft
### Stories
- [x] Create finance handoff record on HOP final approval.
- [x] Generate finance email draft summary payload.
- [x] Add retryable handoff job with error visibility.

### Acceptance
- [x] Every HOP-approved invoice has a handoff status trail.
- [x] Failed handoffs are visible and retryable without manual DB edits.

## Sprint 6: Cutover + Stabilization
### Stories
- [x] Add pilot-campaign scoped workflow health views (`scope=pilot`) for rollout monitoring.
- [x] Add selected-campaign pilot execution override (`campaignIds`) for rollout operations.
- Run pilot rollout by selected campaigns.
- [x] Track key health metrics and regression alerts.
- [x] Add operator playbook + rollback drill readiness checks to workflow cutover gating.
- Remove legacy code paths after stability window.

### Acceptance
- [x] Pilot monitoring can be scoped with `WORKFLOW_PILOT_CAMPAIGN_IDS` and `scope=pilot`.
- [x] Pilot monitoring can be overridden to selected campaigns per request via `campaignIds`.
- [x] Cutover readiness surfaces operator playbook review and rollback drill recency checks.
- Pilot group completes end-to-end workflow without blocker defects.
- Rollback drill validated (feature flag off + previous deployment).
- v1 path removal only after agreed stability criteria are met.

## Rollback Checklist
- Disable affected v2 feature flag(s).
- Roll back Vercel deployment if app behavior regresses.
- Keep additive schema compatible with v1 readers.
- Use audit logs to identify and reprocess partial events.
