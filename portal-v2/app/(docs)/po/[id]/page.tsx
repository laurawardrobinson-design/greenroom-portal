"use client";

import { use } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { Printer } from "lucide-react";

async function fetcher(url: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    if (r.status === 404 && attempt < 3) {
      await new Promise((res) => setTimeout(res, 400));
      continue;
    }
    throw new Error("Failed");
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function PoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error } = useSWR(`/api/po/view/${id}`, fetcher);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Could not load purchase order.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  const { cv, estimateItems } = data;
  const vendor = cv.vendors;
  const campaign = cv.campaigns;

  const poNumber = cv.po_number || `PO-${campaign.wf_number}`;
  const poDate = cv.updated_at;
  const total = Number(cv.estimate_total) || 0;

  const isSigned = !!cv.po_signed_at;
  const signatureUrl = cv.signature_url as string | null;
  const signatureName = cv.signature_name as string | null;
  const signatureTimestamp = cv.signature_timestamp as string | null;

  return (
    <div className="min-h-screen bg-white">
      {/* Print toolbar */}
      <div className="print:hidden flex items-center justify-between px-8 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-xs text-gray-400 font-medium tracking-wide uppercase">
          Purchase Order
        </span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
      </div>

      {/* Document */}
      <div className="max-w-2xl mx-auto px-12 py-14">
        {/* Header */}
        <div className="flex items-start justify-between mb-12">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Greenroom
            </p>
            <p className="text-xs text-gray-400">Production Team</p>
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-light tracking-tight text-gray-900 mb-1">
              Purchase Order
            </h1>
            <p className="text-xs text-gray-400">{poNumber}</p>
          </div>
        </div>

        {/* Vendor / Project grid */}
        <div className="grid grid-cols-2 gap-8 mb-10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Vendor
            </p>
            <p className="text-sm font-semibold text-gray-900">{vendor?.company_name}</p>
            {vendor?.contact_name && (
              <p className="text-xs text-gray-500 mt-0.5">{vendor.contact_name}</p>
            )}
            {vendor?.email && (
              <p className="text-xs text-gray-400 mt-0.5">{vendor.email}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Project
            </p>
            <p className="text-sm font-semibold text-gray-900">{campaign?.name}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{campaign?.wf_number}</p>
          </div>
        </div>

        {/* Date */}
        <div className="mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Issue Date
          </p>
          <p className="text-sm text-gray-700">
            {poDate ? format(new Date(poDate), "MMMM d, yyyy") : "—"}
          </p>
        </div>

        {/* Line items */}
        <div className="mb-8">
          <div className="grid grid-cols-[1fr_60px_80px_80px] gap-4 pb-2 border-b border-gray-200 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Description
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-right">
              Qty
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-right">
              Unit Price
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-right">
              Amount
            </p>
          </div>

          {estimateItems.length > 0 ? (
            estimateItems.map(
              (
                item: {
                  description: string;
                  quantity: number;
                  unit_price: number;
                  amount: number;
                  category: string;
                },
                i: number
              ) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_60px_80px_80px] gap-4 py-2.5 border-b border-gray-100"
                >
                  <div>
                    <p className="text-sm text-gray-700">{item.description}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">
                      {item.category}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 text-right tabular-nums">
                    {item.quantity}
                  </p>
                  <p className="text-sm text-gray-500 text-right tabular-nums">
                    {fmt(item.unit_price)}
                  </p>
                  <p className="text-sm text-gray-900 text-right tabular-nums">
                    {fmt(item.amount)}
                  </p>
                </div>
              )
            )
          ) : (
            <div className="py-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 italic">Services as described in estimate</p>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="flex justify-end mb-12">
          <div className="w-56">
            <div className="flex justify-between items-center pt-3 border-t-2 border-gray-900">
              <p className="text-sm font-semibold text-gray-900">Total Authorized</p>
              <p className="text-sm font-semibold text-gray-900 tabular-nums">
                {fmt(total)}
              </p>
            </div>
          </div>
        </div>

        {/* Issued by */}
        <div className="grid grid-cols-2 gap-8 mb-12 pt-6 border-t border-gray-100">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Authorized by
            </p>
            <p className="text-sm font-semibold text-gray-900">Greenroom</p>
            <p className="text-xs text-gray-500 mt-0.5">Production Team</p>
            <p className="text-xs text-gray-400 mt-0.5">Publix Super Markets</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Purchase Order No.
            </p>
            <p className="text-sm font-mono font-semibold text-gray-900">{poNumber}</p>
          </div>
        </div>

        {/* Vendor signature section */}
        <div className="pt-6 border-t border-gray-200">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-4">
            Vendor Acceptance
          </p>

          {isSigned && signatureUrl ? (
            <div className="space-y-3">
              <div>
                {/* Drawn signature */}
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signatureUrl}
                    alt="Vendor signature"
                    className="h-16 max-w-xs"
                    style={{ imageRendering: "crisp-edges" }}
                  />
                </div>
              </div>
              <div className="flex gap-8 text-xs text-gray-600">
                <div>
                  <span className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold block mb-0.5">
                    Printed Name
                  </span>
                  {signatureName || "—"}
                </div>
                <div>
                  <span className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold block mb-0.5">
                    Date Signed
                  </span>
                  {signatureTimestamp
                    ? format(new Date(signatureTimestamp), "MMMM d, yyyy h:mm a")
                    : cv.po_signed_at
                    ? format(new Date(cv.po_signed_at), "MMMM d, yyyy")
                    : "—"}
                </div>
              </div>
              <p className="text-[10px] text-gray-400">
                Signed electronically. Signature, timestamp, and IP address on file.
              </p>
            </div>
          ) : (
            <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
              <p className="text-xs text-gray-400">
                Pending vendor signature
              </p>
              <p className="text-[10px] text-gray-300 mt-1">
                The vendor will be prompted to sign this document digitally upon login.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            This Purchase Order constitutes a binding agreement upon vendor signature.
            All work must be performed as described. Final payment is contingent upon
            invoice approval per the terms of this engagement.
          </p>
        </div>
      </div>
    </div>
  );
}
