"use client";

import { useState, useCallback } from "react";
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
  Mail,
  Package,
  Phone,
  Plus,
  Sandwich,
  Send,
  ShoppingBasket,
  Trash2,
  User,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PRStatusPill } from "@/components/product-requests/pr-status-pill";
import { ContactPicker } from "@/components/contacts/contact-picker";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { PRDoc, PRDeptSection, PRItem, PRDepartment, PRDocStatus } from "@/types/domain";
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
                <span className="ml-auto text-[11px] text-text-tertiary shrink-0">#{r.itemCode}</span>
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
  const inputCls =
    "rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none";

  if (!editable) {
    return (
      <div className="border-t border-border/50 px-3.5 py-3">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium text-text-primary leading-snug">
                {item.product?.name ?? "(no product)"}
              </span>
              {item.product?.itemCode && (
                <span className="text-[11px] text-text-tertiary tabular-nums">
                  #{item.product.itemCode}
                </span>
              )}
              {item.fromShotList && (
                <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-100 rounded px-1.5 py-0.5 leading-none">
                  Shot list
                </span>
              )}
            </div>
            {item.specialInstructions && (
              <p className="mt-1 text-[12px] text-text-secondary italic leading-snug">
                {item.specialInstructions}
              </p>
            )}
          </div>
          <span className="shrink-0 text-sm text-text-primary tabular-nums whitespace-nowrap pt-0.5">
            {item.quantity}
            {item.size ? <span className="text-text-secondary"> × {item.size}</span> : null}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="group border-t border-border/50 px-3.5 py-3 space-y-2">
      {/* Line 1: product header */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-medium text-text-primary leading-snug">
          {item.product?.name ?? "(no product)"}
        </span>
        {item.product?.itemCode && (
          <span className="text-[11px] text-text-tertiary tabular-nums">
            #{item.product.itemCode}
          </span>
        )}
        {item.fromShotList && (
          <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-100 rounded px-1.5 py-0.5 leading-none">
            Shot list
          </span>
        )}
        <button
          onClick={onDelete}
          className="ml-auto opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-error transition-all"
          aria-label="Remove item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Line 2: qty × size + instructions */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) => onUpdate("quantity", Number(e.target.value))}
          className={`${inputCls} w-16 text-center tabular-nums shrink-0`}
          aria-label="Quantity"
        />
        <span className="text-text-tertiary text-sm shrink-0">×</span>
        <input
          type="text"
          value={item.size}
          onChange={(e) => onUpdate("size", e.target.value)}
          placeholder="Size"
          className={`${inputCls} w-28 shrink-0`}
          aria-label="Size"
        />
        <input
          type="text"
          value={item.specialInstructions}
          onChange={(e) => onUpdate("specialInstructions", e.target.value)}
          placeholder="Special instructions (optional)"
          className={`${inputCls} flex-1 min-w-[180px]`}
          aria-label="Special instructions"
        />
      </div>
    </div>
  );
}

function DeptSection({
  section,
  editable,
  docId,
  doc,
  isBMM,
  onRefresh,
}: {
  section: PRDeptSection;
  editable: boolean;
  docId: string;
  doc: PRDoc;
  isBMM: boolean;
  onRefresh: () => void;
}) {
  const DeptIcon = DEPT_ICONS[section.department];

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

  const canSendEmail =
    isBMM &&
    (doc.status === "submitted" || doc.status === "forwarded") &&
    section.items.length > 0 &&
    section.publicToken;

  const openDeptEmailDraft = useCallback(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/pr/view/${section.publicToken}`;
    const deptLabel = PR_DEPARTMENT_LABELS[section.department];
    const shootDateLabel = new Date(
      doc.shootDate + "T12:00:00"
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const campaignLabel = [doc.campaign?.wfNumber, doc.campaign?.name]
      .filter(Boolean)
      .join(" — ");
    const subject = `Product Request — ${campaignLabel} — ${deptLabel} — ${shootDateLabel}`;
    const bodyLines = [
      `Hi ${deptLabel} team,`,
      "",
      `Please see the attached product request for ${campaignLabel} on ${shootDateLabel}.`,
      "",
      `View the full request (pickup time, contact, and all items) here:`,
      link,
      "",
      `Thank you,`,
    ];
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\r\n"))}`;
    window.location.href = mailto;
  }, [section.publicToken, section.department, doc.shootDate, doc.campaign]);

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

  const itemCount = section.items.length;

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader>
        <CardTitle>
          <DeptIcon />
          <span>{PR_DEPARTMENT_LABELS[section.department]}</span>
          <span className="text-[11px] font-medium text-text-tertiary normal-case tracking-normal ml-0.5">
            · {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
        </CardTitle>
        {editable && (
          <button
            onClick={deleteSection}
            className="text-text-tertiary hover:text-error transition-colors"
            title="Remove department"
            aria-label="Remove department"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </CardHeader>

      {/* Pickup meta band */}
      <div className="px-3.5 py-2 border-b border-border/70 bg-surface-secondary/40">
        {editable ? (
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap text-[12px]">
            <label className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-text-tertiary" />
              <span className="text-text-tertiary">Pickup date</span>
              <input
                type="date"
                defaultValue={section.dateNeeded ?? ""}
                onBlur={(e) => updateSection({ dateNeeded: e.target.value })}
                className="rounded border border-border bg-surface px-2 py-1 text-[13px] focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-text-tertiary" />
              <span className="text-text-tertiary">Time</span>
              <input
                type="time"
                defaultValue={section.timeNeeded}
                onBlur={(e) => updateSection({ timeNeeded: e.target.value })}
                className="rounded border border-border bg-surface px-2 py-1 text-[13px] focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-text-tertiary" />
              <span className="text-text-tertiary">Pickup by</span>
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
            <label className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-text-tertiary" />
              <span className="text-text-tertiary">Cell</span>
              <input
                type="tel"
                defaultValue={section.pickupPhone}
                onBlur={(e) => updateSection({ pickupPhone: e.target.value })}
                placeholder="(###) ###-####"
                className="rounded border border-border bg-surface px-2 py-1 text-[13px] w-36 focus:border-primary focus:outline-none"
              />
            </label>
          </div>
        ) : (section.dateNeeded ||
            section.timeNeeded ||
            section.pickupPerson ||
            section.pickupPhone) ? (
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[12px] text-text-secondary">
            {(section.dateNeeded || section.timeNeeded) && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-text-tertiary" />
                <span className="text-text-tertiary">Pickup</span>
                <span className="text-text-primary font-medium">
                  {section.dateNeeded && formatPickupDate(section.dateNeeded)}
                  {section.dateNeeded && section.timeNeeded && " · "}
                  {section.timeNeeded && formatTime(section.timeNeeded)}
                </span>
              </span>
            )}
            {section.pickupPerson && (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-text-tertiary" />
                <span className="text-text-primary">{section.pickupPerson}</span>
              </span>
            )}
            {section.pickupPhone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-text-tertiary" />
                <span className="text-text-primary tabular-nums">
                  {section.pickupPhone}
                </span>
              </span>
            )}
            {canSendEmail && (
              <button
                onClick={openDeptEmailDraft}
                className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] text-text-secondary hover:border-primary hover:text-primary transition-colors"
                title="Open an Outlook draft with a tamper-proof link to this department's section"
              >
                <Mail className="h-3.5 w-3.5" />
                Email {PR_DEPARTMENT_LABELS[section.department]}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-x-4 flex-wrap text-[12px] text-text-tertiary">
            <p className="italic">Pickup time not set</p>
            {canSendEmail && (
              <button
                onClick={openDeptEmailDraft}
                className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] text-text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                Email {PR_DEPARTMENT_LABELS[section.department]}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Items */}
      <div>
        {section.items.length > 0 ? (
          <div>
            {section.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                editable={editable}
                onUpdate={(field, value) => updateItem(item.id, field, value)}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary px-3.5 py-3">No items yet.</p>
        )}
        {editable && (
          <div className="px-3.5 py-3 border-t border-border/50 max-w-sm">
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
  const totalItems = doc.sections.reduce((n, s) => n + s.items.length, 0);
  const activeDepts = doc.sections.filter((s) => s.items.length > 0).length;
  const earliest = earliestPickup(doc.sections);

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="space-y-4 pb-5 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                Product Request · {doc.docNumber}
              </span>
              <PRStatusPill status={doc.status} />
            </div>
            <h2 className="text-xl font-semibold text-text-primary leading-tight">
              {doc.campaign?.name ?? "Product Request"}
            </h2>
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
          <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-[13px] text-text-secondary">
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
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:text-error hover:border-error transition-colors ml-auto"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </button>
          )}
        </div>
      </header>

      {/* Department sections */}
      {doc.sections.length > 0 ? (
        <div className="space-y-4">
          {doc.sections.map((section) => (
            <DeptSection
              key={section.id}
              section={section}
              editable={editable}
              docId={id}
              doc={doc}
              isBMM={isBMM}
              onRefresh={refresh}
            />
          ))}
        </div>
      ) : (
        !editable && (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm text-text-tertiary">No departments have been added to this request.</p>
          </div>
        )
      )}

      {/* Add department */}
      {editable && availableDepts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
            Add a department
          </p>
          <div className="flex flex-wrap gap-2">
            {availableDepts.map((dept) => {
              const Icon = DEPT_ICONS[dept];
              return (
                <button
                  key={dept}
                  onClick={() => addSection(dept)}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-secondary hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <Icon className="h-3.5 w-3.5" />
                  {PR_DEPARTMENT_LABELS[dept]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {(doc.notes || editable) && (
        <Card padding="none">
          <CardHeader>
            <CardTitle>
              <ClipboardList />
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
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none resize-none"
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
