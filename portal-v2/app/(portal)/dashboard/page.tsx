"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { HopDashboard } from "@/components/dashboard/hop-dashboard";
import { ProducerDashboard } from "@/components/dashboard/producer-dashboard";
import { StudioDashboard } from "@/components/dashboard/studio-dashboard";
import { VendorDashboard } from "@/components/dashboard/vendor-dashboard";

export default function DashboardPage() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading || !user) return <DashboardSkeleton />;

  switch (user.role) {
    case "Admin":
      return <HopDashboard user={user} />;
    case "Producer":
      return <ProducerDashboard user={user} />;
    case "Studio":
      return <StudioDashboard user={user} />;
    case "Vendor":
      return <VendorDashboard user={user} />;
    default:
      return <DashboardSkeleton />;
  }
}
