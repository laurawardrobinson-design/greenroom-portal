"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { MenagerieProvider } from "@/components/menagerie/menagerie-provider";
import { PeacockDetector } from "@/components/menagerie/peacock-detector";
import { MothDetector } from "@/components/menagerie/moth-detector";
import { RaccoonDetector } from "@/components/menagerie/raccoon-detector";
import { TrophyCase } from "@/components/menagerie/trophy-case";

interface AppShellProps {
  children: React.ReactNode;
}

function AppShellInner({ children }: AppShellProps) {
  const { user, isLoading } = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-4xl px-6">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full">
        <Sidebar
          userRole={user.role}
          userName={user.name}
          userAvatar={user.avatarUrl}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Main content area — offset by sidebar width on desktop */}
        <div className="flex flex-1 flex-col lg:pl-60">
          <Topbar onMenuClick={() => setMobileOpen(true)} />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mutant Menagerie — creature detectors + trophy case */}
      <PeacockDetector />
      <MothDetector />
      <RaccoonDetector />
      <TrophyCase />
    </>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <MenagerieProvider>
      <AppShellInner>{children}</AppShellInner>
    </MenagerieProvider>
  );
}
