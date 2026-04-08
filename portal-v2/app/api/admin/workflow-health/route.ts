import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth/guards";
import { getWorkflowHealthSnapshot } from "@/lib/services/workflow-health.service";
import { resolveWorkflowPilotScope } from "@/lib/services/workflow-pilot.service";

// GET /api/admin/workflow-health
// Aggregated rollout health metrics + regression alerts for v2 workflow.
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer"]);
    const { searchParams } = new URL(request.url);
    const scope = resolveWorkflowPilotScope(searchParams.get("scope"));
    const snapshot = await getWorkflowHealthSnapshot({ scope });
    return NextResponse.json(snapshot);
  } catch (error) {
    return authErrorResponse(error);
  }
}
