import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/product-flags/counts
// Portal-authenticated. Returns a { productId: openCount } map so
// inventory UIs can badge flagged products without a second join.
export async function GET() {
  try {
    await getAuthUser();
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
    return authErrorResponse(error);
  }
}
