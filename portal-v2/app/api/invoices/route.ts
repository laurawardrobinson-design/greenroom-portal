import { NextResponse } from "next/server";
import { getAuthUser, requireRole, requireVendorOwnership, authErrorResponse } from "@/lib/auth/guards";
import { isWorkflowFeatureEnabled } from "@/lib/services/feature-flags.service";
import {
  createInvoice,
  getInvoiceForCampaignVendor,
  approveInvoice,
} from "@/lib/services/invoice.service";
import { transitionVendorStatus } from "@/lib/services/campaign-vendors.service";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getRequestIpAddress,
  recordWorkflowAuditEvent,
} from "@/lib/services/workflow-audit.service";
import {
  createOrUpdateFinanceHandoff,
  recordFinanceHandoffFailure,
} from "@/lib/services/finance-handoffs.service";

type ApproverType = "producer" | "hop";
type InvoiceSubmissionStatus = "Shoot Complete" | "Invoice Submitted";
type InvoiceApprovalRow = {
  id: string;
  campaign_vendor_id: string;
  parse_status: string;
};

const INVOICE_UPLOAD_ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);
const MAX_INVOICE_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
const INVOICE_READY_FOR_SUBMISSION: InvoiceSubmissionStatus = "Shoot Complete";

function isValidApproverType(value: unknown): value is ApproverType {
  return value === "producer" || value === "hop";
}

async function loadInvoiceApprovalRow(
  invoiceId: string
): Promise<InvoiceApprovalRow | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("vendor_invoices")
    .select("id, campaign_vendor_id, parse_status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return data as InvoiceApprovalRow;
}

