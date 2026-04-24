"use client";

import { use, useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  ExternalLink,
  Flag,
  Package,
  Plus,
  Search,
  ShoppingBasket,
  X,
} from "lucide-react";
import type { PRDepartment } from "@/types/domain";
import { PR_DEPARTMENT_LABELS } from "@/types/domain";
import type { RBUProduct } from "@/app/api/rbu/[token]/products/route";

interface Response {
  department: PRDepartment;
  products: RBUProduct[];
}

async function fetcher(url: string): Promise<Response> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export default function RBUProductsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { data, error, mutate } = useSWR(
    token ? `/api/rbu/${token}/products` : null,
    fetcher
  );

  const [query, setQuery] = useState("");
  const [flagFor, setFlagFor] = useState<RBUProduct | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.products;
    return data.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.itemCode ?? "").toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [data, query]);

  if (error) {
    return (
      <div className="px-6 py-12 text-center text-sm text-neutral-500">
        Could not load products.
      </div>
    );
  }

  const deptLabel = data ? PR_DEPARTMENT_LABELS[data.department] : "";

  return (
    <div className="max-w-[11in] w-full mx-auto px-6 py-6 space-y-5">
      <header className="bg-white border border-neutral-200 rounded-xl px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 flex items-center justify-center rounded-md bg-neutral-100 border border-neutral-200">
            <Package className="h-4 w-4 text-neutral-700" />
          </span>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
              Product Inventory
            </div>
            <div className="text-[18px] font-semibold text-neutral-900 leading-tight">
              {deptLabel}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-neutral-500 text-right hidden sm:block">
            {data ? data.products.length : "—"} products
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add product
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
        <Search className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
        <input
          type="text"
          placeholder="Search products or item #…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="text-[11px] text-neutral-400 hover:text-neutral-700"
          >
            Clear
          </button>
        )}
      </div>

      {!data ? (
        <div className="py-10 flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
          <ShoppingBasket className="h-6 w-6 text-neutral-300 mx-auto" />
          <p className="mt-2 text-[13px] text-neutral-500">
            {query
              ? "No matching products."
              : `No ${deptLabel} products yet. Add one to get started.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProductTile key={p.id} product={p} onFlag={() => setFlagFor(p)} />
          ))}
        </div>
      )}

      {flagFor && (
        <FlagModal
          token={token}
          product={flagFor}
          onClose={() => setFlagFor(null)}
          onFlagged={() => {
            setFlagFor(null);
            mutate();
          }}
        />
      )}

      {showAdd && data && (
        <AddProductModal
          token={token}
          deptLabel={deptLabel}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function ProductTile({
  product: p,
  onFlag,
}: {
  product: RBUProduct;
  onFlag: () => void;
}) {
  return (
    <div className="group relative flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:border-neutral-300 hover:shadow-sm">
      {p.openFlagCount > 0 && (
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium">
          <Flag className="h-2.5 w-2.5" />
          Flagged
        </span>
      )}
      <div className="flex items-start gap-3">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.imageUrl}
            alt={p.name}
            className="h-14 w-14 rounded-lg object-cover shrink-0 bg-neutral-100"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-neutral-100 shrink-0">
            <ShoppingBasket className="h-6 w-6 text-neutral-300" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-neutral-900 leading-snug truncate">
            {p.name}
          </p>
          {p.itemCode && (
            <p className="text-[10px] text-neutral-500 mt-0.5">
              #{p.itemCode}
            </p>
          )}
        </div>
      </div>

      {p.description && (
        <p className="mt-3 text-[12px] text-neutral-600 line-clamp-2">
          {p.description}
        </p>
      )}

      {p.restrictions && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-1">
          <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
          <span className="line-clamp-2">{p.restrictions}</span>
        </div>
      )}

      <div className="mt-auto pt-3 flex items-center justify-between gap-2 border-t border-neutral-100">
        <div className="flex items-center gap-2 text-[11px]">
          {p.rpGuideUrl && (
            <a
              href={p.rpGuideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[#004C2A] hover:underline"
            >
              R&amp;P
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          {p.pcomLink && (
            <a
              href={p.pcomLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-neutral-500 hover:underline"
            >
              Publix.com
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
        <button
          onClick={onFlag}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:border-amber-400 hover:text-amber-800 hover:bg-amber-50 transition-all"
        >
          <Flag className="h-3 w-3" />
          Flag
        </button>
      </div>
    </div>
  );
}

function FlagModal({
  token,
  product,
  onClose,
  onFlagged,
}: {
  token: string;
  product: RBUProduct;
  onClose: () => void;
  onFlagged: () => void;
}) {
  const [reason, setReason] = useState<"inaccurate" | "about_to_change">(
    "inaccurate"
  );
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      const r = await fetch(
        `/api/rbu/${token}/products/${product.id}/flag`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, comment }),
        }
      );
      if (r.ok) onFlagged();
    } finally {
      setSubmitting(false);
    }
  }, [token, product.id, reason, comment, onFlagged]);

  return (
    <Overlay onClose={onClose}>
      <header className="px-5 py-4 border-b border-neutral-200 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500 flex items-center gap-1.5">
            <Flag className="h-3 w-3" /> Flag product
          </div>
          <div className="text-[15px] font-semibold text-neutral-900 mt-0.5 truncate">
            {product.name}
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="px-5 py-4 space-y-4">
        <div>
          <div className="text-[11px] font-medium text-neutral-600 mb-1.5">
            Reason
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ReasonButton
              active={reason === "inaccurate"}
              onClick={() => setReason("inaccurate")}
              label="Inaccurate"
              hint="Info on this product is wrong"
            />
            <ReasonButton
              active={reason === "about_to_change"}
              onClick={() => setReason("about_to_change")}
              label="About to change"
              hint="Product, packaging, or availability shifting"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-neutral-600 mb-1.5">
            Comment
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What's wrong or changing?"
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none resize-none"
          />
        </div>
      </div>
      <footer className="px-5 py-3 border-t border-neutral-200 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-[12px] text-neutral-700 hover:bg-neutral-50"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit flag"}
        </button>
      </footer>
    </Overlay>
  );
}

function ReasonButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-md border px-3 py-2 transition-all ${
        active
          ? "border-amber-500 bg-amber-50"
          : "border-neutral-200 bg-white hover:border-neutral-400"
      }`}
    >
      <div className="text-[12px] font-semibold text-neutral-900">{label}</div>
      <div className="text-[11px] text-neutral-500 mt-0.5">{hint}</div>
    </button>
  );
}

