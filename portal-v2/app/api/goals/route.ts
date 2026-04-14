import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/services/notifications.service";

export async function GET() {
  try {
    const user = await getAuthUser();

    // Vendors cannot access the goals overview
    if (user.role === "Vendor") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const supabase = createAdminClient();

    // Fetch all active internal users (non-vendor) with their goals
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, role, title, favorite_publix_product, active")
      .in("role", ["Admin", "Producer", "Post Producer", "Studio", "Art Director"])
      .eq("active", true)
      .order("name");

    if (usersError) throw usersError;

    // Fetch all goals
    const { data: goals, error: goalsError } = await supabase
      .from("user_goals")
      .select("id, user_id, goal_text, current_role_context, last_activity_at, updated_at");

    if (goalsError) throw goalsError;

    const goalIds = (goals ?? []).map((g) => g.id);

    // Fetch advice counts
    let adviceCounts: Record<string, number> = {};
    if (goalIds.length > 0) {
      const { data: counts } = await supabase
        .from("goal_advice")
        .select("goal_id")
        .in("goal_id", goalIds);
      if (counts) {
        for (const row of counts) {
          adviceCounts[row.goal_id] = (adviceCounts[row.goal_id] || 0) + 1;
        }
      }
    }

    // Fetch milestone counts per goal
    let milestoneCounts: Record<string, { total: number; completed: number }> = {};
    if (goalIds.length > 0) {
      const { data: milestones } = await supabase
        .from("goal_milestones")
        .select("goal_id, completed")
        .in("goal_id", goalIds);
      if (milestones) {
        for (const m of milestones) {
          if (!milestoneCounts[m.goal_id]) milestoneCounts[m.goal_id] = { total: 0, completed: 0 };
          milestoneCounts[m.goal_id].total++;
          if (m.completed) milestoneCounts[m.goal_id].completed++;
        }
      }
    }

    // Fetch stakeholder assignments for the current user (to know which goals they can see details for)
    const { data: myStakes } = await supabase
      .from("goal_stakeholders")
      .select("goal_id")
      .eq("user_id", user.id);

    const myStakeGoalIds = new Set((myStakes ?? []).map((s) => s.goal_id));

    // Build goal lookup
    const goalsByUserId: Record<string, (typeof goals)[0]> = {};
    for (const g of goals ?? []) {
      goalsByUserId[g.user_id] = g;
    }

    const mapped = (users ?? []).map((u) => {
      const goal = goalsByUserId[u.id] || null;
      const isStakeholder = goal ? (u.id === user.id || myStakeGoalIds.has(goal.id)) : false;

      return {
        id: u.id,
        name: u.name,
        role: u.role,
        title: u.title || "",
        favoritePublixProduct: u.favorite_publix_product || "",
        goal: goal
          ? {
              id: goal.id,
              goalText: goal.goal_text,
              currentRoleContext: goal.current_role_context,
              updatedAt: goal.updated_at,
              lastActivityAt: goal.last_activity_at,
              adviceCount: adviceCounts[goal.id] || 0,
              // Only show milestone progress to stakeholders
              milestones: isStakeholder ? (milestoneCounts[goal.id] || { total: 0, completed: 0 }) : undefined,
              isStakeholder,
            }
          : null,
      };
    });

    // Stale goal check: if user is Admin, check for goals with no activity in 3+ months
    // and create gentle notifications (with 30-day dedup)
    if (user.role === "Admin") {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const g of goals ?? []) {
        const activityDate = g.last_activity_at || g.updated_at;
        if (new Date(activityDate) < threeMonthsAgo) {
          // Check dedup: was a stale notification already sent in last 30 days?
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", user.id)
            .eq("type", "goal_stale_checkin")
            .like("body", `%${g.user_id}%`)
            .gte("created_at", thirtyDaysAgo.toISOString())
            .limit(1);

          if (!existing?.length) {
            const goalOwner = (users ?? []).find((u) => u.id === g.user_id);
            if (goalOwner) {
              await createNotification({
                userId: user.id,
                type: "goal_stale_checkin",
                level: "info",
                title: `Check in on ${goalOwner.name}'s growth plan`,
                body: `It's been a while since ${goalOwner.name} updated their growth plan — might be a good time to check in. [${g.user_id}]`,
              });
            }
          }
        }
      }
    }

    return NextResponse.json(mapped);
  } catch (error) {
    return authErrorResponse(error);
  }
}
