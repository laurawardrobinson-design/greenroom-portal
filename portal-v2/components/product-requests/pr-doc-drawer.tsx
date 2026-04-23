"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
  Package,
  Phone,
  Plus,
  Sandwich,
  Search,
  Send,
  ShoppingBasket,
  Trash2,
  User,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { PageTabs } from "@/components/ui/page-tabs";
import { PRStatusPill } from "@/components/product-requests/pr-status-pill";
import { ContactPicker } from "@/components/contacts/contact-picker";
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

const SHEET_CELL_CLASS = "border-b border-border/50 px-2 py-1.5 align-top text-sm text-text-primary";
const SHEET_INPUT_CLASS =
  "w-full rounded-sm border-0 bg-transparent px-1 py-1 text-sm text-text-primary placeholder:text-text-tertiary focus:bg-primary/5 focus:outline-none";

function SpreadsheetItemRow({
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
    <tr className="hover:bg-surface-secondary/20 transition-colors">
      <td className={`${SHEET_CELL_CLASS} w-20`}>
        {editable ? (
          <input
            type="number"
            min={1}
            defaultValue={item.quantity}
            onBlur={(e) => {
              const parsed = Math.max(1, Number(e.target.value) || 1);
              e.currentTarget.value = String(parsed);
              if (parsed !== item.quantity) onUpdate("quantity", parsed);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className={`${SHEET_INPUT_CLASS} text-center tabular-nums`}
            aria-label="Quantity"
          />
        ) : (
          <span className="tabular-nums">{item.quantity}</span>
        )}
      </td>
      <td className={`${SHEET_CELL_CLASS} w-32`}>
        {editable ? (
          <input
            type="text"
            defaultValue={item.size}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next !== item.size) onUpdate("size", next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="Size"
            className={SHEET_INPUT_CLASS}
            aria-label="Size"
          />
        ) : (
          <span>{item.size || "—"}</span>
        )}
      </td>
      <td className={`${SHEET_CELL_CLASS} w-20 tabular-nums text-text-secondary`}>
        {item.product?.itemCode ?? "—"}
      </td>
      <td className={SHEET_CELL_CLASS}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate">{item.product?.name ?? "(no product)"}</span>
          {item.fromShotList && (
            <span className="shrink-0 rounded border border-sky-100 bg-sky-50 px-1.5 py-0.5 text-sm text-sky-700">
              Shot list
            </span>
          )}
        </div>
      </td>
      <td className={SHEET_CELL_CLASS}>
        {editable ? (
          <input
            type="text"
            defaultValue={item.specialInstructions}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next !== item.specialInstructions) {
                onUpdate("specialInstructions", next);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="Notes"
            className={SHEET_INPUT_CLASS}
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
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

function AddItemMenu({
  availableProducts,
  onAdd,
  disabled,
}: {
  availableProducts: Product[];
  onAdd: (product: Product) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableProducts;
    return availableProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.itemCode ?? "").toLowerCase().includes(q)
    );
  }, [availableProducts, query]);

  const noneAvailable = availableProducts.length === 0;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => !disabled && !noneAvailable && setOpen((v) => !v)}
        disabled={disabled || noneAvailable}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-border bg-surface px-3 text-sm font-medium text-text-secondary transition-colors hover:border-primary hover:bg-primary-light hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-surface disabled:hover:text-text-secondary"
      >
        <Plus className="h-4 w-4" />
        {noneAvailable ? "All catalog items added" : "Add item"}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full rounded-md border border-border bg-surface-secondary/20 py-1.5 pl-8 pr-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm italic text-text-tertiary">
                {availableProducts.length === 0
                  ? "No catalog products available."
                  : "No products match that search."}
              </p>
            ) : (
              filtered.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={async () => {
                    setOpen(false);
                    await onAdd(product);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-secondary"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                    {product.name}
                  </span>
                  {product.itemCode && (
                    <span className="shrink-0 text-xs text-text-tertiary tabular-nums">
                      {product.itemCode}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentSpreadsheet({
  section,
  editable,
  docId,
  catalogProducts,
  onRefresh,
}: {
  section: PRDeptSection;
  editable: boolean;
  docId: string;
  catalogProducts: Product[];
  onRefresh: () => void;
}) {
  const [sheetError, setSheetError] = useState<string>("");
  const [creating, setCreating] = useState(false);

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

  const hasPickupMeta =
    section.dateNeeded || section.timeNeeded || section.pickupPerson || section.pickupPhone;

  const itemByProductId = useMemo(() => {
    const map = new Map<string, PRItem>();
    for (const item of section.items) {
      if (item.productId) map.set(item.productId, item);
    }
    return map;
  }, [section.items]);

  const catalogProductIds = useMemo(
    () => new Set(catalogProducts.map((product) => product.id)),
    [catalogProducts]
  );

  const createItem = useCallback(
    async (product: Product) => {
      if (!editable || itemByProductId.has(product.id) || creating) return;

      setCreating(true);
      try {
        const res = await fetch(`/api/product-requests/${docId}/sections/${section.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product.id,
            quantity: 1,
            size: "",
            specialInstructions: "",
          }),
        });

        if (!res.ok) {
          setSheetError("Could not add item. Please try again.");
          return;
        }

        setSheetError("");
        onRefresh();
      } finally {
        setCreating(false);
      }
    },
    [editable, itemByProductId, creating, docId, section.id, onRefresh]
  );

  const availableCatalogProducts = useMemo(
    () => catalogProducts.filter((p) => !itemByProductId.has(p.id)),
    [catalogProducts, itemByProductId]
  );

  // Items to show in the table: everything currently in the section, catalog + non-catalog,
  // sorted with catalog products first (then non-catalog / custom).
  const visibleItems = useMemo(() => {
    const catalog: PRItem[] = [];
    const nonCatalog: PRItem[] = [];
    for (const item of section.items) {
      if (item.productId && catalogProductIds.has(item.productId)) catalog.push(item);
      else nonCatalog.push(item);
    }
    return [...catalog, ...nonCatalog];
  }, [section.items, catalogProductIds]);

  return (
    <div className="space-y-2 px-3 py-3">
      <div className="rounded-md border border-border/60 bg-surface p-2.5">
        {editable ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1">
              <span className="text-sm font-medium text-text-secondary">Pickup Date</span>
              <input
                type="date"
                defaultValue={section.dateNeeded ?? ""}
                onBlur={(e) => updateSection({ dateNeeded: e.target.value })}
                className="w-full rounded-md border border-border bg-surface-secondary/20 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-text-secondary">Pickup Time</span>
              <input
                type="time"
                defaultValue={section.timeNeeded}
                onBlur={(e) => updateSection({ timeNeeded: e.target.value })}
                className="w-full rounded-md border border-border bg-surface-secondary/20 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-text-secondary">Pickup Contact</span>
              <ContactPicker
                value={section.pickupPerson}
                placeholder="Search contacts…"
                onSelect={(c) =>
                  updateSection({
                    pickupPerson: c.name,
                    pickupPhone: c.phone,
                  })
                }
                onFreeText={(name) => updateSection({ pickupPerson: name })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-text-secondary">Pickup Phone</span>
              <input
                type="tel"
                defaultValue={section.pickupPhone}
                onBlur={(e) => updateSection({ pickupPhone: e.target.value })}
                placeholder="(###) ###-####"
                className="w-full rounded-md border border-border bg-surface-secondary/20 px-2 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none"
              />
            </label>
          </div>
        ) : hasPickupMeta ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
            {(section.dateNeeded || section.timeNeeded) && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-text-tertiary" />
                <span className="font-medium text-text-primary">
                  {section.dateNeeded ? formatPickupDate(section.dateNeeded) : "Date TBD"}
                  {section.timeNeeded ? ` · ${formatTime(section.timeNeeded)}` : ""}
                </span>
              </span>
            )}
            {section.pickupPerson && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-text-tertiary" />
                <span>{section.pickupPerson}</span>
              </span>
            )}
            {section.pickupPhone && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Phone className="h-3.5 w-3.5 text-text-tertiary" />
                <span>{section.pickupPhone}</span>
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-text-tertiary">Pickup details not set.</p>
        )}
      </div>

      <div className="rounded-md border border-border/60 bg-surface overflow-hidden">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-surface-secondary/45">
              <th className="border-b border-border/60 px-2 py-1.5 text-left text-sm font-semibold text-text-secondary w-20">Qty</th>
              <th className="border-b border-border/60 px-2 py-1.5 text-left text-sm font-semibold text-text-secondary w-32">Size</th>
              <th className="border-b border-border/60 px-2 py-1.5 text-left text-sm font-semibold text-text-secondary w-20">Item #</th>
              <th className="border-b border-border/60 px-2 py-1.5 text-left text-sm font-semibold text-text-secondary">Item Name</th>
              <th className="border-b border-border/60 px-2 py-1.5 text-left text-sm font-semibold text-text-secondary">Notes</th>
              <th className="border-b border-border/60 px-2 py-1.5 text-right text-sm font-semibold text-text-secondary w-10"> </th>
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
              />
            ))}

            {visibleItems.length === 0 && (
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
          <AddItemMenu
            availableProducts={availableCatalogProducts}
            onAdd={createItem}
            disabled={creating}
          />
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
      label: `${PR_DEPARTMENT_LABELS[department]} (${section?.items.length ?? 0})`,
      icon: DEPT_ICONS[department],
    };
  });

  const ensureSection = useCallback(
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
      <header className="space-y-3 pb-4 border-b border-border/70">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-text-primary leading-tight">
                {doc.campaign?.name ?? "Product Request"}
              </h2>
              <PRStatusPill status={doc.status} />
            </div>
            <p className="text-sm text-text-secondary flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-text-tertiary" />
              <span>Shoot {formatShootDate(doc.shootDate)}</span>
              {doc.campaign?.wfNumber && (
                <>
                  <span className="text-text-tertiary">·</span>
                  <span>{doc.campaign.wfNumber}</span>
                </>
              )}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-text-tertiary hover:bg-surface-secondary hover:text-text-secondary transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Summary line */}
        {(totalItems > 0 || earliest) && (
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-sm text-text-secondary">
            <span className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-text-tertiary" />
              <span>
                <span className="font-medium text-text-primary">{totalItems}</span>{" "}
                {totalItems === 1 ? "item" : "items"}
                {activeDepts > 0 && (
                  <>
                    {" across "}
                    <span className="font-medium text-text-primary">{activeDepts}</span>{" "}
                    {activeDepts === 1 ? "department" : "departments"}
                  </>
                )}
              </span>
            </span>
            {earliest && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-text-tertiary" />
                <span>
                  Earliest pickup{" "}
                  <span className="font-medium text-text-primary">
                    {formatPickupDate(earliest.date)} · {formatTime(earliest.time)}
                  </span>
                </span>
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
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
          {doc.status === "draft" && (
            <button
              onClick={() => transition("cancelled")}
              disabled={transitioning}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:text-error hover:border-error transition-colors ml-auto"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </button>
          )}
        </div>
      </header>

      {/* Department workbook */}
      <Card padding="none" className="overflow-hidden border-border/70 bg-surface">
        <PageTabs
          tabs={deptTabs}
          activeTab={activeDept}
          onTabChange={(key) => setSelectedDept(key as PRDepartment)}
          ariaLabel="Product request departments"
        />

        {activeSection ? (
          <DepartmentSpreadsheet
            section={activeSection}
            editable={editable}
            docId={id}
            catalogProducts={activeCatalogProducts}
            onRefresh={refresh}
          />
        ) : (
          <div className="px-4 py-10 text-center text-sm text-text-tertiary">
            Loading {PR_DEPARTMENT_LABELS[activeDept]}…
          </div>
        )}
      </Card>

      {/* Notes */}
      {(doc.notes || editable) && (
        <Card padding="none" className="border-border/70 overflow-hidden">
          <div className="border-b border-border/70 px-4 py-2.5">
            <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <ClipboardList className="h-4 w-4 text-primary" />
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
