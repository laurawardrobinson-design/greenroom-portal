import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listTemplates,
  createTemplate,
  ensureDefaultOutputSpecs,
} from "@/lib/services/templates.service";
import type { TemplateStatus } from "@/types/domain";

// GET /api/asset-studio/templates
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director"]);
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") as TemplateStatus | null) || undefined;
    const search = searchParams.get("search") || undefined;
    const templates = await listTemplates({ status, search });
    return NextResponse.json(templates);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/asset-studio/templates
// body: { name, description?, category?, brandTokensId?, canvasWidth?, canvasHeight?, backgroundColor?, seedDefaultSpecs? }
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Designer"]);
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      category?: string;
      brandTokensId?: string | null;
      canvasWidth?: number;
      canvasHeight?: number;
      backgroundColor?: string;
      seedDefaultSpecs?: boolean;
    };
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const template = await createTemplate({
      name: body.name,
      description: body.description,
      category: body.category,
      brandTokensId: body.brandTokensId,
      canvasWidth: body.canvasWidth,
      canvasHeight: body.canvasHeight,
      backgroundColor: body.backgroundColor,
      createdBy: user.id,
    });
    if (body.seedDefaultSpecs !== false) {
      await ensureDefaultOutputSpecs(template.id);
    }
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
