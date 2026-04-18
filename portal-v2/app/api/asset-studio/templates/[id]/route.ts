import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/lib/services/templates.service";
import type { TemplateStatus } from "@/types/domain";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/asset-studio/templates/:id — joined with layers + output specs
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director"]);
    const { id } = await ctx.params;
    const template = await getTemplate(id);
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(template);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/asset-studio/templates/:id
export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id } = await ctx.params;
    const body = (await request.json()) as Partial<{
      name: string;
      description: string;
      status: TemplateStatus;
      category: string;
      brandTokensId: string | null;
      thumbnailUrl: string | null;
      canvasWidth: number;
      canvasHeight: number;
      backgroundColor: string;
    }>;
    const template = await updateTemplate(id, body, { userId: user.id });
    return NextResponse.json(template);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/asset-studio/templates/:id
export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Designer"]);
    const { id } = await ctx.params;
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
