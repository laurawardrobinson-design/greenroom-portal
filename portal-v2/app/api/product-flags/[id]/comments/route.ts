import { NextResponse } from "next/server";
import {
  getAuthUser,
  requireRole,
  authErrorResponse,
  AuthError,
} from "@/lib/auth/guards";
import {
  listProductFlagComments,
  addProductFlagComment,
} from "@/lib/services/product-flags.service";

// GET /api/product-flags/[id]/comments
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Brand Marketing Manager",
      "Studio",
    ]);
    const { id } = await params;
    const comments = await listProductFlagComments(id);
    return NextResponse.json(comments);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/product-flags/[id]/comments  body: { body: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (
      user.role !== "Admin" &&
      user.role !== "Producer" &&
      user.role !== "Post Producer" &&
      user.role !== "Brand Marketing Manager"
    ) {
      throw new AuthError("Not allowed to comment", 403);
    }
    const { id } = await params;
    const body = (await request.json()) as { body?: string };
    const text = (body.body ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Comment cannot be empty" },
        { status: 400 }
      );
    }
    const comment = await addProductFlagComment({
      flagId: id,
      body: text,
      authorUserId: user.id,
      authorLabel: user.role,
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
