import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse, AuthError } from "@/lib/auth/guards";
import { resolveProductFlag } from "@/lib/services/product-flags.service";

// POST /api/product-flags/[id]/resolve
// Producer + Admin + Post Producer only. BMM cannot clear flags.
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
      throw new AuthError("Only producers can resolve flags", 403);
    }
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      note?: string;
    };
    const flag = await resolveProductFlag(id, user.id, body.note ?? "");
    return NextResponse.json(flag);
  } catch (error) {
    return authErrorResponse(error);
  }
}
