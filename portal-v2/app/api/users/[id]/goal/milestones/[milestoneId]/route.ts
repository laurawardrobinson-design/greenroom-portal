import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGoalViewer, touchGoalActivity } from "@/lib/services/goals.service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id, milestoneId } = await params;

    const canView = await isGoalViewer(id, user.id);
    if (!canView) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await req.json();
    const supabase = createAdminClient();

    const updates: Record<string, unknown> = {};
    if (body.description !== undefined) updates.description = body.description;
    if (body.targetDate !== undefined) updates.target_date = body.targetDate || null;
    if (body.sortOrder !== undefined) updates.sort_order = body.sortOrder;
    if (body.completed !== undefined) {
      updates.completed = body.completed;
      updates.completed_at = body.completed ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from("goal_milestones")
      .update(updates)
      .eq("id", milestoneId)
      .select("*")
      .single();

    if (error) throw error;

    // Touch activity on the goal
    if (data.goal_id) await touchGoalActivity(data.goal_id);

    return NextResponse.json({
      id: data.id,
      goalId: data.goal_id,
      description: data.description,
      completed: data.completed,
      completedAt: data.completed_at,
      targetDate: data.target_date,
      sortOrder: data.sort_order,
      createdBy: data.created_by,
      createdAt: data.created_at,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id, milestoneId } = await params;

    const canView = await isGoalViewer(id, user.id);
    if (!canView) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("goal_milestones")
      .delete()
      .eq("id", milestoneId);

    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
