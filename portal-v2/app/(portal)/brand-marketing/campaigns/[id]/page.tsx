"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { BmmCampaignDetail } from "@/components/brand-marketing/bmm-campaign-detail";

const ALLOWED_ROLES = ["Admin", "Brand Marketing Manager"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export default function BmmCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !ALLOWED_ROLES.includes(user.role as AllowedRole)) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) return <DashboardSkeleton />;
  if (!ALLOWED_ROLES.includes(user.role as AllowedRole)) return null;

  return <BmmCampaignDetail campaignId={id} user={user} />;
}
