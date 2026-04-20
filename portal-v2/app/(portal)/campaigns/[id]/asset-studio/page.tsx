"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useCampaign } from "@/hooks/use-campaigns";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTabs } from "@/components/ui/page-tabs";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  LayoutGrid,
  PlayCircle,
  Images,
  FolderSync,
  Type,
  Palette,
} from "lucide-react";
import { DamTab } from "@/components/asset-studio/dam-tab";
import { RunsTab } from "@/components/asset-studio/runs-tab";
import { VariantsTab } from "@/components/asset-studio/variants-tab";
import { DeliverableTemplatesTile } from "@/components/campaigns/tiles/deliverable-templates-tile";
import { fetcher } from "@/components/asset-studio/lib";
import type { CampaignAssignment } from "@/lib/services/campaign-assignments.service";

type Tab = "overview" | "dam" | "runs" | "variants";

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "dam",      label: "Shoot images", icon: FolderSync },
  { id: "runs",     label: "Runs",     icon: PlayCircle },
  { id: "variants", label: "Mechanicals", icon: Images },
];

const ALLOWED_ROLES = [
  "Admin",
  "Producer",
  "Post Producer",
  "Designer",
  "Art Director",
  "Creative Director",
];

export default function CampaignAssetStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campaignId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: userLoading } = useCurrentUser();
  const { campaign, isLoading: campaignLoading } = useCampaign(campaignId);

  const tabParam = searchParams.get("tab") as Tab | null;
  const initialTab: Tab = TABS.some((t) => t.id === tabParam)
    ? (tabParam as Tab)
    : "overview";
  const [localTab, setLocalTab] = useState<Tab>(initialTab);
  const activeTab: Tab =
    tabParam && TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : localTab;

  function switchTab(tab: Tab) {
    setLocalTab(tab);
    router.replace(`/campaigns/${campaignId}/asset-studio?tab=${tab}`, { scroll: false });
  }

  if (userLoading || campaignLoading || !user) return <DashboardSkeleton />;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <EmptyState
        title="Access restricted"
        description="Asset Studio is available to Designers, Producers, Post Producers, Art Directors, Creative Directors, and Admins."
      />
    );
  }

  if (!campaign) {
    return <EmptyState title="Campaign not found" description="It may have been deleted or you don't have access." />;
  }

  return (
    <div className="space-y-4 -mt-3">
      {/* Breadcrumb + title */}
      <div>
        <Link
          href={`/campaigns/${campaignId}`}
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-text-tertiary hover:text-text-secondary"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to campaign
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">
            {campaign.wfNumber ? `${campaign.wfNumber} · ` : ""}
            {campaign.name}
          </h1>
          <span className="text-sm text-text-tertiary">Asset Studio</span>
        </div>
      </div>

      {/* Tabs */}
      <PageTabs
        tabs={TABS.map((t) => ({ key: t.id, label: t.label, icon: t.icon }))}
        activeTab={activeTab}
        onTabChange={(id) => switchTab(id as Tab)}
      />

      {activeTab === "overview" && (
        <CampaignOverview campaignId={campaignId} campaign={campaign} user={user} />
      )}
      {activeTab === "dam" && <DamTab user={user} lockedCampaignId={campaignId} />}
      {activeTab === "runs" && <RunsTab user={user} campaignId={campaignId} />}
      {activeTab === "variants" && <VariantsTab user={user} campaignId={campaignId} />}
    </div>
  );
}

function CampaignOverview({
  campaignId,
  campaign,
  user,
}: {
  campaignId: string;
  campaign: NonNullable<ReturnType<typeof useCampaign>["campaign"]>;
  user: ReturnType<typeof useCurrentUser>["user"];
}) {
  const { data: assignments = [] } = useSWR<CampaignAssignment[]>(
    `/api/campaigns/${campaignId}/assignments`,
    fetcher
  );
  const designer = assignments.find((a) => a.assignmentRole === "primary_designer");
  const ad = assignments.find((a) => a.assignmentRole === "primary_art_director");

  return (
    <div className="space-y-4">
      {/* Deliverables — primary section: designers work through these */}
      <DeliverableTemplatesTile
        campaignId={campaignId}
        enableActions
        title="Deliverables"
      />

      {/* Secondary context: Brief + Creative Team side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card padding="none" className="lg:col-span-2">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
            <Type className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Brief
            </span>
            <Link
              href={`/campaigns/${campaignId}`}
              className="ml-auto text-[10px] uppercase tracking-wider text-text-tertiary hover:text-text-secondary"
            >
              Edit on campaign →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
            <BriefField label="Headline" value={campaign.headline} />
            <BriefField label="CTA" value={campaign.cta} />
            <BriefField label="Disclaimer" value={campaign.disclaimer} />
            <BriefField label="Legal" value={campaign.legal} />
          </div>
        </Card>

        <Card padding="none">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
            <Palette className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Creative Team
            </span>
          </div>
          <div className="px-3.5 py-3 space-y-2">
            <TeamRow label="Designer" name={designer?.user?.name ?? null} />
            <TeamRow label="Art Director" name={ad?.user?.name ?? null} />
            <Link
              href={`/campaigns/${campaignId}`}
              className="block pt-1 text-[10px] uppercase tracking-wider text-text-tertiary hover:text-text-secondary"
            >
              Manage team →
            </Link>
          </div>
        </Card>
      </div>

      {/* New run shortcut (for producers / designers once templates are ready) */}
      {["Admin", "Producer", "Post Producer", "Designer"].includes(user?.role ?? "") && (
        <Link
          href={`/asset-studio/runs/new?campaignId=${campaignId}`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-text-primary hover:border-primary hover:text-primary"
        >
          <PlayCircle className="h-3.5 w-3.5" />
          New run from a ready template
        </Link>
      )}
    </div>
  );
}

function BriefField({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
        {label}
      </p>
      <p className={`text-sm ${value ? "text-text-primary" : "italic text-text-tertiary"}`}>
        {value || "Not set — fill on the campaign page"}
      </p>
    </div>
  );
}

function TeamRow({ label, name }: { label: string; name: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </span>
      <span className={`text-sm ${name ? "text-text-primary" : "italic text-text-tertiary"}`}>
        {name || "Unassigned"}
      </span>
    </div>
  );
}

