import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  createInvoice,
  getInvoiceForCampaignVendor,
  approveInvoice,
} from "@/lib/services/invoice.service";
import { transitionVendorStatus } from "@/lib/services/campaign-vendors.service";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/invoices?campaignVendorId=xxx
export async function GET(request: Request) {
  try {
    await getAuthUser();
    const { searchParams } = new URL(request.url);
    const campaignVendorId = searchParams.get("campaignVendorId");
    if (!campaignVendorId) {
      return NextResponse.json({ error: "campaignVendorId required" }, { status: 400 });
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

    // Transition vendor status
    if (approverType === "producer" && campaignVendorId) {
      await transitionVendorStatus(campaignVendorId, "Invoice Pre-Approved");
    } else if (approverType === "hop" && campaignVendorId) {
      await transitionVendorStatus(campaignVendorId, "Invoice Approved");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
