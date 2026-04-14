import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listRateCards,
  createRateCard,
  updateRateCard,
  deleteRateCard,
} from "@/lib/services/crew-bookings.service";

// GET /api/rate-cards
export async function GET() {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const cards = await listRateCards();
    return NextResponse.json(cards);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/rate-cards
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin"]);
    const body = await request.json();

    if (!body.role || !body.dayRate) {
      return NextResponse.json(
        { error: "role and dayRate are required" },
        { status: 400 }
      );
    }

    const card = await createRateCard({
      role: body.role,
      dayRate: Number(body.dayRate),
      notes: body.notes,
      createdBy: user.id,
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/rate-cards — update a rate card
export async function PATCH(request: Request) {
  try {
    await requireRole(["Admin"]);
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await updateRateCard(body.id, {
      role: body.role,
      dayRate: body.dayRate !== undefined ? Number(body.dayRate) : undefined,
      notes: body.notes,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/rate-cards
export async function DELETE(request: Request) {
  try {
    await requireRole(["Admin"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteRateCard(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
