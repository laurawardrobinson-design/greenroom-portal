import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listProductsWithUpcomingUse } from "@/lib/services/products.service";
import type { PRDepartment, ProductDepartment } from "@/types/domain";

// PRDepartment is a subset of ProductDepartment — RBU departments are exactly
// the food-line product departments, so the value passes through directly.
async function resolveDeptFromToken(token: string): Promise<PRDepartment | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("product_request_dept_calendars")
    .select("department")
    .eq("public_token", token)
    .maybeSingle();
  if (!data) return null;
  return (data as Record<string, unknown>).department as PRDepartment;
}

// GET /api/rbu/[token]/products/review
// Token-gated. Returns the same cross-department review list BMM sees
// from /api/products/review — RBU users get full visibility into upcoming
// product use across the whole catalog so they can see how their
// products fit into the broader production schedule.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 20) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const department = await resolveDeptFromToken(token);
    if (!department) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const rows = await listProductsWithUpcomingUse();
    return NextResponse.json({ department, rows });
  } catch (error) {
    console.error("[rbu-products-review:GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
