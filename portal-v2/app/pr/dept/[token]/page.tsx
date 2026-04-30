"use client";

import { use, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Printer, CalendarDays, ChevronRight } from "lucide-react";
import type { DeptCalendarView, DeptCalendarEntry } from "@/types/domain";
import { PRMonthCalendar } from "@/components/product-requests/pr-calendar";
import { PRSectionPreview } from "@/components/product-requests/pr-section-preview";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

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

function formatTime(value: string) {
  if (!value) return "";
  // Already has an AM/PM marker — trust the upstream string.
  if (/[ap]m/i.test(value)) return value.toUpperCase().replace(/\s+/g, " ");
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const period = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${min.toString().padStart(2, "0")} ${period}`;
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
  const { data, error, isLoading } = useSWR(
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-text-primary">
            This calendar is not available
          </h1>
          <p className="text-sm text-text-tertiary">
            The link may have expired. Please ask the sender for an updated link.
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-text-secondary" />
      </div>
    );
  }

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

      <div className="space-y-4">
        <PageHeader
          title="Calendar"
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Left column — calendar + upcoming list */}
          <div className="space-y-4 min-w-0">
            <PRMonthCalendar
              entries={data.entries}
              onEntryClick={(e) => setSelectedKey(entryKey(e))}
              selectedKey={selectedKey ?? undefined}
            />

            <Card padding="none">
              <CardHeader>
                <CardTitle>
                  <CalendarDays />
                  Upcoming shoots
                </CardTitle>
              </CardHeader>
              {isLoading ? null : upcoming.length === 0 ? (
                <p className="px-4 py-4 text-sm text-text-tertiary italic">
                  No upcoming shoots.
                </p>
              ) : (
                <ul className="divide-y divide-border-light">
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
                              : "hover:bg-surface-secondary"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-semibold text-text-primary">
                                {formatLongDate(e.shootDate)}
                              </span>
                              <span className="text-xs text-text-tertiary">
                                {e.campaign.wfNumber}
                              </span>
                            </div>
                            <div className="text-xs text-text-secondary truncate">
                              {e.campaign.name}
                            </div>
                            <div className="text-xs text-text-tertiary mt-0.5">
                              {e.pickupTime
                                ? `Pickup: ${formatTime(e.pickupTime)}`
                                : "Pickup: TBD"}
                              {" · "}
                              {e.itemCount}{" "}
                              {e.itemCount === 1 ? "item" : "items"}
                            </div>
                          </div>
                          <ChevronRight
                            className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                              active
                                ? "text-primary"
                                : "text-text-tertiary group-hover:text-text-secondary"
                            }`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {/* Right column — preview */}
          <Card
            padding="none"
            className="min-h-[24rem] min-w-0 overflow-hidden"
          >
            {selectedEntry?.sectionToken ? (
              <PRSectionPreview
                key={selectedEntry.sectionToken}
                token={selectedEntry.sectionToken}
              />
            ) : (
              <div className="h-full flex items-center justify-center px-6 py-12 text-center">
                <p className="text-sm text-text-tertiary">
                  Select a shoot on the left to preview it here.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
