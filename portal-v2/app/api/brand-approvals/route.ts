import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse, AuthError } from "@/lib/auth/guards";
import {
  createApprovalRequest,
  getApprovalsForSubject,
  getPendingQueueForUser,
  type ApprovalState,
  type ApprovalSubjectType,
} from "@/lib/services/brand-approvals.service";

const VALID_SUBJECTS = [
  "campaign_brief",
  "shot_list",
  "variant_set",
  "final_asset",
] as const;

const VALID_STATES: ApprovalState[] = [
  "pending",
  "approved",
  "changes_requested",
  "rejected",
];

const REVIEWER_ROLES = ["Admin", "Brand Marketing Manager"] as const;

// GET /api/brand-approvals
//   ?assignedTo=me              → BMM queue
//   ?subject_type=...&subject_id=...  → decision trail for a subject
export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get("assignedTo");
    const subjectType = searchParams.get("subject_type");
    const subjectId = searchParams.get("subject_id");

    if (assignedTo === "me") {
      const queue = await getPendingQueueForUser(user.id);
      return NextResponse.json(queue);
    }

    if (subjectType && subjectId) {
      if (!VALID_SUBJECTS.includes(subjectType as ApprovalSubjectType)) {
        return NextResponse.json({ error: "Invalid subject_type" }, { status: 400 });
      }
      const trail = await getApprovalsForSubject(
        subjectType as ApprovalSubjectType,
        subjectId
      );
      return NextResponse.json(trail);
    }

    return NextResponse.json({ error: "Missing query params" }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/brand-approvals — BMM (or Admin) leaves a review on a subject.
// Producers cannot create approvals; they only respond by editing the
// subject itself.
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!REVIEWER_ROLES.includes(user.role as any)) {
      throw new AuthError("Only Brand Marketing Manager or Admin can leave brand reviews", 403);
    }
    const body = (await request.json()) as {
      subjectType?: string;
      subjectId?: string;
      campaignId?: string;
      comment?: string;
      state?: string;
    };

    if (!body.subjectType || !VALID_SUBJECTS.includes(body.subjectType as ApprovalSubjectType)) {
      return NextResponse.json({ error: "Invalid subjectType" }, { status: 400 });
    }
    if (!body.subjectId || !body.campaignId) {
      return NextResponse.json({ error: "subjectId and campaignId required" }, { status: 400 });
    }
    const state = VALID_STATES.includes(body.state as ApprovalState)
      ? (body.state as ApprovalState)
      : "pending";

    const approval = await createApprovalRequest(
      {
        subjectType: body.subjectType as ApprovalSubjectType,
        subjectId: body.subjectId,
        campaignId: body.campaignId,
        comment: body.comment,
        state,
      },
      user.id
    );
    return NextResponse.json(approval, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
