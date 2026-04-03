import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  getVendorOnboarding,
  updateOnboardingItem,
  getOnboardingStatus,
} from "@/lib/services/onboarding.service";

// GET /api/onboarding/[vendorId] — checklist + status
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    await requireRole(["Admin", "Producer"]);
    const { vendorId } = await params;
    const items = await getVendorOnboarding(vendorId);
    const status = await getOnboardingStatus(vendorId);
    return NextResponse.json({ items, status });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/onboarding/[vendorId] — update a single checklist item
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    await requireRole(["Admin", "Producer"]);
    await params; // vendorId not needed for update (we use itemId)
    const body = await request.json();
    // body: { itemId, completed, completedDate?, expiresAt?, notes? }
    const item = await updateOnboardingItem(body.itemId, {
      completed: body.completed,
      completedDate: body.completedDate,
      expiresAt: body.expiresAt,
      notes: body.notes,
    });
    return NextResponse.json(item);
  } catch (error) {
    return authErrorResponse(error);
  }
}
