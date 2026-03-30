import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppUser, UserRole } from "@/types/domain";

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// Get the current authenticated user with their role from the DB
export async function getAuthUser(): Promise<AppUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError("Not authenticated", 401);
  }

  // Always check the DB for the current role — never trust the JWT alone
  const admin = createAdminClient();
  const { data: dbUser, error } = await admin
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !dbUser) {
    throw new AuthError("User not found in system", 403);
  }

  if (!dbUser.active) {
    throw new AuthError("Account is deactivated", 403);
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as UserRole,
    active: dbUser.active,
    avatarUrl: dbUser.avatar_url || "",
    phone: dbUser.phone || "",
    title: dbUser.title || "",
    vendorId: dbUser.vendor_id || null,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
  };
}

// Require specific role(s) — throws if not authorized
export async function requireRole(
  allowedRoles: UserRole[]
): Promise<AppUser> {
  const user = await getAuthUser();
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError("Insufficient permissions", 403);
  }
  return user;
}

// For vendor users: verify they have access to a specific campaign
export async function requireCampaignAccess(
  user: AppUser,
  campaignId: string
): Promise<void> {
  if (user.role === "Admin" || user.role === "Producer" || user.role === "Art Director") {
    return; // Full access
  }

  const admin = createAdminClient();

  if (user.role === "Studio") {
    const { data } = await admin
      .from("shoot_crew")
      .select("id, shoots!inner(campaign_id)")
      .eq("shoots.campaign_id", campaignId)
      .eq("user_id", user.id)
      .limit(1);

    if (!data?.length) {
      throw new AuthError("No access to this campaign", 403);
    }
    return;
  }

  if (user.role === "Vendor") {
    if (!user.vendorId) {
      throw new AuthError("Vendor account not linked", 403);
    }
    const { data } = await admin
      .from("campaign_vendors")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("vendor_id", user.vendorId)
      .limit(1);

    if (!data?.length) {
      throw new AuthError("No access to this campaign", 403);
    }
  }
}

// For vendor users: verify ownership of a campaign_vendor record
export async function requireVendorOwnership(
  user: AppUser,
  campaignVendorId: string
): Promise<void> {
  if (user.role === "Admin" || user.role === "Producer") {
    return;
  }

  if (user.role !== "Vendor" || !user.vendorId) {
    throw new AuthError("Only vendors can access this", 403);
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("campaign_vendors")
    .select("vendor_id")
    .eq("id", campaignVendorId)
    .single();

  if (!data || data.vendor_id !== user.vendorId) {
    throw new AuthError("Not your assignment", 403);
  }
}

// Helper to return a JSON error response
export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
