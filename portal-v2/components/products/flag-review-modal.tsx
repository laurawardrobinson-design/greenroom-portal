"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Apple,
  Beef,
  Check,
  Cookie,
  Edit2,
  ExternalLink,
  RotateCcw,
  Sandwich,
  ShoppingBasket,
  X,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type {
  ProductFlag,
  ProductFlagComment,
} from "@/lib/services/product-flags.service";
import type { PRDepartment, Product } from "@/types/domain";
import { DEPT_COLORS } from "@/components/products/product-drawer";
import { UserAvatar } from "@/components/ui/user-avatar";

const DEPT_ICONS: Record<PRDepartment, LucideIcon> = {
  Bakery: Cookie,
  Produce: Apple,
  Deli: Sandwich,
  "Meat-Seafood": Beef,
  Grocery: ShoppingBasket,
};

function reasonLabel(reason: ProductFlag["reason"]) {
  return reason === "inaccurate" ? "Inaccurate" : "About to change";
}

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(1, Math.round((now - then) / 60000));
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Request failed");
    return r.json();
  });

export function FlagReviewModal({
  flag,
  canResolve,
  canReopen,
  canEdit,
  onClose,
  onChanged,
}: {
  flag: ProductFlag;
  canResolve: boolean;
  canReopen: boolean;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const DeptIcon = DEPT_ICONS[flag.flaggedByDept];

  // Live product data for inline edit
  const { data: productData, mutate: mutateProduct } = useSWR<Product>(
    flag.product ? `/api/products/${flag.product.id}` : null,
    fetcher
  );
  const product = productData ?? null;

  // Comments thread
  const { data: commentsData, mutate: mutateComments } = useSWR<
    ProductFlagComment[]
  >(`/api/product-flags/${flag.id}/comments`, fetcher, {
    refreshInterval: 20000,
  });
  const comments = commentsData ?? [];
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  async function postComment() {
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/product-flags/${flag.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment }),
      });
      if (!res.ok) throw new Error();
      setNewComment("");
      mutateComments();
    } catch {
      toast("error", "Couldn't post comment");
    } finally {
      setPostingComment(false);
    }
  }

  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [shootingNotes, setShootingNotes] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    if (!product) return;
    setName(product.name ?? "");
    setDescription(product.description ?? "");
    setRestrictions(product.restrictions ?? "");
    setShootingNotes(product.shootingNotes ?? "");
  }, [product]);

  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);
  const [reopening, setReopening] = useState(false);

  async function saveProduct() {
    if (!product) return;
    if (!name.trim()) {
      toast("error", "Product name can't be empty");
      return;
    }
    setSavingProduct(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          restrictions,
          shootingNotes,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast("success", "Product updated");
      setEditMode(false);
      mutateProduct();
      onChanged();
    } catch {
      toast("error", "Couldn't save changes");
    } finally {
      setSavingProduct(false);
    }
  }

  async function clearFlag() {
    setResolving(true);
    try {
      const res = await fetch(`/api/product-flags/${flag.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: resolveNote }),
      });
      if (!res.ok) throw new Error();
      toast("success", "Flag cleared");
      onChanged();
      onClose();
    } catch {
      toast("error", "Couldn't clear flag");
    } finally {
      setResolving(false);
    }
  }

  async function reopenFlag() {
    setReopening(true);
    try {
      const res = await fetch(`/api/product-flags/${flag.id}/reopen`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast("success", "Flag reopened");
      onChanged();
      onClose();
    } catch {
      toast("error", "Couldn't reopen flag");
    } finally {
      setReopening(false);
    }
  }

  const prodName = product?.name ?? flag.product?.name ?? "Unknown";
  const prodImage = product?.imageUrl ?? flag.product?.imageUrl ?? null;
  const prodItemCode = product?.itemCode ?? flag.product?.itemCode ?? null;
  const prodDept = product?.department ?? flag.product?.department ?? "Other";

  return (
    <Modal
      open={true}
      onClose={onClose}
      size="xl"
      title="Product flag"
    >
      {/* Flag context */}
      <div className="rounded-xl border border-border bg-surface-secondary p-3 mb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-tertiary">
          <span className="inline-flex items-center gap-1 text-text-primary font-medium">
            <DeptIcon className="h-3 w-3" />
            {flag.source === "producer"
              ? `Raised by ${flag.raisedByName ?? "Producer"} → ${flag.flaggedByDept} team + BMM`
              : `${flag.flaggedByDept} team flagged`}
          </span>
          <span>·</span>
          <span
            className="font-medium"
            style={{
              color:
                flag.reason === "about_to_change"
                  ? "var(--status-info-fg)"
                  : "var(--status-rejected-fg)",
            }}
          >
            {reasonLabel(flag.reason)}
          </span>
          <span>·</span>
          <span>{formatRelative(flag.createdAt)}</span>
          <span
            className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider border"
            style={
              flag.status === "open"
                ? {
                    color: "var(--status-pending-fg)",
                    backgroundColor: "var(--status-pending-tint)",
                    borderColor: "var(--status-pending-border)",
                  }
                : {
                    color: "var(--status-approved-fg)",
                    backgroundColor: "var(--status-approved-tint)",
                    borderColor: "var(--status-approved-border)",
                  }
            }
          >
            {flag.status}
          </span>
        </div>
        {flag.comment && (
          <p className="mt-2 text-[13px] text-text-primary whitespace-pre-wrap">
            “{flag.comment}”
          </p>
        )}
        {flag.status === "resolved" && (
          <div className="mt-3 pt-3 border-t border-border/60 text-[12px] text-text-tertiary">
            Resolved by{" "}
            <span className="text-text-primary font-medium">
              {flag.resolvedByName ?? "—"}
            </span>
            {flag.resolvedAt && ` · ${formatRelative(flag.resolvedAt)}`}
            {flag.resolutionNote && (
              <p className="mt-1 italic text-text-secondary">
                “{flag.resolutionNote}”
              </p>
            )}
          </div>
        )}
      </div>

      {/* Product panel */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Product
          </p>
          {canEdit && product && (
            editMode ? (
              <button
                onClick={() => setEditMode(false)}
                className="text-[11px] text-text-tertiary hover:text-text-primary inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="text-[11px] text-primary hover:text-primary/80 inline-flex items-center gap-1 font-medium"
              >
                <Edit2 className="h-3 w-3" /> Adjust
              </button>
            )
          )}
        </div>

        <div className="flex items-start gap-3">
          {prodImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prodImage}
              alt={prodName}
              className="h-16 w-16 rounded-lg object-cover shrink-0 bg-surface-tertiary"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-surface-tertiary shrink-0">
              <ShoppingBasket className="h-5 w-5 text-text-tertiary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {editMode ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm font-semibold text-text-primary bg-transparent border-b border-border focus:border-primary focus:outline-none pb-0.5"
              />
            ) : (
              <p className="text-sm font-semibold text-text-primary truncate">
                {prodName}
              </p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              {prodItemCode && (
                <span className="text-[11px] text-text-tertiary">
                  #{prodItemCode}
                </span>
              )}
              <span
                className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${
                  DEPT_COLORS[prodDept] || DEPT_COLORS.Other
                }`}
              >
                {prodDept}
              </span>
              {product && !editMode && (
                <Link
                  href={`/products?open=${product.id}`}
                  className="text-[11px] text-primary hover:text-primary/80 inline-flex items-center gap-0.5 ml-auto"
                  title="Open full product drawer"
                >
                  Full view
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Adjustable fields */}
        {product && (
          <div className="mt-3 space-y-3">
            <FieldBlock label="Description" readOnly={!editMode}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                readOnly={!editMode}
                rows={editMode ? 3 : 2}
                placeholder={editMode ? "Add a description…" : "—"}
                className={`w-full bg-transparent text-[13px] text-text-secondary placeholder:text-text-tertiary focus:outline-none resize-none ${
                  !editMode ? "pointer-events-none" : ""
                }`}
              />
            </FieldBlock>

            <FieldBlock label="Restrictions" readOnly={!editMode}>
              <textarea
                value={restrictions}
                onChange={(e) => setRestrictions(e.target.value)}
                readOnly={!editMode}
                rows={editMode ? 2 : 1}
                placeholder={editMode ? "None" : "—"}
                className={`w-full bg-transparent text-[13px] focus:outline-none resize-none ${
                  restrictions ? "font-medium text-warning" : "text-text-secondary"
                } ${!editMode ? "pointer-events-none" : ""}`}
              />
            </FieldBlock>

            <FieldBlock label="Shooting Notes" readOnly={!editMode}>
              <textarea
                value={shootingNotes}
                onChange={(e) => setShootingNotes(e.target.value)}
                readOnly={!editMode}
                rows={editMode ? 2 : 1}
                placeholder={editMode ? "Notes for the shoot team…" : "—"}
                className={`w-full bg-transparent text-[13px] text-text-secondary placeholder:text-text-tertiary focus:outline-none resize-none ${
                  !editMode ? "pointer-events-none" : ""
                }`}
              />
            </FieldBlock>

            {editMode && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditMode(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={saveProduct}
                  loading={savingProduct}
                  className="flex-1"
                >
                  Save changes
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comments thread */}
      <div className="mb-4 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
          Discussion
        </p>
        {comments.length === 0 ? (
          <p className="text-[12px] text-text-tertiary italic mb-2">
            No comments yet. Start the conversation with BMM or the RBU team.
          </p>
        ) : (
          <ul className="space-y-2.5 mb-2">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-2">
                <UserAvatar
                  name={c.authorUserName ?? c.authorDept ?? "?"}
                  size="xs"
                />
                <div className="flex-1 min-w-0 rounded-md bg-surface-secondary px-2.5 py-1.5">
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span className="text-[11px] font-semibold text-text-primary">
                      {c.authorUserName ?? `${c.authorDept} team`}
                    </span>
                    {c.authorLabel && !c.authorUserName && (
                      <span className="text-[10px] text-text-tertiary">
                        {c.authorLabel}
                      </span>
                    )}
                    {c.authorUserName && c.authorLabel && (
                      <span className="text-[10px] text-text-tertiary">
                        · {c.authorLabel}
                      </span>
                    )}
                    <span className="text-[10px] text-text-tertiary ml-auto">
                      {formatRelative(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-[13px] text-text-primary whitespace-pre-wrap">
                    {c.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                postComment();
              }
            }}
            placeholder="Add a comment…"
            className="flex-1 h-8 rounded-lg border border-border bg-surface px-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          <button
            type="button"
            onClick={postComment}
            disabled={!newComment.trim() || postingComment}
            className="h-8 px-3 rounded-lg bg-primary text-white text-[13px] font-medium disabled:opacity-40 transition-opacity shrink-0"
          >
            {postingComment ? "…" : "Post"}
          </button>
        </div>
      </div>

      {/* Resolve / Reopen action */}
      {flag.status === "open" && canResolve && !editMode && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Clear this flag
          </p>
          <textarea
            rows={2}
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            placeholder="What was done? (optional)"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={clearFlag}
              loading={resolving}
            >
              <Check className="h-3.5 w-3.5" />
              Clear flag
            </Button>
          </div>
        </div>
      )}

      {flag.status === "resolved" && canReopen && !editMode && (
        <div className="border-t border-border pt-3 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={reopenFlag}
            loading={reopening}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reopen flag
          </Button>
        </div>
      )}
    </Modal>
  );
}

function FieldBlock({
  label,
  readOnly,
  children,
}: {
  label: string;
  readOnly: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-0.5">
        {label}
      </p>
      <div
        className={`rounded-md ${
          readOnly ? "" : "border border-border px-2 py-1.5 bg-surface"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
