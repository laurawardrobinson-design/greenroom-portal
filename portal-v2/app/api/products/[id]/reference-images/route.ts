import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  createProductReferenceImage,
  listProductReferenceImages,
  uploadProductImageFile,
} from "@/lib/services/product-images.service";
import type { ProductImageType } from "@/types/domain";

const VALID_TYPES: ProductImageType[] = ["reference", "sample", "approved"];
const WRITE_ROLES = [
  "Admin",
  "Producer",
  "Post Producer",
  "Brand Marketing Manager",
] as const;
const READ_ROLES = [
  "Admin",
  "Producer",
  "Post Producer",
  "Studio",
  "Art Director",
  "Creative Director",
  "Designer",
  "Brand Marketing Manager",
] as const;

// GET /api/products/:id/reference-images — list every image for a product.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([...READ_ROLES]);
    const { id } = await params;
    const images = await listProductReferenceImages(id);
    return NextResponse.json({ images });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/products/:id/reference-images — upload + attach an image.
// Multipart: `file`, `imageType` ("reference" | "sample" | "approved"),
// `notes` (optional).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([...WRITE_ROLES]);
    const { id: productId } = await params;

    const formData = await request.formData();
    const file = formData.get("file");
    const imageType = (formData.get("imageType") as string) || "reference";
    const notes = (formData.get("notes") as string) || "";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(imageType as ProductImageType)) {
      return NextResponse.json(
        { error: "Invalid image type" },
        { status: 400 }
      );
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPG, PNG, and WebP images are allowed" },
        { status: 400 }
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image must be under 10 MB" },
        { status: 400 }
      );
    }

    const { fileUrl, storagePath } = await uploadProductImageFile(
      productId,
      file
    );

    const image = await createProductReferenceImage({
      productId,
      imageType: imageType as ProductImageType,
      fileUrl,
      storagePath,
      notes,
      uploadedByUserId: user.id,
    });

    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
