"use client";

import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { QRCodeSVG } from "qrcode.react";
import type { GearItem } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

export default function PrintLabelsPage() {
  const searchParams = useSearchParams();
  const ids = searchParams.get("ids") || "";

  const { data: rawAllItems } = useSWR<GearItem[]>("/api/gear", fetcher);
  const allItems: GearItem[] = Array.isArray(rawAllItems) ? rawAllItems : [];

  const idSet = new Set(ids.split(",").filter(Boolean));
  const items =
    idSet.size > 0
      ? allItems.filter((i) => idSet.has(i.id))
      : allItems;

  return (
    <div>
      {/* Screen-only header */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Link
          href="/gear"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-text-primary">
            Print QR Labels
          </h2>
          <p className="text-sm text-text-secondary">
            {items.length} label{items.length !== 1 ? "s" : ""} ready to print
          </p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      {/* Label grid — optimized for print */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4 print:rounded-none print:border print:border-gray-300 print:p-3"
          >
            <QRCodeSVG
              value={item.qrCode}
              size={120}
              level="M"
              includeMargin={false}
            />
            <div className="text-center">
              <p className="text-xs font-semibold text-text-primary print:text-black">
                {item.name}
              </p>
              <p className="text-[10px] text-text-tertiary print:text-gray-600">
                {item.brand} {item.model}
              </p>
              <p className="text-[10px] font-mono text-text-tertiary mt-0.5 print:text-gray-500">
                {item.qrCode}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except label content */
          nav,
          aside,
          header,
          .print\\:hidden {
            display: none !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            margin: 0.5in;
          }
        }
      `}</style>
    </div>
  );
}
