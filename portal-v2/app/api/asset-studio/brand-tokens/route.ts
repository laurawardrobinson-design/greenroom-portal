import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listBrandTokens,
  createBrandTokenVersion,
} from "@/lib/services/brand.service";
import type { BrandTokenPayload } from "@/types/domain";

// GET /api/asset-studio/brand-tokens?brand=Publix
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Designer", "Art Director", "Creative Director"]);
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get("brand") || undefined;
    const tokens = await listBrandTokens(brand);
    return NextResponse.json(tokens);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/asset-studio/brand-tokens — create a new version
// body: { brand?, notes?, tokens, activate? }
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Designer"]);
    const body = (await request.json()) as {
      brand?: string;
      notes?: string;
      tokens: BrandTokenPayload;
      activate?: boolean;
    };
    if (!body.tokens || typeof body.tokens !== "object") {
      return NextResponse.json({ error: "tokens is required" }, { status: 400 });
    }
    const created = await createBrandTokenVersion({
      brand: body.brand,
      notes: body.notes,
      tokens: body.tokens,
      activate: body.activate,
      createdBy: user.id,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
