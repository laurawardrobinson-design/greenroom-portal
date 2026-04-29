import { NextResponse } from "next/server";
import {
  getAuthUser,
  authErrorResponse,
} from "@/lib/auth/guards";
import { updateProductFlagBody } from "@/lib/services/product-flags.service";

// PATCH /api/product-flags/[id]  body: { comment: string }
// Only the user who raised the flag can edit its comment.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const body = (await request.json()) as { comment?: string };
    const text = (body.comment ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Comment cannot be empty" },
        { status: 400 }
      );
    }
    const updated = await updateProductFlagBody({
      flagId: id,
      raisedByUserId: user.id,
      comment: text,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return authErrorResponse(error);
  }
}
