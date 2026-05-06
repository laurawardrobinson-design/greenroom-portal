"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Pencil, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ProductImage } from "@/components/products/product-image";
import type { Product } from "@/types/domain";
import type {
  ProposableField,
  ProposedChanges,
} from "@/lib/services/product-flags.service";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to load product");
    return r.json();
  });

type FieldDef = {
  key: ProposableField;
  label: string;
  type: "text" | "textarea" | "url";
  placeholder?: string;
};

const FIELDS: FieldDef[] = [
  { key: "name", label: "Name", type: "text" },
  { key: "itemCode", label: "Item code", type: "text", placeholder: "e.g. 115437" },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    placeholder: "What this product is.",
  },
  {
    key: "restrictions",
    label: "Restrictions",
    type: "textarea",
    placeholder: "Seasonal, regional, allergen, etc.",
  },
  {
    key: "shootingNotes",
    label: "Shooting notes",
    type: "textarea",
    placeholder: "Anything the photo team should know.",
  },
  { key: "pcomLink", label: "Pcom link", type: "url", placeholder: "https://…" },
  { key: "rpGuideUrl", label: "RP guide URL", type: "url", placeholder: "https://…" },
];

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function ProposeEditModal({
  productId,
  productName,
  rbuToken = null,
  onClose,
  onCreated,
}: {
  productId: string;
  productName: string;
  rbuToken?: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const productUrl = rbuToken
    ? `/api/rbu/${rbuToken}/products/${productId}`
    : `/api/products/${productId}`;
  const { data: product, isLoading } = useSWR<Product>(productUrl, fetcher);

  const [values, setValues] = useState<Record<ProposableField, string>>({
    name: "",
    description: "",
    shootingNotes: "",
    restrictions: "",
    itemCode: "",
    pcomLink: "",
    rpGuideUrl: "",
    imageUrl: "",
  });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!product) return;
    setValues({
      name: normalize(product.name),
      description: normalize(product.description),
      shootingNotes: normalize(product.shootingNotes),
      restrictions: normalize(product.restrictions),
      itemCode: normalize(product.itemCode),
      pcomLink: normalize(product.pcomLink),
      rpGuideUrl: normalize(product.rpGuideUrl),
      imageUrl: normalize(product.imageUrl),
    });
  }, [product]);

  function setField(key: ProposableField, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function resetField(key: ProposableField) {
    if (!product) return;
    const original = normalize(
      (product as unknown as Record<string, unknown>)[key]
    );
    setField(key, original);
  }

  function buildDiff(): ProposedChanges {
    if (!product) return {};
    const diff: ProposedChanges = {};
    for (const def of FIELDS) {
      const original = normalize(
        (product as unknown as Record<string, unknown>)[def.key]
      );
      const current = values[def.key];
      if (original !== current) {
        diff[def.key] = {
          from: original === "" ? null : original,
          to: current === "" ? null : current,
        };
      }
    }
    return diff;
  }

  const diff = product ? buildDiff() : {};
  const changedCount = Object.keys(diff).length;

  async function submit() {
    if (changedCount === 0) {
      toast("error", "Change at least one field, or use Flag for a comment.");
      return;
    }
    if (!product) return;
    setSubmitting(true);
    try {
      const url = rbuToken
        ? `/api/rbu/${rbuToken}/products/${productId}/flag`
        : "/api/product-flags/internal";
      const body: Record<string, unknown> = {
        kind: "edit",
        proposedChanges: diff,
        reason: "inaccurate",
        comment: comment.trim(),
      };
      if (!rbuToken) {
        body.productId = productId;
        body.dept = product.department;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed");
      }
      toast(
        "success",
        `Sent ${changedCount} proposed change${changedCount === 1 ? "" : "s"} for review`
      );
      onCreated();
      onClose();
    } catch {
      toast("error", "Couldn't send proposal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      size="xl"
      title={`Suggest edits — ${productName}`}
    >
      {isLoading || !product ? (
        <div className="h-40 rounded-xl bg-surface-secondary animate-pulse" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-secondary p-3">
            <ProductImage
              src={product.imageUrl}
              alt={product.name}
              className="h-12 w-12 rounded-md object-cover shrink-0 bg-surface-tertiary"
              fallbackClassName="flex h-12 w-12 items-center justify-center rounded-md bg-surface-tertiary shrink-0"
              iconClassName="h-4 w-4 text-text-tertiary"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">
                {product.name}
              </p>
              <p className="text-[11px] text-text-tertiary">
                Producers will see exactly what you change here, side-by-side
                with the current values, and can accept or decline.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {FIELDS.map((def) => {
              const original = normalize(
                (product as unknown as Record<string, unknown>)[def.key]
              );
              const current = values[def.key];
              const changed = original !== current;
              return (
                <div key={def.key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      {def.label}
                      {changed && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-primary normal-case tracking-normal text-[10px] font-medium">
                          <Pencil className="h-2.5 w-2.5" /> changed
                        </span>
                      )}
                    </p>
                    {changed && (
                      <button
                        type="button"
                        onClick={() => resetField(def.key)}
                        className="inline-flex items-center gap-0.5 text-[10px] text-text-tertiary hover:text-text-primary"
                      >
                        <RotateCcw className="h-2.5 w-2.5" /> Reset
                      </button>
                    )}
                  </div>
                  {def.type === "textarea" ? (
                    <textarea
                      value={current}
                      onChange={(e) => setField(def.key, e.target.value)}
                      rows={2}
                      placeholder={def.placeholder}
                      className={`w-full rounded-md border bg-surface px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary resize-none ${
                        changed ? "border-primary/60" : "border-border"
                      }`}
                    />
                  ) : (
                    <input
                      type={def.type === "url" ? "url" : "text"}
                      value={current}
                      onChange={(e) => setField(def.key, e.target.value)}
                      placeholder={def.placeholder}
                      className={`w-full h-9 rounded-md border bg-surface px-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary ${
                        changed ? "border-primary/60" : "border-border"
                      }`}
                    />
                  )}
                  {changed && (
                    <p className="mt-0.5 text-[10px] text-text-tertiary truncate">
                      Was: <span className="text-text-secondary">{original || "—"}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
              Note for the Producer (optional)
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Any context that explains the changes."
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-[11px] text-text-tertiary">
              {changedCount === 0
                ? "No changes yet."
                : `${changedCount} change${changedCount === 1 ? "" : "s"} ready to send.`}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submit}
                loading={submitting}
                disabled={changedCount === 0}
              >
                <Pencil className="h-3.5 w-3.5" />
                Send for review
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
