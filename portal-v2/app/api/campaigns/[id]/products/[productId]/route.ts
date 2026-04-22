import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { setCampaignProductRole, unlinkProductFromCampaign } from "@/lib/services/products.service";
import type { CampaignProductRole } from "@/types/domain";

// PATCH /api/campaigns/[id]/products/[productId] — set hero/secondary role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    await requireRole(["Admin", "Brand Marketing Manager"]);
    const { productId } = await params;
    const body = (await request.json()) as { role?: CampaignProductRole | null };
    const updated = await setCampaignProductRole(productId, body.role ?? null);
    return NextResponse.json(updated);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/campaigns/[id]/products/[productId] — unlink product from campaign
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; productId: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio"]);
    const { productId } = await params;
    await unlinkProductFromCampaign(productId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
