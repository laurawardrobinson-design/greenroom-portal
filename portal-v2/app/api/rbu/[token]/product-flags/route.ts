import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listProductFlags } from "@/lib/services/product-flags.service";
import type { ProductFlagStatus } from "@/lib/services/product-flags.service";
import type { PRDepartment } from "@/types/domain";

// GET /api/rbu/[token]/product-flags?status=open&dept=Bakery
// Token-gated mirror of /api/product-flags so the RBU products surface can
// list flags without an auth session. Grant (the unified RBU reviewer) sees
// the full cross-department list, matching the BMM view.
async function validateToken(token: string): Promise<boolean> {
  if (!token || token.length < 20) return false;
  const db = createAdminClient();
  const { data } = await db
    .from("product_request_dept_calendars")
    .select("department")
    .eq("public_token", token)
    .maybeSingle();
  return !!data;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!(await validateToken(token))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const dept = searchParams.get("dept") || undefined;
    const productId = searchParams.get("productId") || undefined;
    const flags = await listProductFlags({
      status: status ? (status as ProductFlagStatus) : undefined,
      dept: dept ? (dept as PRDepartment) : undefined,
      productId,
    });
    return NextResponse.json(flags);
  } catch (error) {
    console.error("[rbu-product-flags:GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
