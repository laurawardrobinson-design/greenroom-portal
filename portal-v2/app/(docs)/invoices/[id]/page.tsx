"use client";

import { use } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { Printer } from "lucide-react";

async function fetcher(url: string) {
  // Retry a few times — Turbopack compiles routes on first request which can cause a brief 404
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

export default function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error } = useSWR(`/api/invoices/view/${id}`, fetcher);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Could not load invoice.
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

  const { cv, estimateItems, invoice, invoiceItems } = data;
  const vendor = cv.vendors;
  const campaign = cv.campaigns;

  // Prefer invoice items if parsed; fall back to estimate items
  const hasInvoiceItems = invoiceItems && invoiceItems.length > 0;
  const hasEstimateItems = estimateItems && estimateItems.length > 0;

  // Check if estimate was submitted as a PDF attachment (single line "Per attached: ...")
  const isPdfEstimate =
    hasEstimateItems &&
    estimateItems.length === 1 &&
    estimateItems[0].description?.startsWith("Per attached:");

  const lineItems: { description: string; amount: number }[] = hasInvoiceItems
    ? invoiceItems.map((i: { description: string; amount: number }) => ({
        description: i.description,
        amount: Number(i.amount),
      }))
    : !isPdfEstimate && hasEstimateItems
    ? estimateItems.map((i: { description: string; amount: number }) => ({
        description: i.description,
        amount: Number(i.amount),
      }))
    : [];

  const total = invoice
    ? Number(cv.invoice_total) || 0
    : Number(cv.estimate_total) || 0;

  const invoiceDate = invoice
    ? invoice.submitted_at || invoice.created_at
    : cv.updated_at;

  const invoiceNumber = `${campaign.wf_number}-${cv.id.slice(0, 6).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-white">
      {/* Print toolbar — hidden when printing */}
      <div className="print:hidden flex items-center justify-between px-8 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-xs text-gray-400 font-medium tracking-wide uppercase">
          Invoice Preview
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
              Invoice
            </h1>
            <p className="text-xs text-gray-400">{invoiceNumber}</p>
          </div>
        </div>

        {/* Bill info grid */}
        <div className="grid grid-cols-2 gap-8 mb-10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              From
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
            <p className="text-xs text-gray-400 mt-0.5">{campaign?.wf_number}</p>
          </div>
        </div>

        {/* Date */}
        <div className="mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
            Date
          </p>
          <p className="text-sm text-gray-700">
            {invoiceDate
              ? format(new Date(invoiceDate), "MMMM d, yyyy")
              : "—"}
          </p>
        </div>

        {/* Line items */}
        <div className="mb-8">
          <div className="grid grid-cols-[1fr_auto] gap-4 pb-2 border-b border-gray-200 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Description
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-right">
              Amount
            </p>
          </div>

          {lineItems.length > 0 ? (
            lineItems.map(
              (item: { description: string; amount: number }, i: number) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto] gap-4 py-2.5 border-b border-gray-100"
                >
                  <p className="text-sm text-gray-700">{item.description}</p>
                  <p className="text-sm text-gray-900 text-right">
                    {fmt(item.amount)}
                  </p>
                </div>
              )
            )
          ) : (
            <div className="py-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 italic">
                {isPdfEstimate
                  ? `Per attached: ${estimateItems[0].description.replace("Per attached:", "").trim()}`
                  : "Services as described"}
              </p>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="flex justify-end">
          <div className="w-56">
            <div className="flex justify-between items-center pt-3 border-t-2 border-gray-900">
              <p className="text-sm font-semibold text-gray-900">Total</p>
              <p className="text-sm font-semibold text-gray-900">
                {fmt(total)}
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        {cv.notes && (
          <div className="mt-10 pt-6 border-t border-gray-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Notes
            </p>
            <p className="text-sm text-gray-600">{cv.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
