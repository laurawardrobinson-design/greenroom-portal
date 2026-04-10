import { NextResponse } from "next/server";
import { getAuthUser, requireRole, requireVendorOwnership, authErrorResponse } from "@/lib/auth/guards";
import {
  getCampaignVendor,
  transitionVendorStatus,
  submitEstimate,
  getEstimateItems,
  updateEstimateItems,
  removeVendorFromCampaign,
} from "@/lib/services/campaign-vendors.service";
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

    if (user.role === "Vendor") {
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

    // Submit estimate (vendor action)
    if (body.action === "submit_estimate") {
      if (user.role === "Vendor") {
        await requireVendorOwnership(user, id);
      } else {
        await requireRole(["Admin", "Producer"]);
      }

      const parsed = submitEstimateSchema.parse({
        campaignVendorId: id,
        items: body.items,
        estimateFileUrl: body.estimateFileUrl,
        estimateFileName: body.estimateFileName,
      });
      await submitEstimate(id, parsed.items, {
        estimateFileUrl: parsed.estimateFileUrl,
        estimateFileName: parsed.estimateFileName,
      });
      const cv = await getCampaignVendor(id);
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
        }
      } else if (producerActions.includes(targetStatus)) {
        await requireRole(["Admin", "Producer"]);
      } else if (hopActions.includes(targetStatus)) {
        await requireRole(["Admin"]);
      }

      const cv = await transitionVendorStatus(id, targetStatus, body.payload);
      return NextResponse.json(cv);
    }

    // Update estimate items (producer correction)
    if (body.action === "update_estimate_items") {
      await requireRole(["Admin", "Producer"]);
      await updateEstimateItems(id, body.items);
      const [cv, estimateItems] = await Promise.all([getCampaignVendor(id), getEstimateItems(id)]);
      return NextResponse.json({ ...cv, estimateItems });
    }

    // Update campaign-level role override
    if (body.action === "update_campaign_role") {
      await requireRole(["Admin", "Producer"]);
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const db = createAdminClient();
      const { error } = await db
        .from("campaign_vendors")
        .update({ campaign_role: body.campaignRole ?? null })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
