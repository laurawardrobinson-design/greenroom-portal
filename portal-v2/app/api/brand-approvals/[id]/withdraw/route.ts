import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { withdrawApproval } from "@/lib/services/brand-approvals.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const approval = await withdrawApproval(id, user.id);
    return NextResponse.json(approval);
  } catch (error) {
    return authErrorResponse(error);
  }
}
