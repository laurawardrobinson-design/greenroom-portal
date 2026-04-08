import { describe, expect, it } from "vitest";
import type { WorkflowFeatureFlagKey } from "@/lib/constants/feature-flags";
import {
  buildWorkflowCutoverReadiness,
  type WorkflowCutoverReadinessInput,
} from "@/lib/services/workflow-health.service";

const enabledFlags: Record<WorkflowFeatureFlagKey, boolean> = {
  workflow_authz_hardening_v2: true,
  workflow_documents_center_v2: true,
  workflow_estimate_po_signature_v2: true,
  workflow_invoice_cap_enforcement_v2: true,
  workflow_invoice_cap_shadow_v2: false,
  workflow_approval_unification_v2: true,
  workflow_finance_handoff_v2: true,
};

function buildInput(
  overrides?: Partial<WorkflowCutoverReadinessInput>
): WorkflowCutoverReadinessInput {
  return {
    flags: { ...enabledFlags, ...(overrides?.flags || {}) },
    summary: {
      activeAssignments: 3,
      pendingProducerApprovals: 0,
      pendingHopApprovals: 0,
      oldestPendingProducerApprovalHours: null,
      oldestPendingHopApprovalHours: null,
      stalledAssignments: 0,
      financeHandoffFailed: 0,
      financeHandoffFailedLast24h: 0,
      financeHandoffDraftReady: 2,
      invoiceCapViolationsLast24h: 0,
      parseNotReadyAttemptsLast24h: 0,
      ...(overrides?.summary || {}),
    },
    stalledAssignments: overrides?.stalledAssignments || [],
    pilotCampaignIds: overrides?.pilotCampaignIds || ["camp-1"],
    pilotScopeActive: overrides?.pilotScopeActive ?? true,
  };
}

describe("buildWorkflowCutoverReadiness", () => {
  it("returns ready when all required gates pass", () => {
    const readiness = buildWorkflowCutoverReadiness(buildInput());

    expect(readiness.ready).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.checks.every((check) => check.passed)).toBe(true);
  });

  it("returns blockers for missing pilot setup and disabled flags", () => {
    const readiness = buildWorkflowCutoverReadiness(
      buildInput({
        flags: {
          ...enabledFlags,
          workflow_documents_center_v2: false,
          workflow_approval_unification_v2: false,
        },
        pilotCampaignIds: [],
        pilotScopeActive: false,
      })
    );

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toContain("Pilot campaign scope configured");
    expect(readiness.blockers).toContain("Document center enabled");
    expect(readiness.blockers).toContain("Unified invoice approvals enabled");
  });

  it("fails readiness when approval queue ages beyond SLA", () => {
    const readiness = buildWorkflowCutoverReadiness(
      buildInput({
        summary: {
          pendingProducerApprovals: 2,
          oldestPendingProducerApprovalHours: 72,
          pendingHopApprovals: 1,
          oldestPendingHopApprovalHours: 30,
        },
      })
    );

    expect(readiness.ready).toBe(false);
    const backlogCheck = readiness.checks.find(
      (check) => check.id === "approval-backlog"
    );
    expect(backlogCheck?.passed).toBe(false);
  });
});
