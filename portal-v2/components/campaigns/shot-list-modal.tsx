"use client";

import { useEffect } from "react";
import { X, Printer, Download } from "lucide-react";
import type { ShotListSetup, ShotListShot } from "@/types/domain";
import { format, parseISO } from "date-fns";

interface Props {
  open: boolean;
  onClose: () => void;
  campaignName: string;
  wfNumber?: string | null;
  setups: ShotListSetup[];
}

function buildShotName(wf: string | undefined, n: number) {
  const w = (wf || "").replace(/\s/g, "");
  if (w) return `${w}-Shot${String(n).padStart(2, "0")}`;
  return `Shot${String(n).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  complete: "Complete",
  hero: "Hero",
  na: "N/A",
};

const STATUS_DOT: Record<string, string> = {
  complete: "bg-emerald-500",
  hero: "bg-primary",
  in_progress: "bg-amber-400",
  pending: "bg-border",
  na: "bg-border",
};

export function ShotListModal({ open, onClose, campaignName, wfNumber, setups }: Props) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent scroll on body while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const totalShots = setups.reduce((acc, s) => acc + s.shots.length, 0);

  function handlePrint() {
    window.print();
  }

  function handleDownload() {
    // Open a print-to-PDF prompt — cleanest cross-browser approach
    window.print();
  }

  return (
    <>
      {/* Print styles — injected into <head> via a style tag */}
      <style>{`
        @media print {
          body > *:not(#shot-list-print-root) { display: none !important; }
          #shot-list-print-root { display: block !important; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; border-radius: 0 !important; max-height: none !important; overflow: visible !important; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="no-print fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Modal panel */}
        <div
          id="shot-list-print-root"
          className="print-page relative bg-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-border"
        >
          {/* Modal header */}
          <div className="no-print flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="text-base font-semibold text-text-primary">{campaignName}</h2>
              <p className="text-xs text-text-tertiary mt-0.5">
                {wfNumber && <span className="mr-2">{wfNumber}</span>}
                Shot List · {setups.length} setup{setups.length !== 1 ? "s" : ""} · {totalShots} shot{totalShots !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
              >
                <Printer className="h-3.5 w-3.5" />
                Print / Save PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center rounded-lg border border-border p-1.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Print-only header */}
            <div className="hidden print:block mb-6">
              <h1 className="text-xl font-bold">{campaignName}</h1>
              {wfNumber && <p className="text-sm text-text-secondary">{wfNumber}</p>}
              <p className="text-sm text-text-secondary">{setups.length} setups · {totalShots} shots</p>
              <hr className="mt-3" />
            </div>

            {setups.length === 0 ? (
              <p className="text-sm text-text-tertiary py-4 text-center">No shots have been added to this campaign yet.</p>
            ) : (
              setups.map((setup, si) => (
                <div key={setup.id} className="space-y-3">
                  {/* Setup header */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold">
                      {si + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-text-primary">{setup.name || `Setup ${si + 1}`}</h3>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {setup.location && (
                          <span className="text-[10px] text-text-tertiary uppercase tracking-wider">{setup.location}</span>
                        )}
                        {setup.mediaType && (
                          <span className="text-[10px] text-text-tertiary uppercase tracking-wider">{setup.mediaType}</span>
                        )}
                        {setup.description && (
                          <span className="text-[10px] text-text-secondary">{setup.description}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-text-tertiary shrink-0">{setup.shots.length} shot{setup.shots.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Shots table */}
                  {setup.shots.length > 0 && (
                    <div className="rounded-xl border border-border overflow-hidden">
                      {/* Column headers */}
                      <div className="grid grid-cols-[28px_1fr_1fr_80px_80px_80px_80px] gap-0 bg-surface-secondary/60 border-b border-border">
                        <div className="px-2 py-2" />
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Shot / Description</div>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Notes</div>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Talent</div>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Props</div>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Wardrobe</div>
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Status</div>
                      </div>

                      {/* Shot rows */}
                      {setup.shots.map((shot, idx) => {
                        const shotNum = setups.slice(0, si).reduce((a, s) => a + s.shots.length, 0) + idx + 1;
                        const shotName = buildShotName(wfNumber ?? undefined, shotNum);
                        const dotClass = STATUS_DOT[shot.status] ?? "bg-border";
                        return (
                          <div
                            key={shot.id}
                            className={`grid grid-cols-[28px_1fr_1fr_80px_80px_80px_80px] gap-0 border-b border-border last:border-b-0 ${idx % 2 === 1 ? "bg-surface-secondary/20" : ""}`}
                          >
                            {/* Status dot */}
                            <div className="flex items-start justify-center pt-3 px-2">
                              <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
                            </div>
                            {/* Shot name + desc */}
                            <div className="px-3 py-2.5">
                              <p className="text-xs font-semibold text-text-primary">{shot.name || shotName}</p>
                              {shot.description && (
                                <p className="text-[10px] text-text-secondary mt-0.5 leading-relaxed">{shot.description}</p>
                              )}
                              {shot.angle && (
                                <p className="text-[10px] text-text-tertiary mt-0.5">{shot.angle}</p>
                              )}
                            </div>
                            {/* Notes */}
                            <div className="px-3 py-2.5">
                              <p className="text-[10px] text-text-secondary leading-relaxed">{shot.notes || "—"}</p>
                            </div>
                            {/* Talent */}
                            <div className="px-3 py-2.5">
                              <p className="text-[10px] text-text-secondary">{shot.talent || "—"}</p>
                            </div>
                            {/* Props */}
                            <div className="px-3 py-2.5">
                              <p className="text-[10px] text-text-secondary">{shot.props || "—"}</p>
                            </div>
                            {/* Wardrobe */}
                            <div className="px-3 py-2.5">
                              <p className="text-[10px] text-text-secondary">{shot.wardrobe || "—"}</p>
                            </div>
                            {/* Status */}
                            <div className="px-3 py-2.5">
                              <span className="text-[10px] text-text-secondary">{STATUS_LABEL[shot.status] ?? shot.status}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
