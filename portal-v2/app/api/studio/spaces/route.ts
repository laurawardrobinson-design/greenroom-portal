import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listSpaces } from "@/lib/services/studio.service";

export async function GET() {
  try {
    await requireRole(["Admin", "Producer", "Studio"]);
    const spaces = await listSpaces();
    return NextResponse.json(spaces);
  } catch (error) {
    return authErrorResponse(error);
  }
}
