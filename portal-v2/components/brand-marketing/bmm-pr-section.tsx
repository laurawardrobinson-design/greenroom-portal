"use client";

import { useState } from "react";
import { PackageSearch } from "lucide-react";
import useSWR from "swr";
import type { PRDoc } from "@/types/domain";
import { PRStatusPill } from "@/components/product-requests/pr-status-pill";
import { PRDocDrawer } from "@/components/product-requests/pr-doc-drawer";
import { useToast } from "@/components/ui/toast";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatShootDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface Props {
  campaignId: string;
}

export function BmmPrSection({ campaignId }: Props) {
  const { toast } = useToast();
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const { data: docs, mutate } = useSWR<PRDoc[]>(
    `/api/product-requests?campaignId=${campaignId}&detail=light`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  const visibleDocs = (docs ?? []).filter(
    (d) => d.status !== "draft" && d.status !== "cancelled"
  );

  async function sendForRBU(docId: string) {
    setSending(docId);
    try {
      const res = await fetch(`/api/product-requests/${docId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "forwarded" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      mutate();
      toast("success", "Sent for RBU confirmation");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="flex flex-col border border-border rounded-lg bg-surface overflow-hidden">
      {/* Tile header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border shrink-0">
        <PackageSearch className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          Product Requests
        </span>
      </div>

      <div className="p-3.5 space-y-2">
        {visibleDocs.length === 0 ? (
          <p className="text-sm text-text-tertiary py-2">
            No product requests yet — once a producer submits one, it will appear here.
          </p>
        ) : (
          visibleDocs.map((doc) => {
            const depts = [...new Set(doc.sections.map((s) => s.department))];
            const deptLabel = depts
              .map((d) => (d === "Meat-Seafood" ? "Meat & Seafood" : d))
              .join(" · ");

            return (
              <div
                key={doc.id}
                className="rounded-lg border border-border bg-surface-secondary/40 overflow-hidden"
              >
                {/* Row */}
                <button
                  type="button"
                  onClick={() => setOpenDocId(doc.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-secondary/70 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-text-primary">
                        {formatShootDate(doc.shootDate)}
                      </span>
                      <PRStatusPill status={doc.status} />
                    </div>
                    {deptLabel && (
                      <p className="text-[10px] text-text-tertiary truncate">{deptLabel}</p>
                    )}
                  </div>
                </button>

                {/* BMM action — only for submitted PRs */}
                {doc.status === "submitted" && (
                  <div className="px-3 pb-2.5 pt-0">
                    <button
                      type="button"
                      disabled={sending === doc.id}
                      onClick={() => sendForRBU(doc.id)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {sending === doc.id ? "Sending…" : "Send for RBU Confirmation"}
                    </button>
                  </div>
                )}

                {/* Forwarded state */}
                {doc.status === "forwarded" && (
                  <div className="px-3 pb-2.5 pt-0">
                    <p className="text-[10px] text-text-tertiary">Awaiting RBU confirmation</p>
                  </div>
                )}

                {/* Confirmed state */}
                {doc.status === "confirmed" && (
                  <div className="px-3 pb-2.5 pt-0">
                    <p className="text-[10px] text-emerald-600 font-medium">Confirmed by RBU</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <PRDocDrawer id={openDocId} onClose={() => setOpenDocId(null)} />
    </div>
  );
}
