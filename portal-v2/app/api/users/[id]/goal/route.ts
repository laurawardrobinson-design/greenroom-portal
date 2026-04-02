import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGoalViewer, autoAddAdminStakeholders } from "@/lib/services/goals.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: goal, error } = await supabase
      .from("user_goals")
      .select("id, user_id, goal_text, current_role_context, last_activity_at, created_at, updated_at")
      .eq("user_id", id)
      .maybeSingle();

    if (error) throw error;
    if (!goal) return NextResponse.json({ goal: null, advice: [], milestones: [], highlights: [], stakeholders: [], isPrivateViewer: false });

    // Check if this user can see private details (owner or stakeholder)
    const isPrivate = await isGoalViewer(id, user.id);

    const result: Record<string, unknown> = {
      goal: {
        id: goal.id,
        userId: goal.user_id,
        goalText: goal.goal_text,
        currentRoleContext: goal.current_role_context,
        lastActivityAt: goal.last_activity_at,
        createdAt: goal.created_at,
        updatedAt: goal.updated_at,
      },
      isPrivateViewer: isPrivate,
    };

    if (isPrivate) {
      // Advice
      const { data: adviceData } = await supabase
        .from("goal_advice")
        .select("id, text, author_id, author_name, created_at")
        .eq("goal_id", goal.id)
        .order("created_at", { ascending: true });

      result.advice = (adviceData ?? []).map((a) => ({
        id: a.id,
        text: a.text,
        authorId: a.author_id,
        authorName: a.author_name,
        createdAt: a.created_at,
      }));

      // Milestones
      const { data: milestoneData } = await supabase
        .from("goal_milestones")
        .select("*")
        .eq("goal_id", goal.id)
        .order("sort_order")
        .order("created_at");

      result.milestones = (milestoneData ?? []).map((m) => ({
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

      // Highlights (most recent 10)
      const { data: highlightData } = await supabase
        .from("goal_highlights")
        .select("*, goal_highlight_files(*), goal_highlight_feedback(*)")
        .eq("goal_id", goal.id)
        .order("created_at", { ascending: false })
        .limit(10);

      result.highlights = (highlightData ?? []).map((h) => ({
        id: h.id,
        goalId: h.goal_id,
        text: h.text,
        links: h.links || [],
        createdAt: h.created_at,
        files: ((h.goal_highlight_files as Array<Record<string, unknown>>) || []).map((f) => ({
          id: f.id,
          fileUrl: f.file_url,
          fileName: f.file_name,
          fileSize: f.file_size,
          fileType: f.file_type,
        })),
        feedback: ((h.goal_highlight_feedback as Array<Record<string, unknown>>) || [])
          .sort((a, b) => (a.created_at as string).localeCompare(b.created_at as string))
          .map((f) => ({
            id: f.id,
            text: f.text,
            authorId: f.author_id,
            authorName: f.author_name,
            createdAt: f.created_at,
          })),
      }));

      // Stakeholders
      const { data: stakeData } = await supabase
        .from("goal_stakeholders")
        .select("id, goal_id, user_id, assigned_by, created_at, users!goal_stakeholders_user_id_fkey(id, name, role, favorite_publix_product)")
        .eq("goal_id", goal.id);

      result.stakeholders = (stakeData ?? []).map((s) => {
        const u = s.users as unknown as Record<string, unknown> | null;
        return {
          id: s.id,
          goalId: s.goal_id,
          userId: s.user_id,
          assignedBy: s.assigned_by,
          createdAt: s.created_at,
          user: u ? { id: u.id, name: u.name, role: u.role, favoritePublixProduct: u.favorite_publix_product || "" } : undefined,
        };
      });

      // Milestone progress summary
      const allMilestones = milestoneData ?? [];
      result.milestoneProgress = {
        total: allMilestones.length,
        completed: allMilestones.filter((m) => m.completed).length,
      };
    } else {
      result.advice = [];
      result.milestones = [];
      result.highlights = [];
      result.stakeholders = [];
    }

    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;

    // Only self or Admin can set/update a goal
    if (user.id !== id && user.role !== "Admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { goalText, currentRoleContext } = await req.json();
    if (!goalText?.trim()) {
      return NextResponse.json({ error: "Goal text is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Check if this is a new goal (for auto-stakeholder assignment)
    const { data: existing } = await supabase
      .from("user_goals")
      .select("id")
      .eq("user_id", id)
      .maybeSingle();

    const isNew = !existing;

    const { data, error } = await supabase
      .from("user_goals")
      .upsert(
        {
          user_id: id,
          goal_text: goalText.trim(),
          current_role_context: (currentRoleContext || "").trim(),
          updated_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("id, user_id, goal_text, current_role_context, created_at, updated_at")
      .single();

    if (error) throw error;

    // Auto-add Admin users as stakeholders on new goal
    if (isNew) {
      await autoAddAdminStakeholders(data.id, user.id);
    }

    return NextResponse.json({
      id: data.id,
      userId: data.user_id,
      goalText: data.goal_text,
      currentRoleContext: data.current_role_context,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;

    // Only self or Admin can clear a goal
    if (user.id !== id && user.role !== "Admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("user_goals")
      .delete()
      .eq("user_id", id);

    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
