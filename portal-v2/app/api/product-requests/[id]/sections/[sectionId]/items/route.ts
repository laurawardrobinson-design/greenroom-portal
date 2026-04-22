import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { addItem, deleteSection } from "@/lib/services/product-requests.service";

// POST /api/product-requests/[id]/sections/[sectionId]/items — add an item
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    await getAuthUser();
    const { sectionId } = await params;
    const body = (await request.json()) as {
      productId?: string | null;
      quantity?: number;
      size?: string;
      specialInstructions?: string;
    };

    const item = await addItem(sectionId, {
      productId: body.productId,
      quantity: body.quantity,
      size: body.size,
      specialInstructions: body.specialInstructions,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/product-requests/[id]/sections/[sectionId]/items — delete entire section
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    await getAuthUser();
    const { sectionId } = await params;
    await deleteSection(sectionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