// GET /api/invoices?campaignVendorId=xxx
export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const campaignVendorId = searchParams.get("campaignVendorId");
    if (!campaignVendorId) {
      return NextResponse.json({ error: "campaignVendorId required" }, { status: 400 });
    }
    // Verify vendor can only access their own assignment
    await requireVendorOwnership(user, campaignVendorId);
    const result = await getInvoiceForCampaignVendor(campaignVendorId);
    return NextResponse.json(result || { invoice: null, items: [] });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/invoices — upload invoice file to PRIVATE storage + create record
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const campaignVendorId = formData.get("campaignVendorId") as string;

    if (!file || !campaignVendorId) {
      return NextResponse.json(
        { error: "file and campaignVendorId required" },
        { status: 400 }
      );
    }

    if (user.role === "Vendor") {
      await requireVendorOwnership(user, campaignVendorId);
    } else {
      await requireRole(["Admin", "Producer"]);
    }

    if (!INVOICE_UPLOAD_ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invoice must be a PDF or image file." },
        { status: 400 }
      );
    }

    if (file.size > MAX_INVOICE_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Invoice file exceeds the 50MB upload limit." },
        { status: 400 }
      );
    }

    // Upload to PRIVATE invoices bucket (not public)
    const db = createAdminClient();
    const { data: assignment, error: assignmentError } = await db
      .from("campaign_vendors")
      .select("id, status")
      .eq("id", campaignVendorId)
      .maybeSingle();

    if (assignmentError) {
      throw assignmentError;
    }

    if (!assignment) {
      return NextResponse.json(
        { error: "Campaign vendor assignment not found" },
        { status: 404 }
      );
    }

    if (assignment.status !== INVOICE_READY_FOR_SUBMISSION) {
      return NextResponse.json(
        {
          error:
            "Invoice can only be submitted after the assignment is marked Shoot Complete.",
        },
        { status: 409 }
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${campaignVendorId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await db.storage
      .from("invoices")
      .upload(storagePath, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    // Generate a short-lived signed URL for immediate viewing (10 min)
    const { data: signedUrlData, error: signedUrlError } = await db.storage
      .from("invoices")
      .createSignedUrl(storagePath, 600); // 10 minutes

    if (signedUrlError) throw signedUrlError;

    // Create invoice record — store the STORAGE PATH, not a public URL
    const invoice = await createInvoice({
      campaignVendorId,
      fileUrl: signedUrlData.signedUrl, // Temporary URL for immediate display
      fileName: file.name,
      storagePath, // Private path for generating future signed URLs
    });

    // Transition vendor status to "Invoice Submitted".
    // If this fails, roll back the new invoice row and uploaded file.
    try {
      await transitionVendorStatus(campaignVendorId, "Invoice Submitted");
    } catch (transitionError) {
      await Promise.allSettled([
        db.from("vendor_invoices").delete().eq("id", invoice.id),
        db.storage.from("invoices").remove([storagePath]),
      ]);

      const safeMessage =
        transitionError instanceof Error &&
        transitionError.message.startsWith("Cannot transition from")
          ? "Invoice can only be submitted after the assignment is marked Shoot Complete."
          : "Unable to submit invoice for this workflow step.";

      return NextResponse.json({ error: safeMessage }, { status: 409 });
    }

    await recordWorkflowAuditEvent({
      userId: user.id,
      action: "invoice_submitted",
      resourceType: "campaign_vendor",
      resourceId: campaignVendorId,
      ipAddress: getRequestIpAddress(request),
      metadata: {
        invoiceId: invoice.id,
        fileName: file.name,
      },
    });

    // Trigger edge function for parsing (fire-and-forget)
    // Passes storage path — edge function downloads directly from private storage
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (projectUrl && serviceKey) {
      fetch(`${projectUrl}/functions/v1/parse-invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          storagePath, // Private storage path — NOT a public URL
          campaignVendorId,
        }),
      }).catch(() => {
        // Edge function failure is non-blocking — can be retried
      });
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/invoices — approve invoice
export async function PATCH(request: Request) {
  try {
    const user = await getAuthUser();
    const body = await request.json();
    const invoiceId =
      typeof body.invoiceId === "string" ? body.invoiceId.trim() : "";
    const campaignVendorId =
      typeof body.campaignVendorId === "string" &&
      body.campaignVendorId.trim().length > 0
        ? body.campaignVendorId.trim()
        : undefined;
    const approverType = body.approverType;
    const authzHardeningEnabled = await isWorkflowFeatureEnabled(
      "workflow_authz_hardening_v2"
    );
    const invoiceCapEnforcementEnabled = await isWorkflowFeatureEnabled(
      "workflow_invoice_cap_enforcement_v2"
    );
    const invoiceCapShadowEnabled = await isWorkflowFeatureEnabled(
      "workflow_invoice_cap_shadow_v2"
    );
    const approvalUnificationEnabled = await isWorkflowFeatureEnabled(
      "workflow_approval_unification_v2"
    );
    const financeHandoffEnabled = await isWorkflowFeatureEnabled(
      "workflow_finance_handoff_v2"
    );

    if (!invoiceId || !approverType) {
      return NextResponse.json(
        { error: "invoiceId and approverType required" },
        { status: 400 }
      );
    }

    if (!isValidApproverType(approverType)) {
      return NextResponse.json(
        { error: "approverType must be 'producer' or 'hop'" },
        { status: 400 }
      );
    }

    if (approverType === "producer") {
      await requireRole(["Admin", "Producer"]);
    } else {
      await requireRole(["Admin"]);
    }

    const evaluateInvoiceCap =
      approvalUnificationEnabled &&
      approverType === "producer" &&
      (invoiceCapEnforcementEnabled || invoiceCapShadowEnabled);

    const invoiceRow = await loadInvoiceApprovalRow(invoiceId);
    if (!invoiceRow) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    const resolvedCampaignVendorId = campaignVendorId || invoiceRow.campaign_vendor_id;

    if (approvalUnificationEnabled && authzHardeningEnabled) {
      if (!campaignVendorId) {
        return NextResponse.json(
          { error: "campaignVendorId required" },
          { status: 400 }
        );
      }
    }

    if (campaignVendorId && invoiceRow.campaign_vendor_id !== campaignVendorId) {
      return NextResponse.json(
        { error: "invoiceId does not match campaignVendorId" },
        { status: 400 }
      );
    }

    if (evaluateInvoiceCap) {
      if (!resolvedCampaignVendorId) {
        return NextResponse.json(
          { error: "campaignVendorId required" },
          { status: 400 }
        );
      }

      const parseReady = invoiceRow.parse_status === "completed";
      let estimateTotal = 0;
      let invoiceTotal = 0;
      let overCap = false;

      if (parseReady) {
        const db = createAdminClient();
        const { data: assignment, error: assignmentError } = await db
          .from("campaign_vendors")
          .select("estimate_total, invoice_total")
          .eq("id", resolvedCampaignVendorId)
          .maybeSingle();

        if (assignmentError) {
          throw assignmentError;
        }

        if (!assignment) {
          return NextResponse.json(
            { error: "Campaign vendor assignment not found" },
            { status: 404 }
          );
        }

        estimateTotal = Number(assignment.estimate_total || 0);
        invoiceTotal = Number(assignment.invoice_total || 0);
        overCap = invoiceTotal > estimateTotal;
      }

      if (!parseReady) {
        await recordWorkflowAuditEvent({
          userId: user.id,
          action: "invoice_parse_not_ready_detected",
          resourceType: "vendor_invoice",
          resourceId: invoiceId,
          ipAddress: getRequestIpAddress(request),
          metadata: {
            campaignVendorId: resolvedCampaignVendorId,
            enforced: invoiceCapEnforcementEnabled,
            shadow: invoiceCapShadowEnabled,
            parseStatus: invoiceRow.parse_status || "unknown",
          },
        });
      }

      if (overCap) {
        await recordWorkflowAuditEvent({
          userId: user.id,
          action: "invoice_cap_violation_detected",
          resourceType: "vendor_invoice",
          resourceId: invoiceId,
          ipAddress: getRequestIpAddress(request),
          metadata: {
            campaignVendorId: resolvedCampaignVendorId,
            enforced: invoiceCapEnforcementEnabled,
            shadow: invoiceCapShadowEnabled,
            estimateTotal,
            invoiceTotal,
          },
        });
      }

      if (invoiceCapEnforcementEnabled && !parseReady) {
        return NextResponse.json(
          {
            error:
              "Invoice parsing is not complete. Wait for parsing to finish before approval.",
          },
          { status: 409 }
        );
      }

      if (invoiceCapEnforcementEnabled && overCap) {
        return NextResponse.json(
          {
            error:
              "Invoice total exceeds approved estimate/PO and cannot be pre-approved.",
          },
          { status: 400 }
        );
      }
    }

    if (!approvalUnificationEnabled) {
      if (!resolvedCampaignVendorId) {
        return NextResponse.json(
          { error: "Invoice is not linked to a campaign vendor assignment" },
          { status: 400 }
        );
      }

      const legacyStatus =
        approverType === "producer" ? "Invoice Pre-Approved" : "Invoice Approved";
      await transitionVendorStatus(
        resolvedCampaignVendorId,
        legacyStatus
      );
      await recordWorkflowAuditEvent({
        userId: user.id,
        action:
          approverType === "producer"
            ? "invoice_pre_approved"
            : "invoice_approved",
        resourceType: "vendor_invoice",
        resourceId: invoiceId,
        ipAddress: getRequestIpAddress(request),
        metadata: {
          campaignVendorId: resolvedCampaignVendorId,
          legacyMode: true,
          targetStatus: legacyStatus,
        },
      });

      return NextResponse.json({
        success: true,
        legacyMode: true,
        financeHandoff: null,
        financeHandoffError: null,
      });
    }

    // Approve
    await approveInvoice({
      invoiceId,
      approverType,
      userId: user.id,
    });

    // Transition vendor status
    let financeHandoffResult: Record<string, unknown> | null = null;
    let financeHandoffError: string | null = null;

    if (approverType === "producer" && resolvedCampaignVendorId) {
      await transitionVendorStatus(resolvedCampaignVendorId, "Invoice Pre-Approved");
      await recordWorkflowAuditEvent({
        userId: user.id,
        action: "invoice_pre_approved",
        resourceType: "vendor_invoice",
        resourceId: invoiceId,
        ipAddress: getRequestIpAddress(request),
        metadata: { campaignVendorId: resolvedCampaignVendorId },
      });
    } else if (approverType === "hop" && resolvedCampaignVendorId) {
      await transitionVendorStatus(resolvedCampaignVendorId, "Invoice Approved");
      await recordWorkflowAuditEvent({
        userId: user.id,
        action: "invoice_approved",
        resourceType: "vendor_invoice",
        resourceId: invoiceId,
        ipAddress: getRequestIpAddress(request),
        metadata: { campaignVendorId: resolvedCampaignVendorId },
      });

      if (financeHandoffEnabled) {
        try {
          const handoff = await createOrUpdateFinanceHandoff({
            invoiceId,
            campaignVendorId: resolvedCampaignVendorId,
            hopApprovedBy: user.id,
          });
          financeHandoffResult = {
            id: handoff.id,
            status: handoff.status,
            attemptCount: handoff.attemptCount,
            emailSubject: handoff.emailSubject,
            updatedAt: handoff.updatedAt,
          };
          await recordWorkflowAuditEvent({
            userId: user.id,
            action: "finance_handoff_created",
            resourceType: "finance_handoff",
            resourceId: handoff.id,
            ipAddress: getRequestIpAddress(request),
            metadata: {
              invoiceId,
              campaignVendorId: resolvedCampaignVendorId,
              status: handoff.status,
            },
          });
        } catch (handoffError) {
          const message =
            handoffError instanceof Error
              ? handoffError.message
              : "Unknown handoff failure";
          financeHandoffError = message;

          try {
            const failedRecord = await recordFinanceHandoffFailure({
              invoiceId,
              campaignVendorId: resolvedCampaignVendorId,
              hopApprovedBy: user.id,
              errorMessage: message,
            });

            await recordWorkflowAuditEvent({
              userId: user.id,
              action: "finance_handoff_failed",
              resourceType: "finance_handoff",
              resourceId: failedRecord.id,
              ipAddress: getRequestIpAddress(request),
              metadata: {
                invoiceId,
                campaignVendorId: resolvedCampaignVendorId,
                error: message,
              },
            });
          } catch {
            // Never block invoice approval if failure tracking also fails.
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      financeHandoff: financeHandoffResult,
      financeHandoffError,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Cannot transition from")
    ) {
      return NextResponse.json(
        { error: "Invoice is not in a state that can be approved." },
        { status: 409 }
      );
    }
    return authErrorResponse(error);
  }
}
