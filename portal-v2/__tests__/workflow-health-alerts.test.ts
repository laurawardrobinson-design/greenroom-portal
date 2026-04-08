import { describe, expect, it } from "vitest";
import type { WorkflowFeatureFlagKey } from "@/lib/constants/feature-flags";
import {
  buildWorkflowRegressionAlerts,
  type WorkflowRegressionAlertInput,
} from "@/lib/services/workflow-health.service";

const baseFlags: Record<WorkflowFeatureFlagKey, boolean> = {
  workflow_authz_hardening_v2: true,
  workflow_documents_center_v2: true,
  workflow_estimate_po_signature_v2: true,
  workflow_invoice_cap_enforcement_v2: false,
  workflow_invoice_cap_shadow_v2: true,
  workflow_approval_unification_v2: true,
  workflow_finance_handoff_v2: true,
};

function createInput(
  overrides?: Partial<WorkflowRegressionAlertInput>
): WorkflowRegressionAlertInput {
  return {
    flags: { ...baseFlags, ...(overrides?.flags || {}) },
    summary: {
      activeAssignments: 6,
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
  };
}

describe("buildWorkflowRegressionAlerts", () => {
  it("returns a healthy info alert when no regression signals are present", () => {
    const alerts = buildWorkflowRegressionAlerts(createInput());

    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("healthy");
    expect(alerts[0].severity).toBe("info");
  });

  it("marks finance handoff failures as critical", () => {
    const alerts = buildWorkflowRegressionAlerts(
      createInput({
        summary: {
          financeHandoffFailedLast24h: 3,
        },
      })
    );

    const failureAlert = alerts.find(
      (alert) => alert.id === "finance-handoff-failures"
    );
    expect(failureAlert).toBeDefined();
    expect(failureAlert?.severity).toBe("critical");
    expect(failureAlert?.metric).toBe(3);
  });

  it("reports invoice cap violations in shadow mode as info", () => {
    const alerts = buildWorkflowRegressionAlerts(
      createInput({
        flags: {
          workflow_invoice_cap_enforcement_v2: false,
        },
        summary: {
          invoiceCapViolationsLast24h: 2,
        },
      })
    );

    const capAlert = alerts.find((alert) => alert.id === "invoice-cap-violations");
    expect(capAlert).toBeDefined();
    expect(capAlert?.severity).toBe("info");
    expect(capAlert?.detail).toContain("shadow mode");
  });

  it("adds stalled assignment context into warning alerts", () => {
    const alerts = buildWorkflowRegressionAlerts(
      createInput({
        summary: {
          stalledAssignments: 1,
        },
        stalledAssignments: [
          {
            campaignVendorId: "cv-1",
            status: "Invoice Pre-Approved",
            wfNumber: "WF220017",
            campaignName: "Spring Social",
            hoursInStatus: 31,
            thresholdHours: 24,
          },
        ],
      })
    );

    const stalledAlert = alerts.find((alert) => alert.id === "stalled-assignments");
    expect(stalledAlert).toBeDefined();
    expect(stalledAlert?.severity).toBe("warning");
    expect(stalledAlert?.detail).toContain("WF220017");
    expect(stalledAlert?.detail).toContain("31h");
  });
});
