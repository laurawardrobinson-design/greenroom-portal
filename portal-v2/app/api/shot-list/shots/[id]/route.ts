import { NextResponse } from "next/server";
import { requireRole, getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import {
  updateShot, deleteShot,
  linkDeliverable, unlinkDeliverable,
  linkProduct, unlinkProduct,
} from "@/lib/services/shot-list.service";
import { updateShotSchema } from "@/lib/validation/shot-list.schema";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Studio can mark shots complete, Producers and ADs can edit everything
    const user = await requireRole(["Admin", "Producer", "Art Director", "Studio"]);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateShotSchema.parse(body);
    const shot = await updateShot(id, parsed, user.id);
    return NextResponse.json(shot);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Art Director"]);
    const { id } = await params;
    await deleteShot(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST to link/unlink deliverables or products
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Art Director"]);
    const { id: shotId } = await params;
    const body = await request.json();

    // Product linking
    if (body.campaignProductId) {
      const { campaignProductId, action, notes, quantity } = body;
      if (action === "unlink") {
        await unlinkProduct(shotId, campaignProductId);
        return NextResponse.json({ success: true });
      } else {
        const link = await linkProduct(shotId, campaignProductId, notes || "", quantity || "");
        return NextResponse.json(link, { status: 201 });
      }
    }

    // Deliverable linking
    const { deliverableId, action } = body;
    if (!deliverableId) {
      return NextResponse.json({ error: "deliverableId or campaignProductId required" }, { status: 400 });
    }

    if (action === "unlink") {
      await unlinkDeliverable(shotId, deliverableId);
      return NextResponse.json({ success: true });
    } else {
      const link = await linkDeliverable(shotId, deliverableId);
      return NextResponse.json(link, { status: 201 });
    }
  } catch (error) {
    return authErrorResponse(error);
  }
}
