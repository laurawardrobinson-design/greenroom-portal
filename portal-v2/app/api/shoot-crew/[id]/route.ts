import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { removeShootCrew } from "@/lib/services/shoots.service";
import { createAdminClient } from "@/lib/supabase/admin";

// PATCH /api/shoot-crew/[id] — update crew role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;
    const body = await request.json();
    const db = createAdminClient();
    const update: Record<string, unknown> = {};
    if (body.roleOnShoot !== undefined) update.role_on_shoot = body.roleOnShoot;
    const { data, error } = await db
      .from("shoot_crew")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/shoot-crew/[id] — remove crew from a shoot
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;
    await removeShootCrew(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
