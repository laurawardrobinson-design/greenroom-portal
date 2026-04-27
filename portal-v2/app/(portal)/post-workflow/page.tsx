"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { EditRoomCalendar } from "@/components/post-workflow/edit-room-calendar";
import { DriveInventory } from "@/components/post-workflow/drive-inventory";
import { Clapperboard, HardDrive } from "lucide-react";
import { PageTabs } from "@/components/ui/page-tabs";

type Tab = "edit-rooms" | "drives";

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "edit-rooms", label: "Edit Rooms", icon: Clapperboard },
  { id: "drives",     label: "Hard Drives", icon: HardDrive },
];

export default function PostWorkflowPage() {
  const { user, isLoading } = useCurrentUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam === "drives" ? "drives" : "edit-rooms"
  );

  // Sync URL param → tab state
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam === "drives" ? "drives" : "edit-rooms");
    }
  }, [tabParam]);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    router.replace(`/post-workflow?tab=${tab}`, { scroll: false });
  }

  if (isLoading || !user) return <DashboardSkeleton />;

  if (!["Admin", "Producer", "Post Producer"].includes(user.role)) {
    return (
      <EmptyState
        title="Access restricted"
        description="You don't have permission to view Post Production."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-0">
        <PageHeader title="Post Production" showDivider={false} />

        <PageTabs
          tabs={TABS.map(({ id, label }) => ({ key: id, label }))}
          activeTab={activeTab}
          onTabChange={(key) => switchTab(key as Tab)}
        />
      </div>

      {/* Tab content */}
      {activeTab === "edit-rooms" && <EditRoomCalendar user={user} />}
      {activeTab === "drives" && <DriveInventory user={user} />}
    </div>
  );
}
