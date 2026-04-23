import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse, AuthError } from "@/lib/auth/guards";
import {
  decideApproval,
  type DecisionState,
} from "@/lib/services/brand-approvals.service";

const ALLOWED_DECIDERS = ["Admin", "Brand Marketing Manager"] as const;

// POST /api/brand-approvals/[id]/decide
// Body: { decision: 'approved' | 'changes_requested' | 'rejected', comment: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!ALLOWED_DECIDERS.includes(user.role as any)) {
      throw new AuthError("Only BMM or Admin can decide approvals", 403);
    }

    const { id } = await params;
    const body = (await request.json()) as { decision?: string; comment?: string };
    const decision = body.decision as DecisionState | undefined;

    if (!decision || !["approved", "changes_requested", "rejected"].includes(decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
    }

    const approval = await decideApproval(id, decision, body.comment ?? "", user.id);
    return NextResponse.json(approval);
  } catch (error) {
    return authErrorResponse(error);
  }
}
