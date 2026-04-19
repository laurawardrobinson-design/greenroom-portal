import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  enqueueDamSyncJob,
  listDamSyncJobs,
} from "@/lib/services/dam-sync.service";
import {
  enqueueDamSyncJobSchema,
  listDamSyncJobsQuerySchema,
  parseBody,
} from "@/lib/validation/asset-studio";

// GET /api/asset-studio/dam-sync/jobs?damAssetId=&status=&limit=
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director"]);

    const { searchParams } = new URL(request.url);
    const parsed = listDamSyncJobsQuerySchema.safeParse({
      damAssetId: searchParams.get("damAssetId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid query params",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const jobs = await listDamSyncJobs(parsed.data);
    return NextResponse.json({ jobs });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/asset-studio/dam-sync/jobs
// body: { damAssetId, damAssetVersionId?, reason?, force? }
export async function POST(request: Request) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
    ]);

    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, enqueueDamSyncJobSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const result = await enqueueDamSyncJob({
      damAssetId: parsed.data.damAssetId,
      damAssetVersionId: parsed.data.damAssetVersionId,
      createdBy: user.id,
      actorRole: user.role,
      reason: parsed.data.reason,
      force: parsed.data.force,
    });

    return NextResponse.json(
      {
        created: result.created,
        job: result.job,
      },
      { status: result.created ? 202 : 200 }
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
