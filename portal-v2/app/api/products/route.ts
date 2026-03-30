import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listProducts, createProduct } from "@/lib/services/products.service";
import { createProductSchema } from "@/lib/validation/products.schema";
import type { ProductDepartment } from "@/types/domain";

export async function GET(request: Request) {
  try {
    await getAuthUser();
    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department") as ProductDepartment | null;
    const search = searchParams.get("search") || undefined;

    const products = await listProducts({
      department: department || undefined,
      search,
    });
    return NextResponse.json(products);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Art Director", "Studio"]);
    const body = await request.json();
    const parsed = createProductSchema.parse(body);
    const product = await createProduct(parsed, user.id);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
