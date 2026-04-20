import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listTemplateVersions,
  snapshotTemplateVersion,
} from "@/lib/services/templates.service";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/asset-studio/templates/:id/versions — full version history
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
      "Creative Director",
    ]);
    const { id } = await ctx.params;
    const versions = await listTemplateVersions(id);
    return NextResponse.json(versions);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/asset-studio/templates/:id/versions — "Save as new version"
// Body: { label?: string, notes?: string }
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as {
      label?: string;
      notes?: string;
    };
    const version = await snapshotTemplateVersion(id, user.id, {
      label: body.label,
      notes: body.notes,
    });
    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
