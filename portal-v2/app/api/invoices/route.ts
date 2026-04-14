import { NextResponse } from "next/server";
import { getAuthUser, requireRole, requireVendorOwnership, authErrorResponse } from "@/lib/auth/guards";
import {
  createInvoice,
  getInvoiceForCampaignVendor,
  approveInvoice,
} from "@/lib/services/invoice.service";
import { transitionVendorStatus } from "@/lib/services/campaign-vendors.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyCampaignProducers, notifyAdmins } from "@/lib/services/notifications.service";

// GET /api/invoices?campaignVendorId=xxx
export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const campaignVendorId = searchParams.get("campaignVendorId");
    if (!campaignVendorId) {
      return NextResponse.json({ error: "campaignVendorId required" }, { status: 400 });
    }
    // Vendors can only access their own assignment; producers/admin can review all.
    if (user.role === "Vendor") {
      await requireVendorOwnership(user, campaignVendorId);
    } else {
      await requireRole(["Admin", "Producer", "Post Producer"]);
    }
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

    // Upload to PRIVATE invoices bucket (not public)
    const db = createAdminClient();
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

    // Transition vendor status to "Invoice Submitted"
    await transitionVendorStatus(campaignVendorId, "Invoice Submitted");

    // Notify campaign producers
    notifyCampaignProducers(campaignVendorId, {
      type: "invoice_submitted",
      level: "urgent",
      title: "Invoice submitted",
      body: `A vendor has submitted an invoice for review.`,
    }).catch(() => {}); // non-blocking

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
    const { invoiceId, campaignVendorId, approverType } = body;

    if (!invoiceId || !approverType) {
      return NextResponse.json(
        { error: "invoiceId and approverType required" },
        { status: 400 }
      );
    }

    // Approve
    await approveInvoice({
      invoiceId,
      approverType,
      userId: user.id,
    });

    // Transition vendor status + route to next approver
    if (approverType === "producer" && campaignVendorId) {
      await transitionVendorStatus(campaignVendorId, "Invoice Pre-Approved");
      // Get campaign info to include in notification
      const db = createAdminClient();
      const { data: cv } = await db
        .from("campaign_vendors")
        .select("campaign_id, campaigns(name, wf_number)")
        .eq("id", campaignVendorId)
        .single();
      const campaign = (Array.isArray(cv?.campaigns) ? cv.campaigns[0] : cv?.campaigns) as { name: string; wf_number: string } | null;
      notifyAdmins({
        type: "invoice_submitted",
        level: "urgent",
        title: "Invoice ready for final approval",
        body: `A producer has pre-approved an invoice${campaign ? ` for ${campaign.wf_number} — ${campaign.name}` : ""}.`,
        campaignId: cv?.campaign_id,
      }).catch(() => {}); // non-blocking
    } else if (approverType === "hop" && campaignVendorId) {
      await transitionVendorStatus(campaignVendorId, "Invoice Approved");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
