import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("vendors")
    .select("id, company_name, contact_name, email, phone, category, specialty")
    .eq("active", true)
    .order("company_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ vendors: data || [] });
}
