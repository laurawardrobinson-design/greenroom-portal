import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEV_NORTHLIGHT_VENDOR = {
  company_name: "Northlight Culinary Studio",
  contact_name: "Maya Patel",
  email: "maya@northlightculinary.com",
  phone: "(555) 014-7712",
  category: "Food Styling",
  specialty: "Food Styling",
  active: true,
} as const;

async function ensureDevNorthlightVendor() {
  if (process.env.NEXT_PUBLIC_DEV_AUTH !== "true") {
    return;
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("vendors")
    .select("id, active, company_name, contact_name, phone, category, specialty")
    .eq("email", DEV_NORTHLIGHT_VENDOR.email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const needsUpdate =
      !existing.active ||
      existing.company_name !== DEV_NORTHLIGHT_VENDOR.company_name ||
      existing.contact_name !== DEV_NORTHLIGHT_VENDOR.contact_name ||
      existing.phone !== DEV_NORTHLIGHT_VENDOR.phone ||
      existing.category !== DEV_NORTHLIGHT_VENDOR.category ||
      existing.specialty !== DEV_NORTHLIGHT_VENDOR.specialty;

    if (needsUpdate) {
      const { error: updateError } = await admin
        .from("vendors")
        .update({
          company_name: DEV_NORTHLIGHT_VENDOR.company_name,
          contact_name: DEV_NORTHLIGHT_VENDOR.contact_name,
          phone: DEV_NORTHLIGHT_VENDOR.phone,
          category: DEV_NORTHLIGHT_VENDOR.category,
          specialty: DEV_NORTHLIGHT_VENDOR.specialty,
          active: true,
        })
        .eq("id", existing.id);

      if (updateError) {
        throw updateError;
      }
    }

    return;
  }

  const { error: insertError } = await admin.from("vendors").insert(DEV_NORTHLIGHT_VENDOR);
  if (insertError) {
    throw insertError;
  }
}

export async function GET() {
  const admin = createAdminClient();

  try {
    await ensureDevNorthlightVendor();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to prepare dev vendor";
    return NextResponse.json({ error: message }, { status: 500 });
  }

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
