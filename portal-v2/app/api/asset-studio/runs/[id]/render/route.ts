import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { enqueueRenderJob } from "@/lib/services/render-jobs.service";
import { logAuditEvent } from "@/lib/services/audit-log.service";
import { enqueueRenderJobSchema, parseBody } from "@/lib/validation/asset-studio";

// Rendering is CPU-bound and we upload to storage — keep the route on Node runtime
// and give it headroom.
export const runtime = "nodejs";
export const maxDuration = 300;

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/runs/:id/render — enqueue render job for pending variants
// Backward-compatible shape still includes rendered/failed/skipped keys.
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, enqueueRenderJobSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const queued = await enqueueRenderJob({
      runId: id,
      createdBy: user.id,
      priority: parsed.data.priority,
    });

    await logAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      targetType: "variant_run",
      targetId: id,
      action: "rendered",
      metadata: {
        jobId: queued.job.id,
        jobStatus: queued.job.status,
        created: queued.created,
      },
    });

    return NextResponse.json(
      {
        runId: id,
        jobId: queued.job.id,
        status: queued.job.status,
        rendered: 0,
        failed: 0,
        skipped: 0,
        alreadyQueued: !queued.created,
      },
      { status: queued.created ? 202 : 200 }
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
