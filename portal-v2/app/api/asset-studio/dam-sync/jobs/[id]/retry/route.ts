import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { retryDamSyncJob } from "@/lib/services/dam-sync.service";
import { parseBody, retryDamSyncJobSchema } from "@/lib/validation/asset-studio";

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/dam-sync/jobs/:id/retry
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
    ]);

    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, retryDamSyncJobSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const job = await retryDamSyncJob({
      jobId: id,
      actorId: user.id,
      actorRole: user.role,
      reason: parsed.data.reason,
    });

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
