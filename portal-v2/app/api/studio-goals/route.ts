import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (user.role === "Vendor") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("studio_goals")
      .select("id, title, description, horizon, sort_order")
      .order("horizon", { ascending: false }) // 'short' before 'long' alphabetically — use sort_order within
      .order("sort_order");

    if (error) throw error;

    // Sort: long first, then short
    const sorted = (data ?? []).sort((a, b) => {
      if (a.horizon === b.horizon) return a.sort_order - b.sort_order;
      return a.horizon === "long" ? -1 : 1;
    });

    return NextResponse.json(sorted);
  } catch (error) {
    return authErrorResponse(error);
  }
}
