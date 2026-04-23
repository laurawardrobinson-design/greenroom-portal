import type { ReactNode } from "react";
import type { UserRole } from "@/types/domain";

type RoleKey =
  | "admin"
  | "producer"
  | "studio"
  | "art-director"
  | "creative-director"
  | "designer"
  | "bmm"
  | "vendor"
  | "post-producer";

const ROLE_TO_KEY: Record<UserRole, RoleKey> = {
  Admin: "admin",
  Producer: "producer",
  Studio: "studio",
  Vendor: "vendor",
  "Art Director": "art-director",
  "Creative Director": "creative-director",
  "Post Producer": "post-producer",
  Designer: "designer",
  "Brand Marketing Manager": "bmm",
};

const ROLE_SHORT_LABEL: Record<UserRole, string> = {
  Admin: "Admin",
  Producer: "Producer",
  Studio: "Studio",
  Vendor: "Vendor",
  "Art Director": "Art Director",
  "Creative Director": "Creative Director",
  "Post Producer": "Post Producer",
  Designer: "Designer",
  "Brand Marketing Manager": "BMM",
};

export function roleBadgeStyle(role: UserRole): {
  color: string;
  backgroundColor: string;
} {
  const key = ROLE_TO_KEY[role];
  return {
    color: `var(--role-${key}-fg)`,
    backgroundColor: `var(--role-${key}-tint)`,
  };
}

export function RoleBadge({
  role,
  children,
  short = false,
  className = "",
}: {
  role: UserRole;
  children?: ReactNode;
  /** Use short form for BMM etc. when space is tight. */
  short?: boolean;
  className?: string;
}) {
  const label = children ?? (short ? ROLE_SHORT_LABEL[role] : role);
  return (
    <span
      data-role={role}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      style={roleBadgeStyle(role)}
    >
      {label}
    </span>
  );
}
