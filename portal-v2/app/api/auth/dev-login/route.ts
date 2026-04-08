import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/domain";

// Dev-only: creates test users via admin API and signs them in.
// Only works when NEXT_PUBLIC_DEV_AUTH=true.

const TEST_USERS: Record<
  string,
  { email: string; name: string; role: UserRole }
> = {
  admin: { email: "admin@test.local", name: "Gretchen Siss", role: "Admin" },
  producer: { email: "producer@test.local", name: "Laura Robinson", role: "Producer" },
  studio: { email: "studio@test.local", name: "Studio Manager", role: "Studio" },
  vendor: { email: "vendor@test.local", name: "Sam", role: "Vendor" },
  artdirector: { email: "artdirector@test.local", name: "Alex Rivera", role: "Art Director" },
};

const TEST_PASSWORD = "testpass123456";

const DEV_NORTHLIGHT_VENDOR = {
  company_name: "Northlight Culinary Studio",
  contact_name: "Maya Patel",
  email: "maya@northlightculinary.com",
  phone: "(555) 014-7712",
  category: "Food Styling",
  specialty: "Food Styling",
  active: true,
} as const;

async function ensureDevNorthlightVendorId(admin: ReturnType<typeof createAdminClient>): Promise<string> {
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

  if (existing?.id) {
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

    return existing.id;
  }

  const { data: inserted, error: insertError } = await admin
    .from("vendors")
    .insert(DEV_NORTHLIGHT_VENDOR)
    .select("id")
    .single();

  if (insertError || !inserted?.id) {
    throw insertError || new Error("Failed to create Northlight vendor");
  }

  return inserted.id;
}

export async function POST(request: Request) {
  // Guard: only works when DEV_AUTH is explicitly enabled.
  // Remove the NEXT_PUBLIC_DEV_AUTH env var on Vercel to disable.
  if (process.env.NEXT_PUBLIC_DEV_AUTH !== "true") {
    return NextResponse.json({ error: "Dev auth disabled" }, { status: 403 });
  }

  const { role, vendor_id } = await request.json();
  const testUser = TEST_USERS[role as string];
  if (!testUser) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const admin = createAdminClient();
  let resolvedVendorId = vendor_id as string | undefined;

  // Vendor role defaults to Northlight vendor in dev mode when none is selected.
  if (testUser.role === "Vendor" && !resolvedVendorId) {
    try {
      resolvedVendorId = await ensureDevNorthlightVendorId(admin);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to prepare vendor";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (testUser.role === "Vendor" && !resolvedVendorId) {
    return NextResponse.json({ error: "Vendor login requires vendor_id" }, { status: 400 });
  }

  // For vendors, fetch their actual contact name from database
  let vendorContactName = testUser.name;
  if (testUser.role === "Vendor" && resolvedVendorId) {
    const { data: vendor } = await admin
      .from("vendors")
      .select("contact_name")
      .eq("id", resolvedVendorId)
      .single();

    if (vendor?.contact_name) {
      vendorContactName = vendor.contact_name;
    }
  }

  const supabase = await createClient();

  // Try signing in first — the user likely already exists
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: testUser.email,
    password: TEST_PASSWORD,
  });

  if (!signInErr) {
    // Sign-in succeeded — ensure public.users row exists
    const { data: session } = await supabase.auth.getSession();
    if (session?.session?.user) {
      await admin.from("users").upsert(
        {
          id: session.session.user.id,
          email: testUser.email,
          name: vendorContactName,
          role: testUser.role,
          active: true,
          vendor_id: resolvedVendorId || null,
        },
        { onConflict: "id" }
      );
    }
    return NextResponse.json({
      success: true,
      role: testUser.role,
      vendor_id: resolvedVendorId || null,
    });
  }

  // Sign-in failed — user probably doesn't exist, create them
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email: testUser.email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: vendorContactName },
    });

  if (createErr) {
    return NextResponse.json({ error: createErr.message }, { status: 500 });
  }

  // Create public.users row
  if (created.user) {
    await admin.from("users").upsert(
      {
        id: created.user.id,
        email: testUser.email,
        name: vendorContactName,
        role: testUser.role,
        active: true,
        vendor_id: resolvedVendorId || null,
      },
      { onConflict: "id" }
    );
  }

  // Now sign in
  const { error: signInErr2 } = await supabase.auth.signInWithPassword({
    email: testUser.email,
    password: TEST_PASSWORD,
  });

  if (signInErr2) {
    return NextResponse.json({ error: signInErr2.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    role: testUser.role,
    vendor_id: resolvedVendorId || null,
  });
}
