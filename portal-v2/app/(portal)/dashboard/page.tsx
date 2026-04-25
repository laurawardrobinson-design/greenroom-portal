"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";

const HopDashboard = dynamic(() =>
  import("@/components/dashboard/hop-dashboard").then((mod) => mod.HopDashboard)
);
const ProducerDashboard = dynamic(() =>
  import("@/components/dashboard/producer-dashboard").then(
    (mod) => mod.ProducerDashboard
  )
);
const StudioDashboard = dynamic(() =>
  import("@/components/dashboard/studio-dashboard").then(
    (mod) => mod.StudioDashboard
  )
);
const VendorDashboard = dynamic(() =>
  import("@/components/dashboard/vendor-dashboard").then(
    (mod) => mod.VendorDashboard
  )
);
const ArtDirectorDashboard = dynamic(() =>
  import("@/components/dashboard/art-director-dashboard").then(
    (mod) => mod.ArtDirectorDashboard
  )
);
const PostProducerDashboard = dynamic(() =>
  import("@/components/dashboard/post-producer-dashboard").then(
    (mod) => mod.PostProducerDashboard
  )
);
const DesignerDashboard = dynamic(() =>
  import("@/components/dashboard/designer-dashboard").then(
    (mod) => mod.DesignerDashboard
  )
);
const CreativeDirectorDashboard = dynamic(() =>
  import("@/components/dashboard/creative-director-dashboard").then(
    (mod) => mod.CreativeDirectorDashboard
  )
);

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
