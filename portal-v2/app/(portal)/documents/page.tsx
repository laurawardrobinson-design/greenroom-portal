"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatCurrency } from "@/lib/utils/format";
import {
  CalendarClock,
  FileSignature,
  FileText,
  Search,
  WalletCards,
  Workflow,
} from "lucide-react";

type FinancialDocumentItem = {
  id: string;
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  vendorName: string;
  status: string;
  estimateTotal: number;
  invoiceTotal: number | null;
  updatedAt: string;
  estimateFileUrl: string | null;
  estimateFileName: string | null;
  poFileUrl: string | null;
  poNumber: string | null;
  poSignedFileUrl: string | null;
  poSignedAt: string | null;
  signatureName: string | null;
  invoice: {
    id: string;
    fileUrl: string | null;
    fileName: string;
    parseStatus: string;
    producerApprovedAt: string | null;
    hopApprovedAt: string | null;
  } | null;
};

const fetcher = async (url: string): Promise<{ items: FinancialDocumentItem[] }> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load financial documents");
  return res.json();
};

const STATUS_STYLES: Record<string, string> = {
  "Estimate Submitted": "bg-blue-50 text-blue-700",
  "Estimate Revision Requested": "bg-red-50 text-red-700",
  "Estimate Approved": "bg-cyan-50 text-cyan-700",
  "PO Uploaded": "bg-violet-50 text-violet-700",
  "PO Signed": "bg-indigo-50 text-indigo-700",
  "Shoot Complete": "bg-slate-100 text-slate-700",
  "Invoice Submitted": "bg-amber-50 text-amber-700",
  "Invoice Pre-Approved": "bg-orange-50 text-orange-700",
  "Invoice Approved": "bg-emerald-50 text-emerald-700",
  Paid: "bg-emerald-100 text-emerald-800",
  Rejected: "bg-red-50 text-red-700",
};

const EMPTY_ITEMS: FinancialDocumentItem[] = [];

const PO_READY_STATUSES = new Set([
  "PO Uploaded",
  "PO Signed",
  "Shoot Complete",
  "Invoice Submitted",
  "Invoice Pre-Approved",
  "Invoice Approved",
  "Paid",
]);

export default function DocumentsPage() {
  const { user } = useCurrentUser();
  const { data, isLoading, error } = useSWR<{ items: FinancialDocumentItem[] }>(
    "/api/financial-documents",
    fetcher
  );

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const items = data?.items ?? EMPTY_ITEMS;

  const availableStatuses = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.status))).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        item.campaignName.toLowerCase().includes(query) ||
        item.vendorName.toLowerCase().includes(query) ||
        item.wfNumber.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [items, statusFilter, search]);

  const roleLabel =
    user?.role === "Vendor"
      ? "your assignments"
      : user?.role === "Producer"
        ? "campaigns you own"
        : "all campaigns";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Documents"
        actions={
          <div className="rounded-lg border border-border bg-surface-secondary px-3 py-1.5 text-xs text-text-tertiary">
            Showing {roleLabel}
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          className="relative w-full sm:max-w-md"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput);
          }}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            value={searchInput}
            onChange={(event) => {
              const value = event.target.value;
              setSearchInput(value);
              if (!value) setSearch("");
            }}
            placeholder="Search WF, campaign, or vendor…"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </form>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All statuses</option>
          {availableStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="h-44 animate-pulse bg-surface-secondary" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={<Workflow className="h-5 w-5" />}
          title="Could not load documents"
          description="Try refreshing the page. If this continues, check API connectivity."
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<WalletCards className="h-5 w-5" />}
          title={items.length === 0 ? "No financial packets yet" : "No matching results"}
          description={
            items.length === 0
              ? "Once estimates and invoices are submitted, they will appear here."
              : "Try a different search query or clear the status filter."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredItems.map((item) => {
            const canViewPo = PO_READY_STATUSES.has(item.status);
            const canViewInvoice = Boolean(item.invoice);
            const overCap =
              item.invoiceTotal !== null && item.invoiceTotal > item.estimateTotal;

            return (
              <Card key={item.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                      {item.wfNumber || "WF —"}
                    </p>
                    <h3 className="text-base font-semibold text-text-primary">
                      {item.campaignName}
                    </h3>
                    <p className="text-sm text-text-secondary">{item.vendorName}</p>
                  </div>
                  <Badge
                    variant="custom"
                    className={STATUS_STYLES[item.status] || "bg-slate-100 text-slate-700"}
                  >
                    {item.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      Estimate
                    </p>
                    <p className="text-sm font-semibold text-text-primary">
                      {formatCurrency(item.estimateTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      Invoice
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        overCap ? "text-red-700" : "text-text-primary"
                      }`}
                    >
                      {item.invoiceTotal !== null ? formatCurrency(item.invoiceTotal) : "—"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-text-secondary">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5 text-text-tertiary" />
                    Updated {new Date(item.updatedAt).toLocaleDateString("en-US")}
                  </div>
                  {item.poSignedAt && (
                    <div className="flex items-center gap-2">
                      <FileSignature className="h-3.5 w-3.5 text-text-tertiary" />
                      PO signed
                      {item.signatureName ? ` by ${item.signatureName}` : ""} on{" "}
                      {new Date(item.poSignedAt).toLocaleDateString("en-US")}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <a
                    href={`/estimates/${item.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 text-sm font-medium text-text-primary transition-colors hover:border-primary hover:text-primary"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Estimate
                  </a>

                  {canViewPo ? (
                    <a
                      href={`/po/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 text-sm font-medium text-text-primary transition-colors hover:border-primary hover:text-primary"
                    >
                      <FileSignature className="h-3.5 w-3.5" />
                      PO
                    </a>
                  ) : (
                    <span className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-tertiary">
                      <FileSignature className="h-3.5 w-3.5" />
                      PO
                    </span>
                  )}

                  {canViewInvoice ? (
                    <a
                      href={`/invoices/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-secondary px-3 text-sm font-medium text-text-primary transition-colors hover:border-primary hover:text-primary"
                    >
                      <WalletCards className="h-3.5 w-3.5" />
                      Invoice
                    </a>
                  ) : (
                    <span className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text-tertiary">
                      <WalletCards className="h-3.5 w-3.5" />
                      Invoice
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
