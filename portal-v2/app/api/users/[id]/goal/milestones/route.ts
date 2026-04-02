import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGoalViewer, getGoalId, touchGoalActivity } from "@/lib/services/goals.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;

    const canView = await isGoalViewer(id, user.id);
    if (!canView) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const goalId = await getGoalId(id);
    if (!goalId) return NextResponse.json([]);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("goal_milestones")
      .select("*")
      .eq("goal_id", goalId)
      .order("sort_order")
      .order("created_at");

    if (error) throw error;

    const mapped = (data ?? []).map((m) => ({
      id: m.id,
      goalId: m.goal_id,
      description: m.description,
      completed: m.completed,
      completedAt: m.completed_at,
      targetDate: m.target_date,
      sortOrder: m.sort_order,
      createdBy: m.created_by,
      createdAt: m.created_at,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;

    const canView = await isGoalViewer(id, user.id);
    if (!canView) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const goalId = await getGoalId(id);
    if (!goalId) {
      return NextResponse.json({ error: "No goal found" }, { status: 404 });
    }

    const { description, targetDate } = await req.json();
    if (!description?.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get next sort order
    const { data: existing } = await supabase
      .from("goal_milestones")
      .select("sort_order")
      .eq("goal_id", goalId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from("goal_milestones")
      .insert({
        goal_id: goalId,
        description: description.trim(),
        target_date: targetDate || null,
        sort_order: nextOrder,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) throw error;

    await touchGoalActivity(goalId);

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
    }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
