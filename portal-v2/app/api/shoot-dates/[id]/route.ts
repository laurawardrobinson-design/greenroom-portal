import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { removeShootDate } from "@/lib/services/shoots.service";
import { createAdminClient } from "@/lib/supabase/admin";

// PATCH /api/shoot-dates/[id] — update call time, location
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;
    const body = await request.json();
    const update: Record<string, unknown> = {};
    if (body.call_time !== undefined) update.call_time = body.call_time;
    if (body.location !== undefined) update.location = body.location;
    if (body.notes !== undefined) update.notes = body.notes;

    const db = createAdminClient();
    const { data, error } = await db
      .from("shoot_dates")
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

// DELETE /api/shoot-dates/[id] — remove a single shoot date
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;
    await removeShootDate(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
