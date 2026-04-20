"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTabs } from "@/components/ui/page-tabs";
import {
  LayoutGrid,
  FileImage,
  PlayCircle,
  Images,
  Palette,
  Megaphone,
  FolderSync,
  ListChecks,
} from "lucide-react";
import { OverviewTab } from "@/components/asset-studio/overview-tab";
import { TemplatesTab } from "@/components/asset-studio/templates-tab";
import { RunsTab } from "@/components/asset-studio/runs-tab";
import { VariantsTab } from "@/components/asset-studio/variants-tab";
import { BrandTab } from "@/components/asset-studio/brand-tab";
import { ChannelsTab } from "@/components/asset-studio/channels-tab";
import { DamTab } from "@/components/asset-studio/dam-tab";
import { MyWorkTab } from "@/components/asset-studio/my-work-tab";

type Tab =
  | "overview"
  | "templates"
  | "runs"
  | "variants"
  | "dam"
  | "my_work"
  | "brand"
  | "channels";

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "overview",  label: "Overview",  icon: LayoutGrid },
  { id: "templates", label: "Templates", icon: FileImage },
  { id: "runs",      label: "Runs",      icon: PlayCircle },
  { id: "variants",  label: "Variants",  icon: Images },
  { id: "dam",       label: "DAM",       icon: FolderSync },
  { id: "my_work",   label: "My Work",   icon: ListChecks },
  { id: "brand",     label: "Brand",     icon: Palette },
  { id: "channels",  label: "Channels",  icon: Megaphone },
];

const ALLOWED_ROLES = ["Admin", "Producer", "Post Producer", "Designer", "Art Director", "Creative Director"];

// Role-aware default landing. Designers open Asset Studio to see the
// deliverables they need to template — not a dashboard. Art Director
// and Creative Director default to the variants queue where their
// approval work lives.
function defaultTabForRole(role?: string): Tab {
  if (role === "Designer") return "my_work";
  if (role === "Creative Director" || role === "Art Director") return "variants";
  return "overview";
}

export default function AssetStudioPage() {
  const { user, isLoading } = useCurrentUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab") as Tab | null;

  // URL wins when present and valid; otherwise pick a landing tab
  // based on the user's role.
  const activeTab: Tab =
    tabParam && TABS.some((t) => t.id === tabParam)
      ? (tabParam as Tab)
      : defaultTabForRole(user?.role);

  function switchTab(tab: Tab) {
    router.replace(`/asset-studio?tab=${tab}`, { scroll: false });
  }

  if (isLoading || !user) return <DashboardSkeleton />;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return (
      <EmptyState
        title="Access restricted"
        description="Asset Studio is available to Designers, Producers, Post Producers, Art Directors, Creative Directors, and Admins."
      />
    );
  }

  return (
    <div className="space-y-5" data-area="asset-studio">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Asset Studio</h1>
        <p className="text-sm text-text-secondary">
          Build templates, generate variants, ship campaigns — with brand consistency on rails.
        </p>
      </div>

      <PageTabs
        tabs={TABS.map(({ id, label, icon }) => ({ key: id, label, icon }))}
        activeTab={activeTab}
        onTabChange={(key) => switchTab(key as Tab)}
      />

      {activeTab === "overview"  && <OverviewTab  user={user} />}
      {activeTab === "templates" && <TemplatesTab user={user} />}
      {activeTab === "runs"      && <RunsTab      user={user} />}
      {activeTab === "variants"  && <VariantsTab  user={user} />}
      {activeTab === "dam"       && <DamTab       user={user} />}
      {activeTab === "my_work"   && <MyWorkTab    user={user} />}
      {activeTab === "brand"     && <BrandTab     user={user} />}
      {activeTab === "channels"  && <ChannelsTab  user={user} />}
    </div>
  );
}
