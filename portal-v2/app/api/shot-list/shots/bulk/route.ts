import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { bulkShotAction } from "@/lib/services/shot-list.service";
import type { BulkAction } from "@/lib/services/shot-list.service";

const ALLOWED: BulkAction[] = ["assignDate", "moveToSetup", "duplicate", "delete"];

export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director"]);
    const body = (await request.json()) as {
      ids?: string[];
      action?: BulkAction;
      shootDateId?: string | null;
      setupId?: string;
    };

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: "ids required" }, { status: 400 });
    }
    if (!body.action || !ALLOWED.includes(body.action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (body.action === "moveToSetup" && !body.setupId) {
      return NextResponse.json({ error: "setupId required" }, { status: 400 });
    }

    const result = await bulkShotAction({
      ids: body.ids,
      action: body.action,
      shootDateId: body.shootDateId ?? null,
      setupId: body.setupId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
