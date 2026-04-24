import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { removeAttachment } from "@/lib/services/call-sheet.service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director"]);
    const { attachmentId } = await params;
    await removeAttachment(attachmentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
