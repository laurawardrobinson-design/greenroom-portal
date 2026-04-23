import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse, AuthError } from "@/lib/auth/guards";
import { reopenProductFlag } from "@/lib/services/product-flags.service";

// POST /api/product-flags/[id]/reopen
// Same gate as resolve — Producer/Post Producer/Admin.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (
      user.role !== "Producer" &&
      user.role !== "Post Producer" &&
      user.role !== "Admin"
    ) {
      throw new AuthError("Only producers can reopen flags", 403);
    }
    const { id } = await params;
    const flag = await reopenProductFlag(id);
    return NextResponse.json(flag);
  } catch (error) {
    return authErrorResponse(error);
  }
}
