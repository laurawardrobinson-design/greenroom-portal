import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getProduct,
  getProductCampaignHistory,
  getProductShootSchedule,
  getProductLastApproval,
} from "@/lib/services/products.service";

// GET /api/rbu/[token]/products/[id]
// Token-gated read of a single product, optionally with campaign history.
// Mirrors the auth-only /api/products/[id] GET so the RBU products surface
// can open the same drawer without an auth session.
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
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;
    if (!(await validateToken(token))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get("history") === "true";

    const product = await getProduct(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (includeHistory) {
      const [history, schedule, lastApproval] = await Promise.all([
        getProductCampaignHistory(id),
        getProductShootSchedule(id),
        getProductLastApproval(id),
      ]);
      return NextResponse.json({
        product,
        campaigns: history,
        upcoming: schedule.upcoming,
        planning: schedule.planning,
        lastApproval,
      });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("[rbu-product:GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
