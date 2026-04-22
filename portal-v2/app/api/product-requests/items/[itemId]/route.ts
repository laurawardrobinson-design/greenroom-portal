import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { updateItem, deleteItem } from "@/lib/services/product-requests.service";

// PATCH /api/product-requests/items/[itemId]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    await getAuthUser();
    const { itemId } = await params;
    const body = (await request.json()) as {
      quantity?: number;
      size?: string;
      specialInstructions?: string;
    };
    const updated = await updateItem(itemId, body);
    return NextResponse.json(updated);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/product-requests/items/[itemId]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    await getAuthUser();
    const { itemId } = await params;
    await deleteItem(itemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
