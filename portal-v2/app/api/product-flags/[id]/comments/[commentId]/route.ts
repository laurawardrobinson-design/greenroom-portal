import { NextResponse } from "next/server";
import {
  getAuthUser,
  authErrorResponse,
  AuthError,
} from "@/lib/auth/guards";
import { updateProductFlagComment } from "@/lib/services/product-flags.service";

// PATCH /api/product-flags/[id]/comments/[commentId]  body: { body: string }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (
      user.role !== "Admin" &&
      user.role !== "Producer" &&
      user.role !== "Post Producer" &&
      user.role !== "Brand Marketing Manager"
    ) {
      throw new AuthError("Not allowed to edit comments", 403);
    }
    const { commentId } = await params;
    const body = (await request.json()) as { body?: string };
    const text = (body.body ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Comment cannot be empty" },
        { status: 400 }
      );
    }
    const updated = await updateProductFlagComment({
      commentId,
      authorUserId: user.id,
      body: text,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return authErrorResponse(error);
  }
}
