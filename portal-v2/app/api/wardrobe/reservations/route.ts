import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listWardrobeReservations,
  createWardrobeReservation,
} from "@/lib/services/wardrobe.service";
import { createReservationSchema } from "@/lib/validation/wardrobe.schema";

function zodErrorResponse(error: ZodError) {
  const fieldErrors = error.issues.reduce((acc: Record<string, string>, err) => {
    const path = err.path.join(".") || "unknown";
    acc[path] = err.message;
    return acc;
  }, {});
  return NextResponse.json({ error: "Validation failed", fieldErrors }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio"]);
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
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio"]);
    const body = await request.json();
    const parsed = createReservationSchema.parse(body);

    const reservation = await createWardrobeReservation({
      wardrobeItemId: parsed.wardrobeItemId,
      userId: user.id,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      campaignId: parsed.campaignId,
      notes: parsed.notes,
    });
    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodErrorResponse(error);
    if (error instanceof Error && error.message.includes("already reserved")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}
