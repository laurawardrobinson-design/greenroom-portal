"use client";

import useSWR from "swr";
import {
  CalendarDays,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import type { PRSectionPublicView } from "@/types/domain";
import { PR_DEPARTMENT_LABELS } from "@/types/domain";

async function fetcher(url: string): Promise<PRSectionPublicView> {
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

// Read-only preview of a PR section, used as a side panel in the
// dept calendar pages. Fetches via the public token-gated endpoint.
export function PRSectionPreview({ token }: { token: string }) {
  const { data, error } = useSWR(
    token ? `/api/product-requests/view/${token}` : null,
    fetcher
  );

  if (error) {
    return (
      <div className="p-6 text-center text-[13px] text-neutral-500">
        Could not load this shoot.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </div>
    );
  }

  const { campaign, shoot, notes, section } = data;
  const deptLabel = PR_DEPARTMENT_LABELS[section.department];

  return (
    <div className="divide-y divide-neutral-200">
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            {deptLabel}
          </div>
          <div className="text-[15px] font-semibold text-neutral-900 leading-snug mt-0.5 truncate">
            {[campaign.brand, campaign.name].filter(Boolean).join(" · ") ||
              campaign.name}
          </div>
          {campaign.wfNumber && (
            <div className="text-[11px] text-neutral-500 mt-0.5">
              {campaign.wfNumber}
            </div>
          )}
        </div>
        <a
          href={`/pr/view/${token}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[11px] text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 transition-colors"
          title="Open printable version"
        >
          Open
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-0">
        <div className="px-5 py-3 border-r border-neutral-200">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Shoot
          </div>
          <div className="space-y-1 text-[12px] text-neutral-900">
            <div className="flex items-start gap-1.5">
              <CalendarDays className="h-3 w-3 text-neutral-500 mt-0.5 shrink-0" />
              <span>{formatLongDate(shoot.date)}</span>
            </div>
            {shoot.callTime && (
              <div className="flex items-start gap-1.5">
                <Clock className="h-3 w-3 text-neutral-500 mt-0.5 shrink-0" />
                <span>Call {formatTime(shoot.callTime)}</span>
              </div>
            )}
            {shoot.location && (
              <div className="flex items-start gap-1.5">
                <MapPin className="h-3 w-3 text-neutral-500 mt-0.5 shrink-0" />
                <span>{shoot.location}</span>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
            Pickup
          </div>
          <div className="space-y-1 text-[12px] text-neutral-900">
            {(section.dateNeeded || section.timeNeeded) && (
              <div className="flex items-start gap-1.5">
                <Clock className="h-3 w-3 text-neutral-500 mt-0.5 shrink-0" />
                <span>
                  {section.dateNeeded
                    ? formatLongDate(section.dateNeeded)
                    : "TBD"}
                  {section.timeNeeded
                    ? ` · ${formatTime(section.timeNeeded)}`
                    : ""}
                </span>
              </div>
            )}
            {section.pickupPerson && (
              <div className="flex items-start gap-1.5">
                <User className="h-3 w-3 text-neutral-500 mt-0.5 shrink-0" />
                <span>{section.pickupPerson}</span>
              </div>
            )}
            {section.pickupPhone && (
              <div className="flex items-start gap-1.5">
                <Phone className="h-3 w-3 text-neutral-500 mt-0.5 shrink-0" />
                <a
                  href={`tel:${section.pickupPhone.replace(/[^0-9+]/g, "")}`}
                  className="hover:underline"
                >
                  {section.pickupPhone}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Products
          </div>
          <div className="text-[10px] text-neutral-500">
            {section.items.length}{" "}
            {section.items.length === 1 ? "item" : "items"}
          </div>
        </div>
        {section.items.length === 0 ? (
          <p className="text-[12px] text-neutral-400 italic">
            No items in this section.
          </p>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th className="py-1.5 pr-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-16">
                  Item #
                </th>
                <th className="py-1.5 pr-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Product
                </th>
                <th className="py-1.5 pr-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-10 text-right">
                  Qty
                </th>
                <th className="py-1.5 pr-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-16">
                  Size
                </th>
                <th className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-12">
                  R&amp;P
                </th>
              </tr>
            </thead>
            <tbody>
              {section.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-neutral-100 last:border-b-0 align-top"
                >
                  <td className="py-1.5 pr-2 text-neutral-500">
                    {item.product?.itemCode || "—"}
                  </td>
                  <td className="py-1.5 pr-2">
                    <div className="text-neutral-900">
                      {item.product?.name ?? "(no product)"}
                    </div>
                    {item.specialInstructions && (
                      <div className="text-[11px] text-neutral-600 italic">
                        {item.specialInstructions}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right text-neutral-900">
                    {item.quantity}
                  </td>
                  <td className="py-1.5 pr-2 text-neutral-700">
                    {item.size || "—"}
                  </td>
                  <td className="py-1.5 text-[11px]">
                    {item.product?.rpGuideUrl ? (
                      <a
                        href={item.product.rpGuideUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#004C2A] hover:underline"
                      >
                        View
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Notes */}
      {notes && (
        <div className="px-5 py-3">
          <div className="flex items-baseline gap-1.5 mb-1">
            <FileText className="h-3 w-3 text-neutral-500" />
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Notes from producer
            </div>
          </div>
          <p className="text-[12px] text-neutral-700 whitespace-pre-wrap">
            {notes}
          </p>
        </div>
      )}
    </div>
  );
}
