import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listPendingBatches } from "@/lib/services/pending-batches.service";

// GET /api/asset-studio/pending-batches
// Returns every run with at least one 'rendered' (pending review) variant,
// grouped for the Creative/Design Director approval inbox.
export async function GET() {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
      "Creative Director",
    ]);
    const batches = await listPendingBatches();
    return NextResponse.json(batches);
  } catch (error) {
    return authErrorResponse(error);
  }
}
