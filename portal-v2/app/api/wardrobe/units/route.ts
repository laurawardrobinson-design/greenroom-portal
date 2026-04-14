import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listWardrobeUnits, createWardrobeUnit } from "@/lib/services/wardrobe-units.service";
import { createUnitSchema } from "@/lib/validation/wardrobe.schema";

export async function GET(request: Request) {
  try {
    await getAuthUser();
    const { searchParams } = new URL(request.url);
    const units = await listWardrobeUnits({
      wardrobeItemId: searchParams.get("wardrobeItemId") ?? undefined,
      size: searchParams.get("size") ?? undefined,
      gender: searchParams.get("gender") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });
    return NextResponse.json(units);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const body = await request.json();
    const parsed = createUnitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const units = await createWardrobeUnit(
      {
        wardrobeItemId: parsed.data.wardrobeItemId,
        size: parsed.data.size,
        gender: parsed.data.gender,
        condition: parsed.data.condition,
        qrCode: parsed.data.qrCode,
        notes: parsed.data.notes,
        quantity: parsed.data.quantity,
      },
      user.id
    );
    return NextResponse.json(units, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
