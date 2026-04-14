import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  getWardrobeUnit,
  updateWardrobeUnit,
  deleteWardrobeUnit,
  checkoutUnit,
  checkinUnit,
} from "@/lib/services/wardrobe-units.service";
import { updateUnitSchema } from "@/lib/validation/wardrobe.schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthUser();
    const { id } = await params;
    const unit = await getWardrobeUnit(id);
    if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(unit);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const { id } = await params;
    const body = await request.json();

    // Action-based: checkout or checkin
    if (body.action === "checkout") {
      const checkoutId = await checkoutUnit({
        unitId: id,
        userId: user.id,
        campaignId: body.campaignId,
        condition: body.condition,
        notes: body.notes,
        dueDate: body.dueDate,
      });
      return NextResponse.json({ checkoutId });
    }

    if (body.action === "checkin") {
      await checkinUnit({
        checkoutId: body.checkoutId,
        condition: body.condition,
        notes: body.notes,
      });
      return NextResponse.json({ success: true });
    }

    // Regular field update
    const parsed = updateUnitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const updated = await updateWardrobeUnit(id, {
      size: parsed.data.size,
      gender: parsed.data.gender,
      status: parsed.data.status,
      condition: parsed.data.condition,
      qrCode: parsed.data.qrCode,
      notes: parsed.data.notes,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const { id } = await params;
    await deleteWardrobeUnit(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
