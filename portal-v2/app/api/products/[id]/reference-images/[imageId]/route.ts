import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  deleteProductReferenceImage,
  setProductReferenceImageType,
} from "@/lib/services/product-images.service";
import type { ProductImageType } from "@/types/domain";

const VALID_TYPES: ProductImageType[] = ["reference", "sample", "approved"];
const WRITE_ROLES = [
  "Admin",
  "Producer",
  "Post Producer",
  "Brand Marketing Manager",
] as const;

// PATCH /api/products/:id/reference-images/:imageId
// Currently used to promote a sample to "approved" (or demote). Body:
// { imageType: "reference" | "sample" | "approved" }.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    await requireRole([...WRITE_ROLES]);
    const { imageId } = await params;
    const body = (await request.json()) as { imageType?: string };

    if (!body.imageType || !VALID_TYPES.includes(body.imageType as ProductImageType)) {
      return NextResponse.json(
        { error: "Invalid image type" },
        { status: 400 }
      );
    }

    const image = await setProductReferenceImageType(
      imageId,
      body.imageType as ProductImageType
    );
    return NextResponse.json({ image });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/products/:id/reference-images/:imageId
// Removes the row and best-effort deletes the underlying storage object.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    await requireRole([...WRITE_ROLES]);
    const { imageId } = await params;
    await deleteProductReferenceImage(imageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
