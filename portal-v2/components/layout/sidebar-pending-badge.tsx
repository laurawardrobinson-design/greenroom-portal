"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : []));

export function SidebarPendingBadge() {
  const { data = [] } = useSWR<unknown[]>("/api/pending-documents", fetcher, {
    refreshInterval: 60_000,
  });
  const count = Array.isArray(data) ? data.length : 0;
  if (count === 0) return null;
  return (
    <span className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-warning">
      {count}
    </span>
  );
}
