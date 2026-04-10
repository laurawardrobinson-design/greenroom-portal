import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listWardrobeReservations,
  createWardrobeReservation,
} from "@/lib/services/wardrobe.service";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Art Director", "Studio"]);
    const { searchParams } = new URL(request.url);
    const wardrobeItemId = searchParams.get("wardrobeItemId") || undefined;
    const upcoming = searchParams.get("upcoming") === "true";

    const reservations = await listWardrobeReservations({ wardrobeItemId, upcoming });
    return NextResponse.json(reservations);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Art Director", "Studio"]);
    const body = await request.json();

    if (!body.wardrobeItemId || !body.startDate || !body.endDate) {
      return NextResponse.json({ error: "wardrobeItemId, startDate, endDate required" }, { status: 400 });
    }

    const reservation = await createWardrobeReservation({
      wardrobeItemId: body.wardrobeItemId,
      userId: user.id,
      startDate: body.startDate,
      endDate: body.endDate,
      campaignId: body.campaignId,
      notes: body.notes,
    });
    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already reserved")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}
