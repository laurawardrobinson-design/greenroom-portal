"use client";

import { use } from "react";
import useSWR from "swr";
import Image from "next/image";
import {
  Printer,
  CalendarDays,
  Clock,
  MapPin,
  User,
  Phone,
  FileText,
  ExternalLink,
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
    weekday: "long",
    month: "long",
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

export default function PRViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { data, error } = useSWR(
    token ? `/api/product-requests/view/${token}` : null,
    fetcher
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-neutral-900">
            This product request is not available
          </h1>
          <p className="text-sm text-neutral-500">
            The link may have expired or been superseded. Please ask the sender
            for an updated link.
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

  const { docNumber, campaign, shoot, notes, section } = data;
  const deptLabel = PR_DEPARTMENT_LABELS[section.department];
  const pickupDate = section.dateNeeded || shoot.date;
  const pickupTime = section.timeNeeded || shoot.callTime;

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white">
      <style jsx global>{`
        @media print {
          @page {
            margin: 0.5in;
            size: letter;
          }
          .no-print {
            display: none !important;
          }
          .print-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>

      {/* Toolbar — hidden in print */}
      <div className="no-print sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-200">
        <div className="max-w-[8.5in] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/greenroom-logo.png"
              alt="Greenroom"
              width={28}
              height={28}
              className="h-7 w-auto"
            />
            <span className="text-[13px] text-neutral-500">
              Read-only product request — {docNumber}
            </span>
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

      {/* Printable page */}
      <div className="max-w-[8.5in] mx-auto my-6 bg-white border border-neutral-200 shadow-sm print-page">
        {/* Letterhead */}
        <header className="px-10 pt-10 pb-6 border-b-2 border-neutral-900">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image
                src="/greenroom-logo.png"
                alt="Greenroom"
                width={44}
                height={44}
                className="h-11 w-auto"
              />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
                  Product Request
                </div>
                <div className="text-[20px] font-semibold text-neutral-900 leading-tight">
                  {deptLabel}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                Request No.
              </div>
              <div className="text-[18px] font-semibold text-neutral-900">
                {docNumber}
              </div>
              {campaign.wfNumber && (
                <div className="text-[12px] text-neutral-500 mt-0.5">
                  {campaign.wfNumber}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              Campaign
            </div>
            <div className="text-[15px] text-neutral-900 mt-0.5">
              {[campaign.brand, campaign.name].filter(Boolean).join(" · ") ||
                campaign.name}
            </div>
          </div>
        </header>

        {/* Meta grid: shoot + pickup */}
        <section className="grid grid-cols-2 gap-0 border-b border-neutral-200">
          <div className="px-10 py-5 border-r border-neutral-200">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
              Shoot
            </div>
            <div className="space-y-1.5 text-[13px] text-neutral-900">
              <div className="flex items-start gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-neutral-500 mt-0.5 shrink-0" />
                <span>{formatLongDate(shoot.date)}</span>
              </div>
              {shoot.callTime && (
                <div className="flex items-start gap-2">
                  <Clock className="h-3.5 w-3.5 text-neutral-500 mt-0.5 shrink-0" />
                  <span>Call {formatTime(shoot.callTime)}</span>
                </div>
              )}
              {shoot.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-neutral-500 mt-0.5 shrink-0" />
                  <span>{shoot.location}</span>
                </div>
              )}
            </div>
          </div>
          <div className="px-10 py-5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
              Pickup
            </div>
            <div className="space-y-1.5 text-[13px] text-neutral-900">
              {(section.dateNeeded || section.timeNeeded) && (
                <div className="flex items-start gap-2">
                  <Clock className="h-3.5 w-3.5 text-neutral-500 mt-0.5 shrink-0" />
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
                <div className="flex items-start gap-2">
                  <User className="h-3.5 w-3.5 text-neutral-500 mt-0.5 shrink-0" />
                  <span>{section.pickupPerson}</span>
                </div>
              )}
              {section.pickupPhone && (
                <div className="flex items-start gap-2">
                  <Phone className="h-3.5 w-3.5 text-neutral-500 mt-0.5 shrink-0" />
                  <a
                    href={`tel:${section.pickupPhone.replace(/[^0-9+]/g, "")}`}
                    className="hover:underline"
                  >
                    {section.pickupPhone}
                  </a>
                </div>
              )}
              {!section.pickupPerson && !section.pickupPhone && (
                <div className="text-neutral-400 italic text-[12px]">
                  Pickup contact TBD — coordinate with sender
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Items table */}
        <section className="px-10 py-6">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Products requested
            </div>
            <div className="text-[11px] text-neutral-500">
              {section.items.length}{" "}
              {section.items.length === 1 ? "item" : "items"}
            </div>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b-2 border-neutral-900 text-left">
                <th className="py-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-20">
                  Item #
                </th>
                <th className="py-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Product
                </th>
                <th className="py-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-20 text-right">
                  Qty
                </th>
                <th className="py-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-24">
                  Size
                </th>
                <th className="py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 w-20">
                  R&amp;P
                </th>
              </tr>
            </thead>
            <tbody>
              {section.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-neutral-200 align-top"
                >
                  <td className="py-2.5 pr-3 text-neutral-500">
                    {item.product?.itemCode || "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="text-neutral-900">
                      {item.product?.name ?? "(no product)"}
                    </div>
                    {item.specialInstructions && (
                      <div className="mt-0.5 text-[12px] text-neutral-600 italic">
                        {item.specialInstructions}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-neutral-900">
                    {item.quantity}
                  </td>
                  <td className="py-2.5 pr-3 text-neutral-700">
                    {item.size || "—"}
                  </td>
                  <td className="py-2.5 text-[12px]">
                    {item.product?.rpGuideUrl ? (
                      <a
                        href={item.product.rpGuideUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#004C2A] hover:underline"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {section.items.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 text-center text-neutral-400 italic"
                  >
                    No items in this section.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Notes */}
        {notes && (
          <section className="px-10 py-5 border-t border-neutral-200">
            <div className="flex items-baseline gap-2 mb-2">
              <FileText className="h-3.5 w-3.5 text-neutral-500" />
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Notes from producer
              </div>
            </div>
            <p className="text-[13px] text-neutral-700 whitespace-pre-wrap">
              {notes}
            </p>
          </section>
        )}

        {/* Footer */}
        <footer className="px-10 py-5 border-t border-neutral-200 text-[10px] text-neutral-400 flex items-center justify-between">
          <span>Generated by Greenroom · {docNumber}</span>
          <span>Read-only · any edits must be requested from the producer</span>
        </footer>
      </div>
    </div>
  );
}
