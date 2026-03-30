import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Get the authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // Check if user exists in our users table
  const admin = createAdminClient();
  const { data: existingUser } = await admin
    .from("users")
    .select("id, role, vendor_id")
    .eq("id", user.id)
    .single();

  if (!existingUser) {
    // First-time login: create a user record with default "Producer" role.
    // Admin will need to update the role manually for now.
    const { error: insertError } = await admin.from("users").insert({
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
      role: "Producer",
      active: true,
      avatar_url: user.user_metadata?.avatar_url || "",
    });

    if (insertError) {
      console.error("Failed to create user record:", insertError);
      return NextResponse.redirect(`${origin}/login?error=provisioning_failed`);
    }
  }

  // Only allow relative redirects (security: prevent open redirect)
  const safeRedirect = redirect.startsWith("/") ? redirect : "/dashboard";
  return NextResponse.redirect(`${origin}${safeRedirect}`);
}
