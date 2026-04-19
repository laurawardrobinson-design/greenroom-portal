import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/lib/services/templates.service";
import { logAuditEvent } from "@/lib/services/audit-log.service";
import { updateTemplateSchema, parseBody } from "@/lib/validation/asset-studio";

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
    const raw = await request.json().catch(() => ({}));
    const parsed = parseBody(raw, updateTemplateSchema);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }
    const body = parsed.data;
    const template = await updateTemplate(id, body, { userId: user.id });
    if (body.status === "published") {
      await logAuditEvent({
        actorId: user.id,
        actorRole: user.role,
        targetType: "template",
        targetId: id,
        action: "published",
        metadata: { versionId: template.currentVersionId ?? null },
      });
    }
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
