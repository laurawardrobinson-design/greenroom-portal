import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listVersions } from "@/lib/services/call-sheet.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Art Director",
      "Studio",
      "Creative Director",
      "Designer",
      "Brand Marketing Manager",
    ]);
    const { id } = await params;
    const versions = await listVersions(id);
    return NextResponse.json(versions);
  } catch (error) {
    return authErrorResponse(error);
  }
}
