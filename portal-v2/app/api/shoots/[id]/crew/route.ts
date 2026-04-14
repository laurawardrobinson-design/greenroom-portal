import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { addShootCrew } from "@/lib/services/shoots.service";

// POST /api/shoots/[id]/crew — add crew to a shoot
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;
    const { userId, roleOnShoot, notes, shootDateId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    const crew = await addShootCrew(id, userId, roleOnShoot || "", notes || "", shootDateId || null);
    return NextResponse.json(crew, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}
