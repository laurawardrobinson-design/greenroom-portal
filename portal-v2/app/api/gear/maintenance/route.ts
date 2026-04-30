import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listMaintenance, createMaintenance, updateMaintenance } from "@/lib/services/gear.service";

// GET /api/gear/maintenance?gearItemId=xxx
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const { searchParams } = new URL(request.url);
    const gearItemId = searchParams.get("gearItemId") || undefined;
    const records = await listMaintenance(gearItemId);
    return NextResponse.json(records);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/gear/maintenance
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Studio"]);
    const body = await request.json();
    const { gearItemId, type, description, scheduledDate, nextDueDate, cost, notes } = body;

    if (!gearItemId || !type || !description) {
      return NextResponse.json(
        { error: "gearItemId, type, and description are required" },
        { status: 400 }
      );
    }

    await createMaintenance({
      gearItemId,
      type,
      description,
      scheduledDate,
      nextDueDate,
      performedBy: user.id,
      cost,
      notes,
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/gear/maintenance?id=xxx
export async function PATCH(request: Request) {
  try {
    await requireRole(["Admin", "Studio"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const body = await request.json();
    await updateMaintenance(id, {
      status: body.status,
      completedDate: body.completedDate,
      notes: body.notes,
      cost: body.cost,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
