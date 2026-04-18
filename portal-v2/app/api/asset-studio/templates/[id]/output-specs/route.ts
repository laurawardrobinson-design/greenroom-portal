import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  createOutputSpec,
  ensureDefaultOutputSpecs,
} from "@/lib/services/templates.service";

type RouteCtx = { params: Promise<{ id: string }> };

// POST /api/asset-studio/templates/:id/output-specs
// body: { label, width, height, channel?, format?, sortOrder? }
//   OR  { ensureDefaults: true } to seed Storyteq's three default sizes
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const { id: templateId } = await ctx.params;
    const body = (await request.json()) as {
      ensureDefaults?: boolean;
      label?: string;
      width?: number;
      height?: number;
      channel?: string;
      format?: "png" | "jpg" | "webp";
      sortOrder?: number;
    };

    if (body.ensureDefaults) {
      const created = await ensureDefaultOutputSpecs(templateId);
      return NextResponse.json({ created }, { status: 201 });
    }

    if (!body.label || !body.width || !body.height) {
      return NextResponse.json(
        { error: "label, width, height are required" },
        { status: 400 }
      );
    }
    const spec = await createOutputSpec({
      templateId,
      label: body.label,
      width: body.width,
      height: body.height,
      channel: body.channel,
      format: body.format,
      sortOrder: body.sortOrder,
    });
    return NextResponse.json(spec, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