function AddProductModal({
  token,
  deptLabel,
  onClose,
  onAdded,
}: {
  token: string;
  deptLabel: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [description, setDescription] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [rpGuideUrl, setRpGuideUrl] = useState("");
  const [pcomLink, setPcomLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const r = await fetch(`/api/rbu/${token}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          itemCode: itemCode.trim() || null,
          description: description.trim(),
          restrictions: restrictions.trim(),
          imageUrl: imageUrl.trim() || null,
          rpGuideUrl: rpGuideUrl.trim() || null,
          pcomLink: pcomLink.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.error || "Could not add product");
        return;
      }
      onAdded();
    } finally {
      setSubmitting(false);
    }
  }, [
    token,
    name,
    itemCode,
    description,
    restrictions,
    imageUrl,
    rpGuideUrl,
    pcomLink,
    onAdded,
  ]);

  const inputCls =
    "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none";

  return (
    <Overlay onClose={onClose}>
      <header className="px-5 py-4 border-b border-neutral-200 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
            Add product
          </div>
          <div className="text-[15px] font-semibold text-neutral-900 mt-0.5">
            New {deptLabel} product
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
        <Field label="Product name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="e.g. Sourdough Boule"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Item code">
            <input
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              className={inputCls}
              placeholder="#######"
            />
          </Field>
          <Field label="Image URL">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className={inputCls}
              placeholder="https://…"
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputCls} resize-none`}
            placeholder="Short description of the product"
          />
        </Field>
        <Field label="Restrictions">
          <textarea
            rows={2}
            value={restrictions}
            onChange={(e) => setRestrictions(e.target.value)}
            className={`${inputCls} resize-none`}
            placeholder="e.g. Keep refrigerated, allergens"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="R&P guide URL">
            <input
              value={rpGuideUrl}
              onChange={(e) => setRpGuideUrl(e.target.value)}
              className={inputCls}
              placeholder="https://…"
            />
          </Field>
          <Field label="Publix.com link">
            <input
              value={pcomLink}
              onChange={(e) => setPcomLink(e.target.value)}
              className={inputCls}
              placeholder="https://…"
            />
          </Field>
        </div>
        {err && <div className="text-[12px] text-rose-600">{err}</div>}
      </div>
      <footer className="px-5 py-3 border-t border-neutral-200 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-[12px] text-neutral-700 hover:bg-neutral-50"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add product"}
        </button>
      </footer>
    </Overlay>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-medium text-neutral-600 mb-1.5">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </div>
      {children}
    </label>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
