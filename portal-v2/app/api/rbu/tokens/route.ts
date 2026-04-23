import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/rbu/tokens
// Public. Returns the stable department public_tokens. These URLs
// are already shareable by design (the same tokens the /rbu landing
// page exposes and BMM shares manually).
export async function GET() {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("product_request_dept_calendars")
      .select("department, public_token")
      .order("department", { ascending: true });
    if (error) throw error;
    return NextResponse.json(
      (data ?? []).map((r) => ({
        department: (r as Record<string, unknown>).department,
        publicToken: (r as Record<string, unknown>).public_token,
      }))
    );
  } catch (error) {
    console.error("[rbu-tokens]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
