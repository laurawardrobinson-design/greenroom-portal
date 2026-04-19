import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listMyWorkQueue } from "@/lib/services/workflow.service";
import { myWorkQueueQuerySchema } from "@/lib/validation/asset-studio";

// GET /api/asset-studio/workflows/my-work?limit=
export async function GET(request: Request) {
  try {
    const user = await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
    ]);

    const { searchParams } = new URL(request.url);
    const parsed = myWorkQueueQuerySchema.safeParse({
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

    const items = await listMyWorkQueue({
      actorRole: user.role,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ items });
  } catch (error) {
    return authErrorResponse(error);
  }
}
