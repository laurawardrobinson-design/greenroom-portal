import { createAdminClient } from "@/lib/supabase/admin";

export type WorkflowAuditAction =
  | "estimate_submitted"
  | "estimate_approved"
  | "estimate_rejected"
  | "estimate_revision_requested"
  | "po_uploaded"
  | "po_signed"
  | "invoice_submitted"
  | "invoice_pre_approved"
  | "invoice_approved"
  | "invoice_cap_violation_detected"
  | "invoice_parse_not_ready_detected"
  | "finance_handoff_created"
  | "finance_handoff_failed";

export type WorkflowAuditResourceType =
  | "campaign_vendor"
  | "vendor_invoice"
  | "finance_handoff";

export type WorkflowAuditEventInput = {
  userId: string | null;
  action: WorkflowAuditAction;
  resourceType: WorkflowAuditResourceType;
  resourceId: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

export function getRequestIpAddress(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return null;
  const firstIp = forwardedFor.split(",")[0]?.trim();
  return firstIp || null;
}

export async function recordWorkflowAuditEvent(
  input: WorkflowAuditEventInput
): Promise<void> {
  const db = createAdminClient();

  const { error } = await db.from("audit_logs").insert({
    user_id: input.userId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    metadata: input.metadata ?? {},
    ip_address: input.ipAddress ?? null,
  });

  if (error) {
    // Logging must never break the business workflow.
    console.warn("[WorkflowAudit] Failed to write audit log", {
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      error: error.message,
    });
  }
}
