"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { BmmDashboard } from "@/components/dashboard/bmm-dashboard";

const ALLOWED_ROLES = ["Admin", "Brand Marketing Manager"] as const;

export default function BrandMarketingPage() {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !ALLOWED_ROLES.includes(user.role as any)) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) return <DashboardSkeleton />;
  if (!ALLOWED_ROLES.includes(user.role as any)) return null;

  return <BmmDashboard user={user} />;
}
