"use client";

import { SWRConfig } from "swr";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 15000,
      }}
    >
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </SWRConfig>
  );
}
