"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { MenagerieProvider } from "@/components/menagerie/menagerie-provider";
import { PeacockDetector } from "@/components/menagerie/peacock-detector";
import { MothDetector } from "@/components/menagerie/moth-detector";
import { RaccoonDetector } from "@/components/menagerie/raccoon-detector";
import { TrophyCase } from "@/components/menagerie/trophy-case";
import { OnboardingModal, getProductIcon } from "@/components/onboarding/onboarding-modal";
import { DemoIcon } from "@/components/demo-mode/demo-icon";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, isLoading, isError, mutate } = useCurrentUser();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCompactPreview, setIsCompactPreview] = useState(false);

  useEffect(() => {
    if (!isLoading && isError) {
      router.replace("/login");
    }
  }, [isLoading, isError, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    setIsCompactPreview(params.get("density") === "compact");
  }, []);

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
    <MenagerieProvider userId={user.id}>
      <div className="flex h-full" data-density={isCompactPreview ? "compact" : undefined}>
        <Sidebar
          userRole={user.role}
          userName={user.name}
          userAvatar={user.avatarUrl}
          userProductIcon={getProductIcon(user.favoritePublixProduct) ?? undefined}
          userFavoriteProduct={user.favoritePublixProduct || undefined}
          vendorId={user.vendorId || undefined}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Main content area — offset by sidebar width on desktop */}
        <div className="flex flex-1 flex-col lg:pl-[245px]">
          <Topbar onMenuClick={() => setMobileOpen(true)} />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-[var(--density-page-content-px)] py-[var(--density-page-content-py)] lg:px-[var(--density-page-content-px-lg)]">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Onboarding — shown on first login */}
      {!user.onboardingCompleted && (
        <OnboardingModal
          user={user}
          onComplete={() => mutate()}
        />
      )}

      {/* Mutant Menagerie — creature detectors + trophy case */}
      <PeacockDetector />
      <MothDetector />
      <RaccoonDetector />
      <TrophyCase />

      {/* Demo Mode Icon */}
      {process.env.NEXT_PUBLIC_DEV_AUTH === "true" && <DemoIcon />}
    </MenagerieProvider>
  );
}
