import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listWardrobeItems, createWardrobeItem } from "@/lib/services/wardrobe.service";
import { createWardrobeSchema } from "@/lib/validation/wardrobe.schema";
import type { WardrobeCategory } from "@/types/domain";

export async function GET(request: Request) {
  try {
    await getAuthUser();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as WardrobeCategory | null;
    const search = searchParams.get("search") || undefined;

    const items = await listWardrobeItems({
      category: category || undefined,
      search,
    });
    return NextResponse.json(items);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Art Director", "Studio"]);
    const body = await request.json();
    const parsed = createWardrobeSchema.parse(body);
    const item = await createWardrobeItem(parsed, user.id);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
