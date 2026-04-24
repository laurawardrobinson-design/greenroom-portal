import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createProductReferenceImage,
  listProductReferenceImages,
  uploadProductImageFile,
} from "@/lib/services/product-images.service";
import type { PRDepartment } from "@/types/domain";

// RBU teams only upload samples via this route. Reference + approved
// are BMM/Admin decisions — RBU samples get promoted from the portal
// side when they clear the bar.
const RBU_UPLOAD_TYPE = "sample" as const;

async function resolveDeptFromToken(
  token: string
): Promise<PRDepartment | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("product_request_dept_calendars")
    .select("department")
    .eq("public_token", token)
    .maybeSingle();
  if (!data) return null;
  return (data as Record<string, unknown>).department as PRDepartment;
}

async function productBelongsToDept(
  productId: string,
  department: PRDepartment
): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db
    .from("products")
    .select("department")
    .eq("id", productId)
    .maybeSingle();
  if (!data) return false;
  return (data as Record<string, unknown>).department === department;
}

// GET /api/rbu/:token/products/:productId/images
// Read — RBU can see every image on a product in their dept so they
// know what "good" looks like and what samples have already landed.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id: productId } = await params;
    if (!token || token.length < 20) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const department = await resolveDeptFromToken(token);
    if (!department) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!(await productBelongsToDept(productId, department))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const images = await listProductReferenceImages(productId);
    return NextResponse.json({ department, images });
  } catch (error) {
    console.error("[rbu-product-images:GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/rbu/:token/products/:productId/images
// RBU uploads a sample image. `image_type` is forced to "sample".
// `uploaded_via_rbu_department` is forced to the token's department.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id: productId } = await params;
    if (!token || token.length < 20) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const department = await resolveDeptFromToken(token);
    if (!department) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!(await productBelongsToDept(productId, department))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const notes = (formData.get("notes") as string) || "";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
      imageType: RBU_UPLOAD_TYPE,
      fileUrl,
      storagePath,
      notes,
      uploadedViaRbuDepartment: department,
    });

    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    console.error("[rbu-product-images:POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
