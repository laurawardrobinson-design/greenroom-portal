import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getAssetStudioSummary } from "@/lib/services/asset-studio.service";

// GET /api/asset-studio/summary — dashboard counters + recent runs
export async function GET() {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director"]);
    const summary = await getAssetStudioSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return authErrorResponse(error);
  }
}
