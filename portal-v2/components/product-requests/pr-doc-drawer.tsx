"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import {
  PackageSearch,
  Plus,
  Trash2,
  Copy,
  Check,
  Send,
  Forward,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PRStatusPill } from "@/components/product-requests/pr-status-pill";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { PRDoc, PRDeptSection, PRItem, PRDepartment, PRDocStatus } from "@/types/domain";
import { PR_DEPARTMENTS } from "@/types/domain";

const DEPT_LABELS: Record<PRDepartment, string> = {
  Bakery: "Bakery",
  Produce: "Produce",
  Deli: "Deli",
  "Meat-Seafood": "Meat & Seafood",
  Grocery: "Grocery",
};

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json() as Promise<T>;
}

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ProductSearch({
  onSelect,
  placeholder = "Search products…",
}: {
  onSelect: (product: { id: string; name: string; itemCode: string | null; department: string }) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string; itemCode: string | null; department: string }[]
  >([]);
  const [open, setOpen] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="relative">
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="text-sm"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-secondary transition-colors"
              onMouseDown={() => { onSelect(r); setQuery(""); setOpen(false); }}
            >
              <span className="text-sm text-text-primary truncate">{r.name}</span>
              {r.itemCode && (
                <span className="ml-auto text-[11px] text-text-tertiary shrink-0">{r.itemCode}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  editable,
  onUpdate,
  onDelete,
}: {
  item: PRItem;
  editable: boolean;
  onUpdate: (field: "quantity" | "size" | "specialInstructions", value: string | number) => void;
  onDelete: () => void;
}) {
  return (
    <tr className="group border-t border-border/50">
      <td className="py-2 pl-3 pr-2 text-[11px] text-text-tertiary font-medium w-[90px] shrink-0">
        {item.product?.itemCode ?? "—"}
      </td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-text-primary truncate max-w-[200px]">
            {item.product?.name ?? "(no product)"}
          </span>
          {item.fromShotList && (
            <span className="text-[10px] bg-sky-50 text-sky-600 rounded px-1 py-0.5 shrink-0">Shot list</span>
          )}
        </div>
      </td>
      <td className="py-2 px-2 w-[80px]">
        {editable ? (
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => onUpdate("quantity", Number(e.target.value))}
            className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-center focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        ) : (
          <span className="text-sm text-text-primary text-center block">{item.quantity}</span>
        )}
      </td>
      <td className="py-2 px-2 w-[100px]">
        {editable ? (
          <input
            type="text"
            value={item.size}
            onChange={(e) => onUpdate("size", e.target.value)}
            placeholder="e.g. 8-ct"
            className="w-full rounded border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        ) : (
          <span className="text-sm text-text-tertiary">{item.size || "—"}</span>
        )}
      </td>
      <td className="py-2 px-2">
        {editable ? (
          <input
            type="text"
            value={item.specialInstructions}
            onChange={(e) => onUpdate("specialInstructions", e.target.value)}
            placeholder="Instructions…"
            className="w-full rounded border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        ) : (
          <span className="text-sm text-text-tertiary">{item.specialInstructions || "—"}</span>
        )}
      </td>
      {editable && (
        <td className="py-2 pl-2 pr-3 w-8">
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-error transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      )}
    </tr>
  );
}

