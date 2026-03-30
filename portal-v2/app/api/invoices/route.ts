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

// POST /api/invoices — upload invoice file + create record
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

    // Upload to Supabase storage
    const db = createAdminClient();
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `invoices/${campaignVendorId}/${fileName}`;

    const { error: uploadError } = await db.storage
      .from("files")
      .upload(filePath, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    const { data: publicUrl } = db.storage.from("files").getPublicUrl(filePath);

    // Create invoice record
    const invoice = await createInvoice({
      campaignVendorId,
      fileUrl: publicUrl.publicUrl,
      fileName: file.name,
    });

    // Transition vendor status to "Invoice Submitted"
    await transitionVendorStatus(campaignVendorId, "Invoice Submitted");

    // Trigger edge function for AI parsing (fire-and-forget)
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
          fileUrl: publicUrl.publicUrl,
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
