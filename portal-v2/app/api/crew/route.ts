import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listShootCrew,
  addShootCrewMember,
  removeShootCrewMember,
} from "@/lib/services/crew.service";

// GET /api/crew?shootId=xxx
export async function GET(request: Request) {
  try {
    await getAuthUser();
    const { searchParams } = new URL(request.url);
    const shootId = searchParams.get("shootId");
    if (!shootId) {
      return NextResponse.json({ error: "shootId required" }, { status: 400 });
    }
    const crew = await listShootCrew(shootId);
    return NextResponse.json(crew);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/crew — add crew member to a shoot
export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const body = await request.json();
    const { shootId, userId, roleOnShoot, notes } = body;
    if (!shootId || !userId) {
      return NextResponse.json(
        { error: "shootId and userId are required" },
        { status: 400 }
      );
    }
    const member = await addShootCrewMember({
      shootId,
      userId,
      roleOnShoot: roleOnShoot || "",
      notes,
    });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}

// DELETE /api/crew?id=xxx
export async function DELETE(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await removeShootCrewMember(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
