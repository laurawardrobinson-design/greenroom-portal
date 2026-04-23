import { createAdminClient } from "@/lib/supabase/admin";

export type ApprovalSubjectType =
  | "campaign_brief"
  | "shot_list"
  | "variant_set"
  | "final_asset";

export type ApprovalState =
  | "pending"
  | "approved"
  | "changes_requested"
  | "rejected"
  | "withdrawn";

export interface BrandApproval {
  id: string;
  subjectType: ApprovalSubjectType;
  subjectId: string;
  campaignId: string;
  requestedBy: string | null;
  assignedTo: string | null;
  state: ApprovalState;
  comment: string;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrandApprovalQueueItem extends BrandApproval {
  campaignWfNumber: string;
  campaignName: string;
  requesterName: string | null;
  subjectLabel: string;
}

export const SUBJECT_LABELS: Record<ApprovalSubjectType, string> = {
  campaign_brief: "Campaign brief",
  shot_list: "Shot list",
  variant_set: "Variant set",
  final_asset: "Final asset",
};

function toApproval(row: any): BrandApproval {
  return {
    id: row.id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    campaignId: row.campaign_id,
    requestedBy: row.requested_by ?? null,
    assignedTo: row.assigned_to ?? null,
    state: row.state,
    comment: row.comment ?? "",
    decidedAt: row.decided_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ------------------------------------------------------------
// Create (requester side)
// ------------------------------------------------------------

// BMM-initiated review on a subject (brief, shot list, variant set, etc.).
// Producers never call this; it's how a BMM leaves a note on something
// they're reviewing inside their portfolio. `state` defaults to the final
// decision — most reviews flip straight to approved or changes_requested,
// no "pending" inbox for the producer.
export async function createApprovalRequest(
  input: {
    subjectType: ApprovalSubjectType;
    subjectId: string;
    campaignId: string;
    comment?: string;
    state?: ApprovalState;
  },
  reviewerId: string
): Promise<BrandApproval> {
  const db = createAdminClient();
  const finalState: ApprovalState = input.state ?? "pending";

  // Supersede any earlier open review on the same subject so the most
  // recent decision wins (and the "awaiting producer follow-up" queue
  // doesn't double-count when the BMM re-reviews).
  await db
    .from("brand_approvals")
    .update({ state: "withdrawn", decided_at: new Date().toISOString() })
    .eq("subject_type", input.subjectType)
    .eq("subject_id", input.subjectId)
    .in("state", ["pending", "changes_requested"]);

  const decidedAt = finalState === "pending" ? null : new Date().toISOString();

  const { data, error } = await db
    .from("brand_approvals")
    .insert({
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      campaign_id: input.campaignId,
      requested_by: reviewerId,
      assigned_to: reviewerId,
      state: finalState,
      comment: input.comment ?? "",
      decided_at: decidedAt,
    })
    .select("*")
    .single();

  if (error) throw error;
  return toApproval(data);
}

// ------------------------------------------------------------
// Decide (assignee side)
// ------------------------------------------------------------

const DECISION_STATES = ["approved", "changes_requested", "rejected"] as const;
export type DecisionState = (typeof DECISION_STATES)[number];

export async function decideApproval(
  approvalId: string,
  decision: DecisionState,
  comment: string,
  deciderId: string
): Promise<BrandApproval> {
  if (decision !== "approved" && comment.trim().length === 0) {
    throw new Error("A comment is required when requesting changes or rejecting.");
  }

  const db = createAdminClient();

  const { data: existing } = await db
    .from("brand_approvals")
    .select("*")
    .eq("id", approvalId)
    .maybeSingle();
  if (!existing) throw new Error("Approval not found");
  if (existing.state !== "pending" && existing.state !== "changes_requested") {
    throw new Error(`Approval is already ${existing.state}; cannot re-decide.`);
  }

  const { data, error } = await db
    .from("brand_approvals")
    .update({
      state: decision,
      comment,
      decided_at: new Date().toISOString(),
      assigned_to: deciderId, // lock to the actual decider
    })
    .eq("id", approvalId)
    .select("*")
    .single();

  if (error) throw error;
  return toApproval(data);
}

export async function withdrawApproval(
  approvalId: string,
  requesterId: string
): Promise<BrandApproval> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("brand_approvals")
    .update({ state: "withdrawn", decided_at: new Date().toISOString() })
    .eq("id", approvalId)
    .eq("requested_by", requesterId)
    .select("*")
    .single();
  if (error) throw error;
  return toApproval(data);
}

// ------------------------------------------------------------
// Queries
// ------------------------------------------------------------

export async function getApprovalsForSubject(
  subjectType: ApprovalSubjectType,
  subjectId: string
): Promise<BrandApproval[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("brand_approvals")
    .select("*")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toApproval);
}

// Reviews the BMM has left that are still awaiting Producer follow-up.
// Under the BMM-initiated model these are rows where the BMM flagged
// `changes_requested` and nothing newer has superseded it. `pending` is
// still included for backwards compatibility with any legacy rows.
export async function getPendingQueueForUser(
  userId: string
): Promise<BrandApprovalQueueItem[]> {
  const db = createAdminClient();

  const { data, error } = await db
    .from("brand_approvals")
    .select(
      `
      *,
      campaign:campaigns(wf_number, name),
      requester:users!brand_approvals_requested_by_fkey(name)
    `
    )
    .or(`requested_by.eq.${userId},assigned_to.eq.${userId}`)
    .in("state", ["pending", "changes_requested"])
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const base = toApproval(row);
    return {
      ...base,
      campaignWfNumber: row.campaign?.wf_number ?? "",
      campaignName: row.campaign?.name ?? "",
      requesterName: row.requester?.name ?? null,
      subjectLabel: SUBJECT_LABELS[base.subjectType],
    };
  });
}

// How many days old the approval is (for the "aging" chip).
export function daysAging(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}
