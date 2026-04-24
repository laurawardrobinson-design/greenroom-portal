"use client";

import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import {
  Apple,
  Beef,
  CalendarDays,
  Check,
  CheckCircle,
  ClipboardList,
  Clock,
  Cookie,
  Copy,
  Forward,
  Plus,
  Sandwich,
  Send,
  ShoppingBasket,
  X,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { PageTabs } from "@/components/ui/page-tabs";
import { ProductDetailModal } from "@/components/campaigns/product-detail-modal";
import { useCurrentUser } from "@/hooks/use-current-user";
import type {
  PRDoc,
  PRDeptSection,
  PRItem,
  PRDepartment,
  PRDocStatus,
  CampaignProduct,
  Product,
} from "@/types/domain";
import { PR_DEPARTMENTS, PR_DEPARTMENT_LABELS } from "@/types/domain";

const DEPT_ICONS: Record<PRDepartment, LucideIcon> = {
  Bakery: Cookie,
  Produce: Apple,
  Deli: Sandwich,
  "Meat-Seafood": Beef,
  Grocery: ShoppingBasket,
};

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json() as Promise<T>;
}

function formatShootDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatPickupDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(hhmm: string) {
  if (!hhmm || !/^\d{1,2}:\d{2}/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  const period = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function earliestPickup(sections: PRDeptSection[]): { date: string; time: string } | null {
  const candidates = sections
    .filter((s) => s.dateNeeded && s.timeNeeded)
    .map((s) => ({ iso: `${s.dateNeeded}T${s.timeNeeded}`, date: s.dateNeeded!, time: s.timeNeeded }));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.iso.localeCompare(b.iso));
  return { date: candidates[0].date, time: candidates[0].time };
}

function parse24h(hhmm: string): { time: string; period: "AM" | "PM" } {
  if (!hhmm) return { time: "9:00", period: "AM" };
  const [hStr, mStr = "00"] = hhmm.split(":");
  const h = parseInt(hStr);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return { time: `${h12}:${mStr}`, period };
}

function to24h(time: string, period: "AM" | "PM"): string {
  const digits = time.replace(/\D/g, "");
  let normalized: string;
  if (digits.length === 3) normalized = `${digits[0]}:${digits.slice(1)}`;
  else if (digits.length === 4) normalized = `${digits.slice(0, 2)}:${digits.slice(2)}`;
  else normalized = `${digits}:00`;
  const [hStr, mStr = "00"] = normalized.split(":");
  let h = parseInt(hStr);
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return `${h.toString().padStart(2, "0")}:${mStr.padStart(2, "0")}`;
}

function DateChip({ value, onSave }: { value: string; onSave: (iso: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dateVal, setDateVal] = useState(value);
  const display = dateVal
    ? new Date(dateVal + "T12:00:00").toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
    : "MM/DD";
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => (inputRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.()}
        className="h-9 px-2 text-base font-bold text-text-secondary hover:text-text-primary transition-colors"
      >
        {display}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={dateVal}
        onChange={(e) => setDateVal(e.target.value)}
        onBlur={(e) => { if (e.target.value !== value) onSave(e.target.value || ""); }}
        tabIndex={-1}
        className="absolute top-0 left-0 w-full h-full opacity-0 pointer-events-none"
      />
    </div>
  );
}

function CallTimeInput({ value, onSave }: { value: string; onSave: (hhmm: string) => void }) {
  const init = parse24h(value);
  const [timeVal, setTimeVal] = useState(init.time);
  const [period, setPeriod] = useState<"AM" | "PM">(init.period);

  function formatAsTyped(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    if (digits.length === 3)
      return parseInt(digits[0]) > 1 ? `${digits[0]}:${digits.slice(1)}` : `${digits.slice(0, 2)}:${digits[2]}`;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  function save(t = timeVal, p = period) {
    const hhmm = to24h(t, p);
    if (hhmm !== value) onSave(hhmm);
  }

  return (
    <div className="flex items-baseline gap-0.5">
      <input
        type="text"
        value={timeVal}
        onChange={(e) => setTimeVal(formatAsTyped(e.target.value))}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => { if (e.key === "Enter") save(); }}
        onBlur={() => save()}
        className="w-[36px] bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none text-base font-bold text-primary text-center p-0"
      />
      <select
        value={period}
        onChange={(e) => { const p = e.target.value as "AM" | "PM"; setPeriod(p); save(timeVal, p); }}
        className="appearance-none bg-transparent text-base font-bold text-primary focus:outline-none cursor-pointer pl-0 pr-0"
      >
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  );
}

const SHEET_CELL_CLASS = "border-b border-border/50 px-2 py-1.5 align-middle text-sm text-text-primary";
const SHEET_INPUT_CLASS =
  "w-full rounded-sm border-0 bg-transparent px-1 py-1 text-sm text-text-primary placeholder:text-text-tertiary focus:bg-primary/5 focus:outline-none";

function SpreadsheetItemRow({
  item,
  editable,
  onUpdate,
  onDelete,
  onViewProduct,
}: {
  item: PRItem;
  editable: boolean;
  onUpdate: (field: "quantity" | "size" | "specialInstructions", value: string | number) => void;
  onDelete: () => void;
  onViewProduct?: () => void;
}) {
  const displayName = item.product?.name ?? item.name;

  return (
    <tr className="hover:bg-surface-secondary/20 transition-colors">
      <td className={`${SHEET_CELL_CLASS} w-12`}>
        {editable ? (
          <input
            type="number"
            min={1}
            defaultValue={item.quantity}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            onBlur={(e) => {
              const parsed = Math.max(1, Number(e.target.value) || 1);
              e.currentTarget.value = String(parsed);
              if (parsed !== item.quantity) onUpdate("quantity", parsed);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className={`${SHEET_INPUT_CLASS} text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
            aria-label="Quantity"
          />
        ) : (
          <span className="tabular-nums">{item.quantity}</span>
        )}
      </td>
      <td className={`${SHEET_CELL_CLASS} w-20`}>
        {editable ? (
          <input
            type="text"
            defaultValue={item.size}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next !== item.size) onUpdate("size", next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className={SHEET_INPUT_CLASS}
            aria-label="Size"
          />
        ) : (
          <span>{item.size || "—"}</span>
        )}
      </td>
      <td className={`${SHEET_CELL_CLASS} w-14`}>
        {item.product?.itemCode ?? "—"}
      </td>
      <td className={SHEET_CELL_CLASS}>
        {item.product && onViewProduct ? (
          <button
            type="button"
            onClick={onViewProduct}
            className="truncate text-left text-text-primary hover:underline hover:text-primary transition-colors w-full"
          >
            {item.product.name}
          </button>
        ) : (
          <span className="truncate">{displayName || "—"}</span>
        )}
      </td>
      <td className={SHEET_CELL_CLASS}>
        {editable ? (
          <textarea
            ref={(el) => {
              if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
            }}
            defaultValue={item.specialInstructions}
            rows={1}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next !== item.specialInstructions) {
                onUpdate("specialInstructions", next);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) (e.target as HTMLTextAreaElement).blur();
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }}
            className={`${SHEET_INPUT_CLASS} resize-none overflow-hidden leading-snug`}
            aria-label="Notes"
          />
        ) : (
          <span className="text-text-secondary">{item.specialInstructions || "—"}</span>
        )}
      </td>
      <td className={`${SHEET_CELL_CLASS} w-10 text-right`}>
        {editable && (
          <button
            onClick={onDelete}
            className="rounded p-1 text-text-tertiary hover:bg-surface-secondary hover:text-error transition-colors"
            aria-label="Remove item"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

function PendingItemRow({
  availableProducts,
  onCommitCatalog,
  onCommitManual,
  onCancel,
  disabled,
}: {
  availableProducts: Product[];
  onCommitCatalog: (product: Product, qty: number, size: string) => void;
  onCommitManual: (name: string, qty: number, size: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [name, setName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const sizeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!showSuggestions || !nameRef.current) { setDropdownRect(null); return; }
    const r = nameRef.current.getBoundingClientRect();
    setDropdownRect({ top: r.bottom + 2, left: r.left, width: Math.max(288, r.width) });
  }, [showSuggestions, name]);

  const filtered = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return availableProducts.slice(0, 8);
    return availableProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.itemCode ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [availableProducts, name]);

  const getQtySize = () => ({
    qty: Math.max(1, Number(qtyRef.current?.value) || 1),
    size: sizeRef.current?.value.trim() ?? "",
  });

  const handleSelectProduct = (product: Product) => {
    const { qty, size } = getQtySize();
    setShowSuggestions(false);
    onCommitCatalog(product, qty, size);
  };

  const handleCommitName = () => {
    const trimmed = name.trim();
    if (!trimmed) { onCancel(); return; }
    const { qty, size } = getQtySize();
    const exact = availableProducts.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exact) {
      onCommitCatalog(exact, qty, size);
    } else {
      onCommitManual(trimmed, qty, size);
    }
  };

  return (
    <tr className="bg-primary/[0.03] border-t border-primary/20">
      <td className={`${SHEET_CELL_CLASS} w-12`}>
        <input
          ref={qtyRef}
          type="number"
          min={1}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          onKeyDown={(e) => { if (e.key === "Enter") nameRef.current?.focus(); }}
          className={`${SHEET_INPUT_CLASS} text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
          aria-label="Quantity"
          disabled={disabled}
        />
      </td>
      <td className={`${SHEET_CELL_CLASS} w-20`}>
        <input
          ref={sizeRef}
          type="text"
          onKeyDown={(e) => { if (e.key === "Enter") nameRef.current?.focus(); }}
          className={SHEET_INPUT_CLASS}
          aria-label="Size"
          disabled={disabled}
        />
      </td>
      <td className={`${SHEET_CELL_CLASS} w-14 text-text-tertiary`}>—</td>
      <td className={SHEET_CELL_CLASS}>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { setShowSuggestions(false); handleCommitName(); }
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Type name or search catalog…"
          className={`${SHEET_INPUT_CLASS} placeholder:text-text-tertiary/60`}
          aria-label="Item name"
          disabled={disabled}
          autoComplete="off"
        />
        {showSuggestions && filtered.length > 0 && dropdownRect && createPortal(
          <div
            style={{ position: "fixed", top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, zIndex: 9999 }}
            className="overflow-hidden rounded-md border border-border bg-surface shadow-lg"
          >
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelectProduct(product); }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-secondary"
                >
                  <span className="min-w-0 flex-1 truncate text-text-primary">{product.name}</span>
                  {product.itemCode && (
                    <span className="shrink-0 text-xs text-text-tertiary">{product.itemCode}</span>
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
      </td>
      <td className={SHEET_CELL_CLASS} />
      <td className={`${SHEET_CELL_CLASS} w-10 text-right`}>
        <button
          onClick={onCancel}
          className="rounded p-1 text-text-tertiary hover:bg-surface-secondary hover:text-error transition-colors"
          aria-label="Cancel"
          disabled={disabled}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

function DepartmentSpreadsheet({
  section,
  editable,
  docId,
  catalogProducts,
  onRefresh,
  onViewProduct,
}: {
  section: PRDeptSection;
  editable: boolean;
  docId: string;
  catalogProducts: Product[];
  onRefresh: () => void;
  onViewProduct?: (productId: string) => void;
}) {
  const [sheetError, setSheetError] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [pendingRow, setPendingRow] = useState(false);

  useEffect(() => { setPendingRow(false); }, [section.id]);

  const { data: allDeptProducts } = useSWR<Product[]>(
    `/api/products?department=${section.department}`,
    fetcher
  );
  const { data: otherProducts } = useSWR<Product[]>(
    section.department !== "Other" ? `/api/products?department=Other` : null,
    fetcher
  );

  const updateSection = useCallback(
    async (
      fields: Partial<{
        dateNeeded: string;
        timeNeeded: string;
        pickupPerson: string;
        pickupPhone: string;
      }>
    ) => {
      await fetch(`/api/product-requests/${docId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: section.department, ...fields }),
      });
      onRefresh();
    },
    [docId, section.department, onRefresh]
  );

  const updateItem = useCallback(
    async (
      itemId: string,
      field: "quantity" | "size" | "specialInstructions",
      value: string | number
    ) => {
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

  const itemByProductId = useMemo(() => {
    const map = new Map<string, PRItem>();
    for (const item of section.items) {
      if (item.productId) map.set(item.productId, item);
    }
    return map;
  }, [section.items]);

  const availableCatalogProducts = useMemo(
    () => catalogProducts.filter((p) => !itemByProductId.has(p.id)),
    [catalogProducts, itemByProductId]
  );

  const allAvailableProducts = useMemo(() => {
    const combined = [...(allDeptProducts ?? []), ...(otherProducts ?? [])];
    const seen = new Set<string>();
    return combined.filter((p) => {
      if (seen.has(p.id) || itemByProductId.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [allDeptProducts, otherProducts, itemByProductId]);

  const nextSortOrder = useCallback(
    () => section.items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1,
    [section.items]
  );

  const commitCatalogItem = useCallback(
    async (product: Product, qty: number, size: string) => {
      if (!editable || itemByProductId.has(product.id) || creating) return;
      setCreating(true);
      try {
        const res = await fetch(`/api/product-requests/${docId}/sections/${section.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id, quantity: qty, size, sortOrder: nextSortOrder() }),
        });
        if (!res.ok) { setSheetError("Could not add item. Please try again."); return; }
        setSheetError("");
        setPendingRow(false);
        onRefresh();
      } finally {
        setCreating(false);
      }
    },
    [editable, itemByProductId, creating, docId, section.id, nextSortOrder, onRefresh]
  );

  const commitManualItem = useCallback(
    async (name: string, qty: number, size: string) => {
      if (!editable || creating) return;
      setCreating(true);
      try {
        const res = await fetch(`/api/product-requests/${docId}/sections/${section.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: null, name, quantity: qty, size, sortOrder: nextSortOrder() }),
        });
        if (!res.ok) { setSheetError("Could not add item. Please try again."); return; }
        setSheetError("");
        setPendingRow(false);
        onRefresh();
      } finally {
        setCreating(false);
      }
    },
    [editable, creating, docId, section.id, nextSortOrder, onRefresh]
  );

  const visibleItems = section.items;

  return (
    <div className="space-y-2 px-3 py-3">

      <div className="rounded-md border border-border/60 bg-surface overflow-hidden">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-surface-secondary/45">
              <th className="border-b border-border/60 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-secondary w-12 whitespace-nowrap">Qty</th>
              <th className="border-b border-border/60 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-secondary w-20 whitespace-nowrap">Size</th>
              <th className="border-b border-border/60 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-secondary w-16 whitespace-nowrap">Item #</th>
              <th className="border-b border-border/60 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Item Name</th>
              <th className="border-b border-border/60 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Notes</th>
              <th className="border-b border-border/60 px-2 py-1.5 text-right text-xs font-semibold text-text-secondary w-10"> </th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <SpreadsheetItemRow
                key={`${item.id}:${item.quantity}:${item.size}:${item.specialInstructions}`}
                item={item}
                editable={editable}
                onUpdate={(field, value) => updateItem(item.id, field, value)}
                onDelete={() => deleteItem(item.id)}
                onViewProduct={item.product ? () => onViewProduct?.(item.product!.id) : undefined}
              />
            ))}

            {pendingRow && editable && (
              <PendingItemRow
                availableProducts={allAvailableProducts}
                onCommitCatalog={commitCatalogItem}
                onCommitManual={commitManualItem}
                onCancel={() => setPendingRow(false)}
                disabled={creating}
              />
            )}

            {visibleItems.length === 0 && !pendingRow && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm italic text-text-tertiary"
                >
                  {editable
                    ? "No items yet. Use Add item to start this department."
                    : "No products in this department."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editable && (
        <div className="flex items-center gap-2 pt-1">
          {!pendingRow && (
            <button
              type="button"
              onClick={() => setPendingRow(true)}
              disabled={creating}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-border bg-surface px-3 text-sm font-medium text-text-secondary transition-colors hover:border-primary hover:bg-primary-light hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add item
            </button>
          )}
          {creating && (
            <span className="inline-flex items-center gap-1.5 text-sm text-text-tertiary">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-primary border-t-transparent" />
              Adding…
            </span>
          )}
        </div>
      )}

      {sheetError && <p className="text-sm text-error">{sheetError}</p>}
    </div>
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
  const [selectedDept, setSelectedDept] = useState<PRDepartment | null>(null);
  const [viewingProductId, setViewingProductId] = useState<string | null>(null);

  const { data: doc, mutate } = useSWR<PRDoc>(
    id ? `/api/product-requests/${id}` : null,
    fetcher
  );
  const { data: campaignProducts } = useSWR<CampaignProduct[]>(
    doc?.campaignId ? `/api/campaigns/${doc.campaignId}/products` : null,
    fetcher
  );

  const refresh = useCallback(() => { mutate(); }, [mutate]);

  const isProducerEditor =
    user?.role === "Producer" ||
    user?.role === "Post Producer" ||
    user?.role === "Admin";
  const editable =
    !!doc &&
    isProducerEditor &&
    doc.status !== "fulfilled" &&
    doc.status !== "cancelled";
  const isBMM = user?.role === "Brand Marketing Manager" || user?.role === "Admin";
  const isStudio = user?.role === "Studio";

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

  const activeDept =
    selectedDept && PR_DEPARTMENTS.includes(selectedDept)
      ? selectedDept
      : PR_DEPARTMENTS[0];
  const orderedSections = [...(doc?.sections ?? [])].sort(
    (a, b) =>
      PR_DEPARTMENTS.indexOf(a.department) - PR_DEPARTMENTS.indexOf(b.department)
  );
  const sectionByDept = new Map(
    orderedSections.map((section) => [section.department, section] as const)
  );
  const activeSection = sectionByDept.get(activeDept) ?? null;

  const updateHeaderSection = useCallback(
    async (changes: { timeNeeded?: string; dateNeeded?: string }) => {
      // Date is shared across department workbooks, so prefill every department.
      const departments =
        changes.dateNeeded !== undefined ? PR_DEPARTMENTS : [activeDept];

      await Promise.all(
        departments.map(async (department) => {
          await fetch(`/api/product-requests/${id}/sections`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ department, ...changes }),
          });
        })
      );
      refresh();
    },
    [id, activeDept, refresh]
  );

  const activeCatalogProducts = useMemo(
    () =>
      (campaignProducts ?? [])
        .map((cp) => cp.product)
        .filter(
          (product): product is Product =>
            Boolean(product) && product.department === activeDept
        ),
    [campaignProducts, activeDept]
  );
  const deptTabs = PR_DEPARTMENTS.map((department) => {
    const section = sectionByDept.get(department);
    return {
      key: department,
      label: PR_DEPARTMENT_LABELS[department],
      icon: DEPT_ICONS[department],
      count: section?.items.length ?? 0,
    };
  });

  const ensureSection = useCallback(
    async (dept: PRDepartment) => {
      const inheritedDate =
        doc?.sections.find((section) => !!section.dateNeeded)?.dateNeeded ??
        doc?.shootDate ??
        "";
      await fetch(`/api/product-requests/${id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: dept, dateNeeded: inheritedDate }),
      });
      refresh();
    },
    [id, doc, refresh]
  );

  useEffect(() => {
    if (!doc) return;
    if (!editable) return;
    if (activeSection) return;
    void ensureSection(activeDept);
  }, [doc, editable, activeDept, activeSection, ensureSection]);

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const totalItems = doc.sections.reduce((n, s) => n + s.items.length, 0);
  const activeDepts = doc.sections.filter((s) => s.items.length > 0).length;
  const earliest = earliestPickup(doc.sections);

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="pb-4 border-b border-border/70">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            {doc.campaign?.wfNumber && (
              <p className="text-xs font-medium text-text-tertiary tracking-wide">{doc.campaign.wfNumber}</p>
            )}
            <h2 className="text-xl font-semibold text-text-primary leading-tight">
              {doc.campaign?.name ?? "Product Request"}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editable && (
              <div className="flex items-baseline gap-0.5">
                <DateChip
                  key={`date-${activeSection?.id}`}
                  value={activeSection?.dateNeeded || doc.shootDate || ""}
                  onSave={(v) => updateHeaderSection({ dateNeeded: v })}
                />
                <CallTimeInput
                  key={`time-${activeSection?.id}`}
                  value={activeSection?.timeNeeded ?? ""}
                  onSave={(hhmm) => updateHeaderSection({ timeNeeded: hhmm })}
                />
              </div>
            )}
            {doc.status === "draft" && (
              <button
                onClick={() => transition("submitted")}
                disabled={transitioning}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Send className="h-4 w-4" />
                Submit
              </button>
            )}
            {doc.status === "submitted" && isBMM && (
              <button
                onClick={() => transition("forwarded")}
                disabled={transitioning}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
              >
                <Forward className="h-4 w-4" />
                Mark Sent
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
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Department workbook */}
      <Card padding="none" className="overflow-hidden border-border/70 bg-surface flex flex-col h-[420px]">
        <PageTabs
          tabs={deptTabs}
          activeTab={activeDept}
          onTabChange={(key) => setSelectedDept(key as PRDepartment)}
          ariaLabel="Product request departments"
        />

        <div className="flex-1 overflow-y-auto">
          {activeSection ? (
            <DepartmentSpreadsheet
              section={activeSection}
              editable={editable}
              docId={id}
              catalogProducts={activeCatalogProducts}
              onRefresh={refresh}
              onViewProduct={setViewingProductId}
            />
          ) : (
            <div className="px-4 py-10 text-center text-sm text-text-tertiary">
              Loading {PR_DEPARTMENT_LABELS[activeDept]}…
            </div>
          )}
        </div>
      </Card>

      {/* Notes */}
      {(doc.notes || editable) && (
        <Card padding="none" className="border-border/70 overflow-hidden">
          <div className="border-b border-border px-3.5 py-2.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-primary">
              <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
              Notes
            </h3>
          </div>
          <div className="px-4 py-3">
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
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none resize-none"
              />
            ) : (
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{doc.notes}</p>
            )}
          </div>
        </Card>
      )}

      {viewingProductId && (
        <ProductDetailModal
          productId={viewingProductId}
          open={!!viewingProductId}
          onClose={() => setViewingProductId(null)}
        />
      )}
    </div>
  );
}

// --- Modal wrapper ---
export function PRDocDrawer({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  return (
    <Modal open={!!id} onClose={onClose} size="3xl">
      {id && <PRDocContent id={id} onClose={onClose} />}
    </Modal>
  );
}
