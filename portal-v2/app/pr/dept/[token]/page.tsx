"use client";

import { use, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import { Printer, CalendarDays, ChevronRight } from "lucide-react";
import type { DeptCalendarView, DeptCalendarEntry } from "@/types/domain";
import { PR_DEPARTMENT_LABELS } from "@/types/domain";
import { PRMonthCalendar } from "@/components/product-requests/pr-calendar";
import { PRSectionPreview } from "@/components/product-requests/pr-section-preview";

async function fetcher(url: string): Promise<DeptCalendarView> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

function formatLongDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(hhmm: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  const period = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function entryKey(e: DeptCalendarEntry) {
  return `${e.docId}:${e.department}`;
}

export default function DeptCalendarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { data, error } = useSWR(
    token ? `/api/product-requests/calendar/${token}` : null,
    fetcher
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const upcoming = useMemo(
    () =>
      (data?.entries ?? []).filter(
        (e) => e.shootDate >= new Date().toISOString().slice(0, 10)
      ),
    [data]
  );

  // Default to the first upcoming shoot when data arrives.
  useEffect(() => {
    if (!selectedKey && upcoming.length > 0) {
      setSelectedKey(entryKey(upcoming[0]));
    }
  }, [upcoming, selectedKey]);

  const selectedEntry = useMemo(
    () =>
      (data?.entries ?? []).find((e) => entryKey(e) === selectedKey) ?? null,
    [data, selectedKey]
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-neutral-900">
            This calendar is not available
          </h1>
          <p className="text-sm text-neutral-500">
            The link may have expired. Please ask the sender for an updated link.
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </div>
    );
  }

  const deptLabel = PR_DEPARTMENT_LABELS[data.department];

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            margin: 0.4in;
            size: letter landscape;
          }
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>

      {/* Sticky toolbar */}
      <div className="no-print sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-200">
        <div className="max-w-[11in] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="text-[13px] text-neutral-500">
            <span className="font-medium text-neutral-900">{deptLabel}</span>{" "}
            calendar
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-800 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </div>

      <div className="max-w-[11in] w-full mx-auto px-6 py-6 space-y-5">
        {/* Letterhead */}
        <header className="bg-white border border-neutral-200 rounded-xl px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/greenroom-logo.png"
              alt="Greenroom"
              width={36}
              height={36}
              className="h-9 w-auto"
            />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
                Department Calendar
              </div>
              <div className="text-[18px] font-semibold text-neutral-900 leading-tight">
                {deptLabel}
              </div>
            </div>
          </div>
          <div className="text-right text-[11px] text-neutral-500">
            <span>
              {upcoming.length} upcoming{" "}
              {upcoming.length === 1 ? "shoot" : "shoots"}
            </span>
            <div className="text-neutral-400 mt-0.5 max-w-[18rem]">
              Read-only · updates are reflected automatically
            </div>
          </div>
        </header>

        {/* Side-by-side: left stack (calendar + list) | right preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left column */}
          <div className="space-y-4 min-w-0">
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <PRMonthCalendar
                entries={data.entries}
                onEntryClick={(e) => setSelectedKey(entryKey(e))}
                selectedKey={selectedKey ?? undefined}
              />
            </div>

            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-neutral-200 flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-neutral-500" />
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Upcoming shoots
                </h3>
              </div>
              {upcoming.length === 0 ? (
                <p className="px-4 py-4 text-[12px] text-neutral-400 italic">
                  No upcoming shoots for {deptLabel}.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {upcoming.map((e) => {
                    const k = entryKey(e);
                    const active = selectedKey === k;
                    return (
                      <li key={k}>
                        <button
                          onClick={() => setSelectedKey(k)}
                          className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                            active
                              ? "bg-primary/[0.06]"
                              : "hover:bg-neutral-50"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[13px] font-semibold text-neutral-900">
                                {formatLongDate(e.shootDate)}
                              </span>
                              <span className="text-[11px] text-neutral-500">
                                {e.campaign.wfNumber}
                              </span>
                            </div>
                            <div className="text-[12px] text-neutral-600 truncate">
                              {e.campaign.name}
                            </div>
                            <div className="text-[11px] text-neutral-500 mt-0.5">
                              {e.pickupPerson || "Pickup TBD"}
                              {e.pickupTime
                                ? ` · ${formatTime(e.pickupTime)}`
                                : ""}
                              {" · "}
                              {e.itemCount}{" "}
                              {e.itemCount === 1 ? "item" : "items"}
                            </div>
                          </div>
                          <ChevronRight
                            className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                              active
                                ? "text-primary"
                                : "text-neutral-400 group-hover:text-neutral-700"
                            }`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right column — preview */}
          <div className="bg-white border border-neutral-200 rounded-xl min-h-[24rem] min-w-0 overflow-hidden">
            {selectedEntry?.sectionToken ? (
              <PRSectionPreview
                key={selectedEntry.sectionToken}
                token={selectedEntry.sectionToken}
              />
            ) : (
              <div className="h-full flex items-center justify-center px-6 py-12 text-center">
                <p className="text-[13px] text-neutral-400">
                  Select a shoot on the left to preview it here.
                </p>
              </div>
            )}
          </div>
        </div>

        <footer className="text-center text-[10px] text-neutral-400 pt-2">
          Generated by Greenroom · Read-only · any edits must be requested from
          the producer
        </footer>
      </div>
    </>
  );
}
