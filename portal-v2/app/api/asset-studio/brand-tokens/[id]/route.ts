import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  getBrandTokens,
  updateBrandTokensPayload,
} from "@/lib/services/brand.service";
import type { BrandTokenPayload } from "@/types/domain";

type RouteCtx = { params: Promise<{ id: string }> };

// GET /api/asset-studio/brand-tokens/:id
export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director", "Creative Director"]);
    const { id } = await ctx.params;
    const tokens = await getBrandTokens(id);
    if (!tokens) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(tokens);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/asset-studio/brand-tokens/:id — edit tokens payload / notes
export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    await requireRole(["Admin", "Designer"]);
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      tokens?: BrandTokenPayload;
      notes?: string;
    };
    const updated = await updateBrandTokensPayload(id, {
      tokens: body.tokens,
      notes: body.notes,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return authErrorResponse(error);
  }
}
