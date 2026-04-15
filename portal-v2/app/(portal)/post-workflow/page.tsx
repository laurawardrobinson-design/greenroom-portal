"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { EditRoomCalendar } from "@/components/post-workflow/edit-room-calendar";
import { DriveInventory } from "@/components/post-workflow/drive-inventory";
import { Clapperboard, HardDrive } from "lucide-react";

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
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Post Production</h1>
        <p className="text-sm text-text-secondary">
          Edit room reservations and hard drive management
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface-secondary p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`
              flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all
              ${activeTab === id
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
              }
            `}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "edit-rooms" && <EditRoomCalendar user={user} />}
      {activeTab === "drives" && <DriveInventory user={user} />}
    </div>
  );
}
