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

export async function POST(request: Request) {
  // Double-guard: must be in development AND have DEV_AUTH enabled.
  // NODE_ENV check prevents this from ever responding in production,
  // even if NEXT_PUBLIC_DEV_AUTH is accidentally set to true.
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.NEXT_PUBLIC_DEV_AUTH !== "true"
  ) {
    return NextResponse.json({ error: "Dev auth disabled" }, { status: 403 });
  }

  const { role, vendor_id } = await request.json();
  let testUser = TEST_USERS[role as string];
  if (!testUser) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Vendor role requires vendor_id selection
  if (testUser.role === "Vendor" && !vendor_id) {
    return NextResponse.json({ error: "Vendor login requires vendor_id" }, { status: 400 });
  }

  const admin = createAdminClient();

  // For vendors, fetch their actual contact name from database
  let vendorContactName = testUser.name;
  if (testUser.role === "Vendor" && vendor_id) {
    const { data: vendor } = await admin
      .from("vendors")
      .select("contact_name")
      .eq("id", vendor_id)
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
          vendor_id: vendor_id || null,
        },
        { onConflict: "id" }
      );
    }
    return NextResponse.json({ success: true, role: testUser.role, vendor_id });
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
        vendor_id: vendor_id || null,
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

  return NextResponse.json({ success: true, role: testUser.role, vendor_id });
}
