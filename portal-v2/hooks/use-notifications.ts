"use client";

import useSWR from "swr";
import type { Notification } from "@/types/domain";

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR<Notification[]>(
    "/api/notifications",
    fetcher,
    { refreshInterval: 60_000 } // poll every minute
  );

  const notifications = data || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markRead(id: string) {
    // Optimistic update
    mutate(
      notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      false
    );
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    mutate();
  }

  async function markAllRead() {
    mutate(
      notifications.map((n) => ({ ...n, read: true })),
      false
    );
    await fetch("/api/notifications", { method: "PATCH" });
    mutate();
  }

  return {
    notifications,
    unreadCount,
    isLoading,
    isError: !!error,
    markRead,
    markAllRead,
  };
}