function DeptSection({
  section,
  editable,
  docId,
  onRefresh,
}: {
  section: PRDeptSection;
  editable: boolean;
  docId: string;
  onRefresh: () => void;
}) {
  const updateSection = useCallback(
    async (field: "dateNeeded" | "timeNeeded" | "pickupPerson", value: string) => {
      await fetch(`/api/product-requests/${docId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: section.department, [field]: value }),
      });
      onRefresh();
    },
    [docId, section.department, onRefresh]
  );

  const addProduct = useCallback(
    async (product: { id: string }) => {
      await fetch(`/api/product-requests/${docId}/sections/${section.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      onRefresh();
    },
    [docId, section.id, onRefresh]
  );

  const updateItem = useCallback(
    async (itemId: string, field: "quantity" | "size" | "specialInstructions", value: string | number) => {
      await fetch(`/api/product-requests/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      onRefresh();
    },
    [onRefresh]
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      await fetch(`/api/product-requests/items/${itemId}`, { method: "DELETE" });
      onRefresh();
    },
    [onRefresh]
  );

  const deleteSection = useCallback(async () => {
    await fetch(`/api/product-requests/${docId}/sections/${section.id}/items`, { method: "DELETE" });
    onRefresh();
  }, [docId, section.id, onRefresh]);

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader>
        <CardTitle>
          <PackageSearch />
          {DEPT_LABELS[section.department]}
        </CardTitle>
        <div className="flex items-center gap-4">
          {editable ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-text-tertiary uppercase tracking-wide">Date</span>
                <input
                  type="date"
                  defaultValue={section.dateNeeded ?? ""}
                  onBlur={(e) => updateSection("dateNeeded", e.target.value)}
                  className="rounded border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-text-tertiary uppercase tracking-wide">Time</span>
                <input
                  type="time"
                  defaultValue={section.timeNeeded}
                  onBlur={(e) => updateSection("timeNeeded", e.target.value)}
                  className="rounded border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-text-tertiary uppercase tracking-wide">Pickup</span>
                <input
                  type="text"
                  defaultValue={section.pickupPerson}
                  onBlur={(e) => updateSection("pickupPerson", e.target.value)}
                  placeholder="Name…"
                  className="rounded border border-border bg-surface px-2 py-1 text-sm w-32 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
              <button
                onClick={deleteSection}
                className="text-text-tertiary hover:text-error transition-colors ml-2"
                title="Remove department"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              {section.dateNeeded && (
                <span>{new Date(section.dateNeeded + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              )}
              {section.timeNeeded && <span>{section.timeNeeded}</span>}
              {section.pickupPerson && <span>Pickup: {section.pickupPerson}</span>}
            </div>
          )}
        </div>
      </CardHeader>

      <div className="px-3.5 py-3">
        {section.items.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] uppercase tracking-wider text-text-tertiary font-medium pb-1.5 pl-3 pr-2 w-[90px]">Item Code</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-text-tertiary font-medium pb-1.5 px-2">Product</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-text-tertiary font-medium pb-1.5 px-2 w-[80px]">Qty</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-text-tertiary font-medium pb-1.5 px-2 w-[100px]">Size</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-text-tertiary font-medium pb-1.5 px-2">Instructions</th>
                {editable && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {section.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  editable={editable}
                  onUpdate={(field, value) => updateItem(item.id, field, value)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-text-tertiary py-2">No items yet.</p>
        )}
        {editable && (
          <div className="mt-3 max-w-sm">
            <ProductSearch placeholder="+ Add product…" onSelect={addProduct} />
          </div>
        )}
      </div>
    </Card>
  );
}

// --- Content (shared between drawer and standalone page) ---
export function PRDocContent({
  id,
  onClose,
}: {
  id: string;
  onClose?: () => void;
}) {
  const { user } = useCurrentUser();
  const [copied, setCopied] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const { data: doc, mutate } = useSWR<PRDoc>(
    id ? `/api/product-requests/${id}` : null,
    fetcher
  );

  const refresh = useCallback(() => { mutate(); }, [mutate]);

  const editable = doc?.status === "draft";
  const isBMM = user?.role === "Brand Marketing Manager" || user?.role === "Admin";
  const isStudio = user?.role === "Studio";

  const addSection = useCallback(
    async (dept: PRDepartment) => {
      await fetch(`/api/product-requests/${id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: dept }),
      });
      refresh();
    },
    [id, refresh]
  );

  const transition = useCallback(
    async (to: PRDocStatus) => {
      setTransitioning(true);
      try {
        await fetch(`/api/product-requests/${id}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to }),
        });
        refresh();
        if (to === "cancelled" && onClose) onClose();
      } finally {
        setTransitioning(false);
      }
    },
    [id, refresh, onClose]
  );

  const copyEmail = useCallback(async () => {
    const res = await fetch(`/api/product-requests/${id}/email`);
    if (res.ok) {
      const { body } = await res.json();
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [id]);

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const existingDepts = new Set(doc.sections.map((s) => s.department));
  const availableDepts = PR_DEPARTMENTS.filter((d) => !existingDepts.has(d));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-tertiary">{doc.docNumber}</span>
            <PRStatusPill status={doc.status} />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">
            {doc.campaign?.name ?? "Product Request"}
          </h2>
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <span>{doc.campaign?.wfNumber}</span>
            <span>·</span>
            <span>Shoot: {formatDate(doc.shootDate)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {doc.status === "draft" && (
            <button
              onClick={() => transition("submitted")}
              disabled={transitioning}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" />
              Submit to BMM
            </button>
          )}
          {doc.status === "submitted" && isBMM && (
            <button
              onClick={() => transition("forwarded")}
              disabled={transitioning}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
            >
              <Forward className="h-4 w-4" />
              Forward to RBU
            </button>
          )}
          {doc.status === "forwarded" && (isBMM || isStudio) && (
            <button
              onClick={() => transition("fulfilled")}
              disabled={transitioning}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              Mark Fulfilled
            </button>
          )}
          {(doc.status === "submitted" || doc.status === "forwarded") && isBMM && (
            <button
              onClick={copyEmail}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy email"}
            </button>
          )}
          {doc.status === "draft" && (
            <button
              onClick={() => transition("cancelled")}
              disabled={transitioning}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:text-error hover:border-error transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Department sections */}
      <div className="space-y-4">
        {doc.sections.map((section) => (
          <DeptSection
            key={section.id}
            section={section}
            editable={editable}
            docId={id}
            onRefresh={refresh}
          />
        ))}
      </div>

      {/* Add department */}
      {editable && availableDepts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableDepts.map((dept) => (
            <button
              key={dept}
              onClick={() => addSection(dept)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {DEPT_LABELS[dept]}
            </button>
          ))}
        </div>
      )}

      {/* Notes */}
      {(doc.notes || editable) && (
        <Card padding="none">
          <CardHeader>
            <CardTitle>
              <PackageSearch />
              Notes
            </CardTitle>
          </CardHeader>
          <div className="px-3.5 py-3">
            {editable ? (
              <textarea
                defaultValue={doc.notes}
                onBlur={async (e) => {
                  await fetch(`/api/product-requests/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ notes: e.target.value }),
                  });
                  refresh();
                }}
                placeholder="Any notes for this request…"
                rows={3}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none resize-none"
              />
            ) : (
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{doc.notes}</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// --- Drawer wrapper ---
export function PRDocDrawer({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  return (
    <Drawer open={!!id} onClose={onClose} size="2xl">
      {id && <PRDocContent id={id} onClose={onClose} />}
    </Drawer>
  );
}
