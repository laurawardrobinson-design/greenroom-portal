import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGoalViewer, getGoalId } from "@/lib/services/goals.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (user.role === "Vendor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;

    const canView = await isGoalViewer(id, user.id);
    if (!canView) {
      return NextResponse.json({ error: "Not a stakeholder" }, { status: 403 });
    }

    const goalId = await getGoalId(id);
    if (!goalId) return NextResponse.json([]);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("goal_stakeholders")
      .select("id, goal_id, user_id, assigned_by, created_at, users!goal_stakeholders_user_id_fkey(id, name, role, favorite_publix_product)")
      .eq("goal_id", goalId)
      .order("created_at");

    if (error) throw error;

    const mapped = (data ?? []).map((s) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = s.users as any;
      return {
        id: s.id,
        goalId: s.goal_id,
        userId: s.user_id,
        assignedBy: s.assigned_by,
        createdAt: s.created_at,
        user: u ? {
          id: u.id as string,
          name: u.name as string,
          role: u.role as string,
          favoritePublixProduct: (u.favorite_publix_product as string) || "",
        } : undefined,
      };
    });

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
    if (user.role === "Vendor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.role !== "Admin") {
      return NextResponse.json({ error: "Only Admin can assign stakeholders" }, { status: 403 });
    }

    const { id } = await params;
    const { stakeholderUserId } = await req.json();
    if (!stakeholderUserId) {
      return NextResponse.json({ error: "stakeholderUserId is required" }, { status: 400 });
    }

    const goalId = await getGoalId(id);
    if (!goalId) {
      return NextResponse.json({ error: "No goal found" }, { status: 404 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("goal_stakeholders")
      .upsert(
        { goal_id: goalId, user_id: stakeholderUserId, assigned_by: user.id },
        { onConflict: "goal_id,user_id" }
      )
      .select("id, goal_id, user_id, assigned_by, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      id: data.id,
      goalId: data.goal_id,
      userId: data.user_id,
      assignedBy: data.assigned_by,
      createdAt: data.created_at,
    }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
