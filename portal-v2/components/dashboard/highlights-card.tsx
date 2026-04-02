"use client";

import useSWR from "swr";
import { Sparkles } from "lucide-react";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

interface Highlight {
  id: string;
  title: string;
  body: string;
  emoji: string;
  pinned: boolean;
  created_at: string;
}

export function HighlightsCard() {
  const { data: highlights, isLoading } = useSWR<Highlight[]>("/api/highlights", fetcher);

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-xs overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          Highlights
        </span>
      </div>
      <div className="px-3.5 py-3 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-secondary" />
            ))}
          </div>
        ) : !highlights || highlights.length === 0 ? (
          <p className="text-xs text-text-tertiary py-4 text-center">No highlights yet</p>
        ) : (
          <div className="space-y-2.5">
            {highlights.map((h) => (
              <div
                key={h.id}
                className="flex gap-2.5 rounded-lg bg-surface-secondary/50 px-3 py-2.5 transition-colors"
              >
                <span className="text-lg leading-none shrink-0 mt-0.5">{h.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-text-primary leading-snug">{h.title}</p>
                  <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">{h.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
