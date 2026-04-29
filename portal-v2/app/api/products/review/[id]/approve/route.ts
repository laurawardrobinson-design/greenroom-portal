import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { setCampaignProductRbuApproval } from "@/lib/services/products.service";

// POST /api/products/review/[id]/approve
// Marks a campaign_products link as approved-accurate by the RBU.
// id = campaign_products.id (the (campaign × product) link id).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Brand Marketing Manager",
      "Studio",
      "Art Director",
    ]);
    const { id } = await params;
    await setCampaignProductRbuApproval(id, true, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/products/review/[id]/approve
// Clears approval — moves the row back to Pending.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Brand Marketing Manager",
      "Studio",
      "Art Director",
    ]);
    const { id } = await params;
    await setCampaignProductRbuApproval(id, false, null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
