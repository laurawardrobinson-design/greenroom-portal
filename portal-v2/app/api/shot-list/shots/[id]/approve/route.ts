import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { approveShot, unapproveShot } from "@/lib/services/shot-list.service";

// POST = approve (stamps approved_by, approved_at, approved_snapshot)
// DELETE = revoke approval
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([
      "Admin",
      "Creative Director",
      "Art Director",
      "Producer",
      "Post Producer",
    ]);
    const { id } = await params;
    const shot = await approveShot(id, user.id);
    return NextResponse.json(shot);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      "Admin",
      "Creative Director",
      "Art Director",
      "Producer",
      "Post Producer",
    ]);
    const { id } = await params;
    const shot = await unapproveShot(id);
    return NextResponse.json(shot);
  } catch (error) {
    return authErrorResponse(error);
  }
}
