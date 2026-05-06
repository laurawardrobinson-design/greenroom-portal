import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse, AuthError } from "@/lib/auth/guards";
import { acceptProductFlagProposal } from "@/lib/services/product-flags.service";

// POST /api/product-flags/[id]/accept
// Producer + Admin + Post Producer only. Applies the flag's
// proposed_changes to the underlying product, then resolves the flag.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (
      user.role !== "Producer" &&
      user.role !== "Post Producer" &&
      user.role !== "Admin"
    ) {
      throw new AuthError("Only producers can accept proposals", 403);
    }
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { note?: string };
    const flag = await acceptProductFlagProposal(id, user.id, body.note ?? "");
    return NextResponse.json(flag);
  } catch (error) {
    return authErrorResponse(error);
  }
}
