import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevAuthEnabled } from "@/lib/auth/dev-access";

export async function GET() {
  if (!isDevAuthEnabled()) {
    return NextResponse.json({ error: "Dev auth disabled" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("vendors")
    .select("id, company_name, contact_name, category, specialty")
    .eq("active", true)
    .order("company_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ vendors: data || [] });
}
