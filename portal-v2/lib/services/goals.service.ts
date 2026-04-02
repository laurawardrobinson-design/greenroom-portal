import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Check if a user can view private goal details (milestones, highlights, etc.)
 * Returns true if the user is the goal owner or an assigned stakeholder.
 */
export async function isGoalViewer(goalUserId: string, viewerId: string): Promise<boolean> {
  if (viewerId === goalUserId) return true;

  const supabase = createAdminClient();
  const { data: goal } = await supabase
    .from("user_goals")
    .select("id")
    .eq("user_id", goalUserId)
    .maybeSingle();

  if (!goal) return false;

  const { data: stake } = await supabase
    .from("goal_stakeholders")
    .select("id")
    .eq("goal_id", goal.id)
    .eq("user_id", viewerId)
    .maybeSingle();

  return !!stake;
}

/**
 * Get the goal ID for a user, or null if no goal exists.
 */
export async function getGoalId(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user_goals")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id || null;
}

/**
 * Update last_activity_at on a goal to track staleness.
 */
export async function touchGoalActivity(goalId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("user_goals")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", goalId);
}

/**
 * Auto-add all Admin users as stakeholders to a goal (HOP assignment on creation).
 */
export async function autoAddAdminStakeholders(goalId: string, assignedBy: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .eq("role", "Admin")
    .eq("active", true);

  if (!admins?.length) return;

  const inserts = admins.map((a) => ({
    goal_id: goalId,
    user_id: a.id,
    assigned_by: assignedBy,
  }));

  // Use upsert to avoid conflicts if already assigned
  await supabase
    .from("goal_stakeholders")
    .upsert(inserts, { onConflict: "goal_id,user_id" });
}
