import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevAuthEnabled } from "@/lib/auth/dev-access";
import type { UserRole } from "@/types/domain";

// Dev-only: creates test users via admin API and signs them in.
// Only works when NEXT_PUBLIC_DEV_AUTH=true.

const TEST_USERS: Record<
  string,
  { email: string; name: string; role: UserRole }
> = {
  admin: { email: "admin@test.local", name: "Gretchen Siss", role: "Admin" },
  producer: { email: "producer@test.local", name: "Laura Robinson", role: "Producer" },
  studio: { email: "studio@test.local", name: "Astasia", role: "Studio" },
  vendor: { email: "vendor@test.local", name: "Sam", role: "Vendor" },
  artdirector: { email: "artdirector@test.local", name: "Alex Rivera", role: "Art Director" },
  creativedirector: { email: "creativedirector@test.local", name: "Morgan Vale", role: "Creative Director" },
  postproducer: { email: "postproducer@test.local", name: "Jessica", role: "Post Producer" },
  designer: { email: "designer@test.local", name: "Daniel", role: "Designer" },
  bmm: { email: "bmm@test.local", name: "Nicole Lee", role: "Brand Marketing Manager" },
};

const TEST_PASSWORD = process.env.DEV_AUTH_TEST_PASSWORD ?? "testpass123456";

const BMM_PORTFOLIO_CAMPAIGNS = [
  { id: "6e5bfb11-91f6-4472-a298-b98f925b6b6b", lineOfBusiness: "Produce" },
  { id: "a1b2c3d4-1111-4aaa-bbbb-000000000001", lineOfBusiness: "Meat & Seafood" },
  { id: "a1b2c3d4-2222-4aaa-bbbb-000000000002", lineOfBusiness: "Grocery" },
  { id: "a1b2c3d4-3333-4aaa-bbbb-000000000003", lineOfBusiness: "Bakery" },
  { id: "7318c8f3-aba4-48df-89ac-819141aece0f", lineOfBusiness: "Bakery" },
];
const LEGACY_NICOLE_BMM_ID = "19e8a840-2935-4c41-bd4d-4b8d1c51aff0";

async function seedBmmPortfolio(admin: ReturnType<typeof createAdminClient>, userId: string) {
  await admin
    .from("users")
    .update({ desk_department: "Bakery" })
    .eq("id", userId)
    .eq("role", "Brand Marketing Manager");

  await admin
    .from("campaigns")
    .update({ brand_owner_id: userId })
    .eq("brand_owner_id", LEGACY_NICOLE_BMM_ID);

  for (const campaign of BMM_PORTFOLIO_CAMPAIGNS) {
    await admin
      .from("campaigns")
      .update({
        brand_owner_id: userId,
        line_of_business: campaign.lineOfBusiness,
      })
      .eq("id", campaign.id);
  }
}

export async function POST(request: Request) {
  if (!isDevAuthEnabled()) {
    return NextResponse.json({ error: "Dev auth disabled" }, { status: 403 });
  }

  const { role, vendor_id } = await request.json();
  const testUser = TEST_USERS[role as string];
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

      if (testUser.role === "Brand Marketing Manager") {
        await seedBmmPortfolio(admin, session.session.user.id);
      }
    }
    return NextResponse.json({ success: true, role: testUser.role, vendor_id });
  }

  // Sign-in failed. Try to create the user; if they already exist (left over
  // from a prior dev setup with a different password), resolve their ID via
  // generateLink and reset the password.
  let userId: string;
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email: testUser.email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: vendorContactName },
    });

  if (created?.user) {
    userId = created.user.id;
  } else {
    // User already exists. generateLink returns the existing user object.
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: testUser.email,
    });
    if (linkErr || !link?.user) {
      return NextResponse.json(
        { error: linkErr?.message || createErr?.message || "Failed to resolve user" },
        { status: 500 }
      );
    }
    const { error: resetErr } = await admin.auth.admin.updateUserById(
      link.user.id,
      { password: TEST_PASSWORD, email_confirm: true }
    );
    if (resetErr) {
      return NextResponse.json({ error: resetErr.message }, { status: 500 });
    }
    userId = link.user.id;
  }

  // Upsert the public.users row
  await admin.from("users").upsert(
    {
      id: userId,
      email: testUser.email,
      name: vendorContactName,
      role: testUser.role,
      active: true,
      vendor_id: vendor_id || null,
    },
    { onConflict: "id" }
  );

  if (testUser.role === "Brand Marketing Manager") {
    await seedBmmPortfolio(admin, userId);
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
