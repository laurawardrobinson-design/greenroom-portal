import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getWardrobeItem, updateWardrobeItem, deleteWardrobeItem } from "@/lib/services/wardrobe.service";
import { updateWardrobeSchema } from "@/lib/validation/wardrobe.schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio", "Vendor"]);
    const { id } = await params;
    const item = await getWardrobeItem(id);
    if (!item) {
      return NextResponse.json({ error: "Wardrobe item not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio"]);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateWardrobeSchema.parse(body);
    const item = await updateWardrobeItem(id, parsed);
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;
    await deleteWardrobeItem(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
