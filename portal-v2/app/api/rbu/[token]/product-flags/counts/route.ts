import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/rbu/[token]/product-flags/counts
// Token-gated mirror of /api/product-flags/counts. Returns a
// { productId: openCount } map so RBU UIs can badge flagged products
// without a second join.
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
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!(await validateToken(token))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = createAdminClient();
    const { data, error } = await db
      .from("product_flags")
      .select("product_id")
      .eq("status", "open");
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const r of data ?? []) {
      const pid = (r as Record<string, unknown>).product_id as string;
      counts[pid] = (counts[pid] ?? 0) + 1;
    }
    return NextResponse.json(counts);
  } catch (error) {
    console.error("[rbu-product-flag-counts:GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
