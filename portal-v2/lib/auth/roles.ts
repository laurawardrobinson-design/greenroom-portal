import type { UserRole } from "@/types/domain";

// Permission matrix — which roles can access which features
export const PERMISSIONS = {
  campaigns: {
    viewAll: ["Admin", "Producer", "Post Producer"] as UserRole[],
    create: ["Admin", "Producer", "Post Producer"] as UserRole[],
    edit: ["Admin", "Producer", "Post Producer"] as UserRole[],
  },
  vendors: {
    viewRoster: ["Admin", "Producer", "Post Producer"] as UserRole[],
    assignToCampaign: ["Admin", "Producer", "Post Producer"] as UserRole[],
    approveEstimate: ["Admin", "Producer", "Post Producer"] as UserRole[],
    preApproveInvoice: ["Admin", "Producer", "Post Producer"] as UserRole[],
    finalApproveInvoice: ["Admin"] as UserRole[],
    submitEstimate: ["Vendor"] as UserRole[],
    signPo: ["Vendor"] as UserRole[],
    submitInvoice: ["Vendor"] as UserRole[],
  },
  budget: {
    managePools: ["Admin"] as UserRole[],
    viewPools: ["Admin", "Producer", "Post Producer"] as UserRole[],
    requestOverage: ["Admin", "Producer", "Post Producer"] as UserRole[],
    approveOverage: ["Admin"] as UserRole[],
  },
  gear: {
    view: ["Admin", "Producer", "Post Producer", "Studio"] as UserRole[],
    manage: ["Admin", "Studio"] as UserRole[],
    checkout: ["Admin", "Producer", "Post Producer", "Studio"] as UserRole[],
    manageMaintenance: ["Admin", "Studio"] as UserRole[],
  },
  approvals: {
    view: ["Admin"] as UserRole[],
  },
  // Asset Studio — Storyteq-style versioning module
  assetStudio: {
    // Browse the module + see templates / variants
    view: ["Admin", "Producer", "Post Producer", "Designer", "Art Director"] as UserRole[],
    // Create / edit / publish templates
    manageTemplates: ["Admin", "Producer", "Post Producer", "Designer"] as UserRole[],
    // Manage versioned brand_tokens
    manageBrand: ["Admin", "Designer"] as UserRole[],
    // Kick off a variant run
    runVariants: ["Admin", "Producer", "Post Producer", "Designer"] as UserRole[],
    // Approve or reject rendered variants
    approveVariants: ["Admin", "Producer", "Post Producer", "Art Director"] as UserRole[],
  },
} as const;

// Route-level access control
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  "/dashboard": ["Admin", "Producer", "Post Producer", "Studio", "Vendor", "Art Director", "Designer"],
  "/campaigns": ["Admin", "Producer", "Post Producer", "Studio", "Vendor", "Art Director", "Designer"],
  "/vendors": ["Admin", "Producer", "Post Producer"],
  "/vendors/portal": ["Vendor"],
  "/inventory": ["Admin", "Producer", "Post Producer", "Studio"],
  "/calendar": ["Admin", "Producer", "Post Producer", "Studio"],
  "/approvals": ["Admin"],
  "/budget": ["Admin", "Producer", "Post Producer"],
  "/contacts": ["Admin", "Producer", "Post Producer", "Studio", "Art Director", "Designer"],
  "/props": ["Admin", "Producer", "Post Producer", "Studio", "Art Director"],
  "/goals": ["Admin", "Producer", "Post Producer", "Studio"],
  "/settings": ["Admin", "Producer", "Post Producer", "Studio", "Vendor", "Art Director", "Designer"],
  "/asset-studio": ["Admin", "Producer", "Post Producer", "Designer", "Art Director"],
};

export function hasPermission(
  userRole: UserRole,
  allowedRoles: readonly UserRole[]
): boolean {
  return allowedRoles.includes(userRole);
}
