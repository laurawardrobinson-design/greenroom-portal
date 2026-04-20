import { createAdminClient } from "@/lib/supabase/admin";
import type { AppUser, UserRole } from "@/types/domain";

export type AssignmentRole = "primary_designer" | "primary_art_director" | "viewer";

export interface CampaignAssignment {
  id: string;
  campaignId: string;
  userId: string;
  assignmentRole: AssignmentRole;
  assignedBy: string | null;
  assignedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
}

function toAssignment(row: Record<string, unknown>): CampaignAssignment {
  const userRow = row.users as Record<string, unknown> | null | undefined;
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    userId: row.user_id as string,
    assignmentRole: row.assignment_role as AssignmentRole,
    assignedBy: (row.assigned_by as string) || null,
    assignedAt: row.assigned_at as string,
    user: userRow
      ? {
          id: userRow.id as string,
          name: (userRow.name as string) || "",
          email: (userRow.email as string) || "",
          role: userRow.role as UserRole,
        }
      : null,
  };
}

export async function listCampaignAssignments(
  campaignId: string
): Promise<CampaignAssignment[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_assignments")
    .select("*, users:user_id (id, name, email, role)")
    .eq("campaign_id", campaignId)
    .order("assigned_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(toAssignment);
}

export async function listCampaignsByPrimaryAssignee(
  userId: string,
  assignmentRole: "primary_designer" | "primary_art_director"
): Promise<string[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_assignments")
    .select("campaign_id")
    .eq("user_id", userId)
    .eq("assignment_role", assignmentRole);

  if (error) throw error;
  return (data || []).map((r) => r.campaign_id as string);
}

export async function upsertCampaignAssignment(input: {
  campaignId: string;
  userId: string;
  assignmentRole: AssignmentRole;
  assignedBy: string;
}): Promise<CampaignAssignment> {
  const db = createAdminClient();

  // For primary_* roles, delete any existing primary holder first (one per campaign).
  if (input.assignmentRole !== "viewer") {
    await db
      .from("campaign_assignments")
      .delete()
      .eq("campaign_id", input.campaignId)
      .eq("assignment_role", input.assignmentRole);
  }

  const { data, error } = await db
    .from("campaign_assignments")
    .upsert(
      {
        campaign_id: input.campaignId,
        user_id: input.userId,
        assignment_role: input.assignmentRole,
        assigned_by: input.assignedBy,
      },
      { onConflict: "campaign_id,user_id,assignment_role" }
    )
    .select("*, users:user_id (id, name, email, role)")
    .single();

  if (error) throw error;
  return toAssignment(data);
}

export async function deleteCampaignAssignment(assignmentId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("campaign_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) throw error;
}

export async function clearPrimaryAssignment(
  campaignId: string,
  assignmentRole: "primary_designer" | "primary_art_director"
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("campaign_assignments")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("assignment_role", assignmentRole);

  if (error) throw error;
}
