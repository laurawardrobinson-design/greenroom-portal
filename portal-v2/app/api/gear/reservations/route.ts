import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createReservation, listReservations } from "@/lib/services/gear.service";

// GET /api/gear/reservations?gearItemId=xxx&userId=xxx&upcoming=true
export async function GET(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const { searchParams } = new URL(request.url);
    const reservations = await listReservations({
      gearItemId: searchParams.get("gearItemId") || undefined,
      userId: searchParams.get("userId") || undefined,
      upcoming: searchParams.get("upcoming") === "true",
    });
    return NextResponse.json(reservations);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/gear/reservations
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const body = await request.json();
    const { gearItemId, campaignId, startDate, endDate, notes } = body;

    if (!gearItemId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "gearItemId, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    const reservation = await createReservation({
      gearItemId,
      userId: user.id,
      campaignId: campaignId || undefined,
      startDate,
      endDate,
      notes,
    });
    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already reserved")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}
