"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { format } from "date-fns";
import { Printer } from "lucide-react";
import { PO_DOC_REF_HEIGHT } from "@/components/budget/po-field-placer";

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
  const searchParams = useSearchParams();
  const isPlacement = searchParams.get("placement") === "1";
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

  const poNumber = cv.po_number || `PO${campaign.wf_number}`;
  const total = Number(cv.estimate_total) || 0;

  const isSigned = !!cv.po_signed_at;
  const signatureUrl = cv.signature_url as string | null;
  const signatureName = cv.signature_name as string | null;
  const signatureTimestamp = cv.signature_timestamp as string | null;

  const authorizedBy = cv.po_authorized_by as string | null;
  const authorizedAt = cv.po_authorized_at as string | null;

  // Field positions (percentages of PO_DOC_REF_HEIGHT / doc width)
  const sigX: number = cv.signature_field_x ?? 10;
  const sigY: number = cv.signature_field_y ?? 68;

  // Convert Y percentage → pixel offset within the ref-height document
  const sigTopPx = (sigY / 100) * PO_DOC_REF_HEIGHT;

  return (
    <div
      className="bg-white"
      style={isPlacement ? { height: `${PO_DOC_REF_HEIGHT}px`, overflow: "hidden" } : { minHeight: "100vh" }}
    >
      {/* Print toolbar */}
      <div className={`print:hidden flex items-center justify-between px-8 py-3 border-b border-gray-100 bg-gray-50${isPlacement ? " hidden" : ""}`}>
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

      {/* Document wrapper — relative so field overlays can be positioned inside */}
      <div
        className="relative mx-auto"
        style={{
          maxWidth: "672px",  // matches max-w-2xl
          // Ensure the document is always at least as tall as the reference frame
          // so the signature overlay is never clipped.
          minHeight: `${PO_DOC_REF_HEIGHT}px`,
        }}
      >

        {/* ── Document content ── */}
        <div className="px-12 py-14">
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
              {/* PO number rendered in its natural spot in print; hidden on screen (badge overlay handles it) */}
              <p className="text-xs text-gray-400 print:block hidden">{poNumber}</p>
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
              {authorizedAt ? format(new Date(authorizedAt), "MMMM d, yyyy") : format(new Date(cv.updated_at), "MMMM d, yyyy")}
            </p>
          </div>

          {/* Line items */}
          <div className="mb-8">
            <div className="grid grid-cols-[1fr_60px_80px_80px] gap-4 pb-2 border-b border-gray-200 mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Description</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-right">Qty</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-right">Unit Price</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-right">Amount</p>
            </div>

            {estimateItems.length > 0 ? (
              estimateItems.map(
                (item: { description: string; quantity: number; unit_price: number; amount: number; category: string }, i: number) => (
                  <div key={i} className="grid grid-cols-[1fr_60px_80px_80px] gap-4 py-2.5 border-b border-gray-100">
                    <div>
                      <p className="text-sm text-gray-700">{item.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">{item.category}</p>
                    </div>
                    <p className="text-sm text-gray-500 text-right tabular-nums">{item.quantity}</p>
                    <p className="text-sm text-gray-500 text-right tabular-nums">{fmt(item.unit_price)}</p>
                    <p className="text-sm text-gray-900 text-right tabular-nums">{fmt(item.amount)}</p>
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
                <p className="text-sm font-semibold text-gray-900 tabular-nums">{fmt(total)}</p>
              </div>
            </div>
          </div>

          {/* Signature blocks */}
          <div className="grid grid-cols-2 gap-8 mb-10 pt-8 border-t border-gray-200">
            {/* Vendor signature */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Vendor Signature
              </p>
              {isSigned && signatureUrl ? (
                <div className="space-y-2">
                  <img src={signatureUrl} alt="Vendor signature" className="h-10 max-w-[160px]" style={{ imageRendering: "crisp-edges" }} />
                  <div className="border-t border-gray-300 pt-1.5">
                    <p className="text-xs text-gray-700">{signatureName || "—"}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {signatureTimestamp ? format(new Date(signatureTimestamp), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border-t border-gray-300 pt-2 mt-8">
                  <p className="text-[10px] text-gray-400">Signature &amp; date</p>
                </div>
              )}
            </div>

            {/* Authorized by */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Authorized By
              </p>
              <div className="border-t border-gray-300 pt-2 mt-8">
                <p className="text-xs font-semibold text-gray-900">
                  {authorizedBy || "Greenroom Production Team"}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">via Greenroom</p>
                {authorizedAt && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {format(new Date(authorizedAt), "MMM d, yyyy")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* PO Number */}
          <div className="pt-4 border-t border-gray-100 mb-12">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Purchase Order No.
            </p>
            <p className="text-sm font-mono font-semibold text-gray-900">{poNumber}</p>
          </div>

          {/* Footer */}
          <div className="pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              This Purchase Order constitutes a binding agreement upon vendor signature.
              All work must be performed as described. Final payment is contingent upon
              invoice approval per the terms of this engagement.
            </p>
          </div>

          {/* Extra bottom space so the absolute-positioned signature box
              never bleeds below the page content area */}
          <div style={{ paddingBottom: "160px" }} />
        </div>
      </div>
    </div>
  );
}
