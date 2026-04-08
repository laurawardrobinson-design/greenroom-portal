import { NextResponse } from "next/server";
import {
  getAuthUser,
  requireCampaignVendorAccess,
  requireRole,
  requireVendorOwnership,
  authErrorResponse,
} from "@/lib/auth/guards";
import {
  getCampaignVendor,
  transitionVendorStatus,
  submitEstimate,
  getEstimateItems,
  removeVendorFromCampaign,
} from "@/lib/services/campaign-vendors.service";
import { isWorkflowFeatureEnabled } from "@/lib/services/feature-flags.service";
import {
  getRequestIpAddress,
  recordWorkflowAuditEvent,
  type WorkflowAuditAction,
} from "@/lib/services/workflow-audit.service";
import { submitEstimateSchema } from "@/lib/validation/estimates.schema";
import type { CampaignVendorStatus } from "@/types/domain";

// GET /api/campaign-vendors/[id] — get assignment with estimate items
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const authzHardeningEnabled = await isWorkflowFeatureEnabled(
      "workflow_authz_hardening_v2"
    );

    if (authzHardeningEnabled) {
      await requireCampaignVendorAccess(user, id);
    } else if (user.role === "Vendor") {
      await requireVendorOwnership(user, id);
    }

    const [cv, estimateItems] = await Promise.all([
      getCampaignVendor(id),
      getEstimateItems(id),
    ]);

    if (!cv) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ...cv, estimateItems });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/campaign-vendors/[id] — transition status or submit estimate
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const body = await request.json();
    const poSignatureWorkflowEnabled = await isWorkflowFeatureEnabled(
      "workflow_estimate_po_signature_v2"
    );

    // Submit estimate (vendor action)
    if (body.action === "submit_estimate") {
      if (user.role === "Vendor") {
        await requireVendorOwnership(user, id);
      } else {
        await requireRole(["Admin", "Producer"]);
      }

      const parsed = submitEstimateSchema.parse({
        campaignVendorId: id,
        estimateFileUrl: body.estimateFileUrl ?? null,
        estimateFileName: body.estimateFileName ?? null,
        items: body.items,
      });
      await submitEstimate(id, parsed.items, {
        estimateFileUrl: parsed.estimateFileUrl ?? null,
        estimateFileName: parsed.estimateFileName ?? null,
      });
      const cv = await getCampaignVendor(id);
      await recordWorkflowAuditEvent({
        userId: user.id,
        action: "estimate_submitted",
        resourceType: "campaign_vendor",
        resourceId: id,
        ipAddress: getRequestIpAddress(request),
        metadata: {
          estimateFileName: parsed.estimateFileName ?? null,
          estimateFileUrl: parsed.estimateFileUrl ?? null,
          itemCount: parsed.items.length,
        },
      });
      return NextResponse.json(cv);
    }

    // Status transition
    if (body.action === "transition") {
      const targetStatus = body.targetStatus as CampaignVendorStatus;

      // Check permissions based on target status
      const vendorActions: CampaignVendorStatus[] = [
        "Estimate Submitted",
        "PO Signed",
        "Invoice Submitted",
      ];
      const producerActions: CampaignVendorStatus[] = [
        "Estimate Approved",
        "Estimate Revision Requested",
        "PO Uploaded",
        "Shoot Complete",
        "Invoice Pre-Approved",
        "Rejected",
      ];
      const hopActions: CampaignVendorStatus[] = [
        "Invoice Approved",
        "Paid",
      ];

      if (vendorActions.includes(targetStatus)) {
        if (user.role === "Vendor") {
          await requireVendorOwnership(user, id);
        } else {
          await requireRole(["Admin", "Producer"]);
        }
      } else if (producerActions.includes(targetStatus)) {
        await requireRole(["Admin", "Producer"]);
      } else if (hopActions.includes(targetStatus)) {
        await requireRole(["Admin"]);
      }

      const transitionPayload: Record<string, unknown> =
        body.payload && typeof body.payload === "object"
          ? { ...(body.payload as Record<string, unknown>) }
          : {};

      // Security: signer IP must be captured from the server request, never trusted from client payload.
      if (targetStatus === "PO Signed") {
        transitionPayload.signedIp = getRequestIpAddress(request);
        transitionPayload.enforcePoSnapshot = poSignatureWorkflowEnabled;
      }

      if (targetStatus === "PO Uploaded") {
        transitionPayload.generatePoSnapshot = poSignatureWorkflowEnabled;
      }

      const cv = await transitionVendorStatus(id, targetStatus, transitionPayload);

      const auditActionByStatus: Partial<
        Record<CampaignVendorStatus, WorkflowAuditAction>
      > = {
        "Estimate Approved": "estimate_approved",
        "Estimate Revision Requested": "estimate_revision_requested",
        "PO Uploaded": "po_uploaded",
        "PO Signed": "po_signed",
      };
      const auditAction = auditActionByStatus[targetStatus];
      if (auditAction) {
        await recordWorkflowAuditEvent({
          userId: user.id,
          action: auditAction,
          resourceType: "campaign_vendor",
          resourceId: id,
          ipAddress: getRequestIpAddress(request),
          metadata: {
            targetStatus,
            payloadKeys: Object.keys(transitionPayload),
          },
        });
      }

      return NextResponse.json(cv);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Assignment not found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (
        error.message.startsWith("Cannot transition from") ||
        error.message.includes("required")
      ) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
    }
    return authErrorResponse(error);
  }
}

// DELETE /api/campaign-vendors/[id] — remove from campaign
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer"]);
    const { id } = await params;
    await removeVendorFromCampaign(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
