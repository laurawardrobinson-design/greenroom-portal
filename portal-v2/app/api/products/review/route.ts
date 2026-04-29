import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listProductsWithUpcomingUse } from "@/lib/services/products.service";

// GET /api/products/review
// Cross-product list of every product's future intended use, one row per
// (product × campaign). Used by the Review tab on /products. Roles match
// the audience for the tab itself.
export async function GET() {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Brand Marketing Manager",
      "Studio",
      "Art Director",
    ]);
    const rows = await listProductsWithUpcomingUse();
    return NextResponse.json(rows);
  } catch (error) {
    return authErrorResponse(error);
  }
}
