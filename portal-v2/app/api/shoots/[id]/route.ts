import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { updateShoot, deleteShoot } from "@/lib/services/shoots.service";
import { updateShootSchema } from "@/lib/validation/campaigns.schema";

// PATCH /api/shoots/[id] — update shoot metadata
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateShootSchema.parse(body);
    const shoot = await updateShoot(id, parsed);
    return NextResponse.json(shoot);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}

// DELETE /api/shoots/[id] — delete a shoot (cascades dates + crew)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;
    await deleteShoot(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
