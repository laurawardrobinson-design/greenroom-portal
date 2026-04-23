"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { HopDashboard } from "@/components/dashboard/hop-dashboard";
import { ProducerDashboard } from "@/components/dashboard/producer-dashboard";
import { StudioDashboard } from "@/components/dashboard/studio-dashboard";
import { VendorDashboard } from "@/components/dashboard/vendor-dashboard";
import { ArtDirectorDashboard } from "@/components/dashboard/art-director-dashboard";
import { PostProducerDashboard } from "@/components/dashboard/post-producer-dashboard";
import { DesignerDashboard } from "@/components/dashboard/designer-dashboard";
import { CreativeDirectorDashboard } from "@/components/dashboard/creative-director-dashboard";

export default function DashboardPage() {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();

  // BMM's dashboard IS the Brand Marketing home page; keep the URL honest.
  useEffect(() => {
    if (!isLoading && user?.role === "Brand Marketing Manager") {
      router.replace("/brand-marketing");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) return <DashboardSkeleton />;
  if (user.role === "Brand Marketing Manager") return <DashboardSkeleton />;

  switch (user.role) {
    case "Admin":
      return <HopDashboard user={user} />;
    case "Producer":
      return <ProducerDashboard user={user} />;
    case "Studio":
      return <StudioDashboard user={user} />;
    case "Vendor":
      return <VendorDashboard user={user} />;
    case "Art Director":
      return <ArtDirectorDashboard user={user} />;
    case "Creative Director":
      return <CreativeDirectorDashboard user={user} />;
    case "Post Producer":
      return <PostProducerDashboard user={user} />;
    case "Designer":
      return <DesignerDashboard user={user} />;
    default:
      return <DashboardSkeleton />;
  }
}
