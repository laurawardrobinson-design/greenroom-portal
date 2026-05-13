import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listReservations,
  createReservation,
  deleteReservation,
  autoCreateFoodPlan,
} from "@/lib/services/studio.service";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const { searchParams } = new URL(request.url);
    const reservations = await listReservations({
      campaignId: searchParams.get("campaignId") ?? undefined,
      spaceId:    searchParams.get("spaceId") ?? undefined,
      dateFrom:   searchParams.get("dateFrom") ?? undefined,
      dateTo:     searchParams.get("dateTo") ?? undefined,
    });
    return NextResponse.json(reservations);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const body = await request.json();
    const { campaignId, spaceId, reservedDate, startTime, endTime, notes } = body;

    if (!campaignId || !spaceId || !reservedDate) {
      return NextResponse.json(
        { error: "campaignId, spaceId, and reservedDate are required" },
        { status: 400 }
      );
    }

    const reservation = await createReservation({
      campaignId,
      spaceId,
      reservedDate,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      notes: notes ?? null,
      reservedBy: user.id,
    });

    // Fire-and-forget: auto-create a food planning entry if crew exists
    autoCreateFoodPlan(campaignId, reservedDate, user.id).catch(() => {
      // Silently ignore — food plan is a convenience, not critical
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    // Supabase surfaces unique-violation as a PostgrestError (code 23505), not
    // an `Error` instance — so check the code directly.
    const pgCode = (error as { code?: string } | null)?.code;
    const pgMessage = (error as { message?: string } | null)?.message ?? "";
    if (pgCode === "23505" && pgMessage.includes("space_reservations")) {
      return NextResponse.json(
        { error: "That space is already reserved on this date." },
        { status: 409 }
      );
    }
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deleteReservation(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
