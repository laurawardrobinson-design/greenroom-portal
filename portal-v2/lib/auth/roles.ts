import type { UserRole } from "@/types/domain";

// Permission matrix — which roles can access which features
export const PERMISSIONS = {
  campaigns: {
    viewAll: ["Admin", "Producer"] as UserRole[],
    create: ["Admin", "Producer"] as UserRole[],
    edit: ["Admin", "Producer"] as UserRole[],
  },
  vendors: {
    viewRoster: ["Admin", "Producer"] as UserRole[],
    assignToCampaign: ["Admin", "Producer"] as UserRole[],
    approveEstimate: ["Admin", "Producer"] as UserRole[],
    preApproveInvoice: ["Admin", "Producer"] as UserRole[],
    finalApproveInvoice: ["Admin"] as UserRole[],
    submitEstimate: ["Vendor"] as UserRole[],
    signPo: ["Vendor"] as UserRole[],
    submitInvoice: ["Vendor"] as UserRole[],
  },
  budget: {
    managePools: ["Admin"] as UserRole[],
    viewPools: ["Admin", "Producer"] as UserRole[],
    requestOverage: ["Admin", "Producer"] as UserRole[],
    approveOverage: ["Admin"] as UserRole[],
  },
  gear: {
    view: ["Admin", "Producer", "Studio"] as UserRole[],
    manage: ["Admin", "Studio"] as UserRole[],
    checkout: ["Admin", "Producer", "Studio"] as UserRole[],
    manageMaintenance: ["Admin", "Studio"] as UserRole[],
  },
  approvals: {
    view: ["Admin"] as UserRole[],
  },
} as const;

// Route-level access control
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  "/dashboard": ["Admin", "Producer", "Studio", "Vendor"],
  "/campaigns": ["Admin", "Producer", "Studio", "Vendor"],
  "/vendors": ["Admin", "Producer"],
  "/vendors/portal": ["Vendor"],
  "/inventory": ["Admin", "Producer", "Studio"],
  "/calendar": ["Admin", "Producer", "Studio"],
  "/approvals": ["Admin"],
  "/budget": ["Admin", "Producer"],
  "/settings": ["Admin", "Producer", "Studio", "Vendor"],
};

export function hasPermission(
  userRole: UserRole,
  allowedRoles: readonly UserRole[]
): boolean {
  return allowedRoles.includes(userRole);
}
