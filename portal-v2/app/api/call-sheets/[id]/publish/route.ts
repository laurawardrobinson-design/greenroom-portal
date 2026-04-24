import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { publishVersion } from "@/lib/services/call-sheet.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Art Director",
    ]);
    const { id } = await params;
    const version = await publishVersion(id, user.id);
    return NextResponse.json(version);
  } catch (error) {
    // Publish validation errors are user-facing — surface them as 400.
    if (error instanceof Error && error.message.startsWith("Cannot publish:")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
