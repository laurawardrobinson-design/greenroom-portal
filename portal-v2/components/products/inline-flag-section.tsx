"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Apple,
  Beef,
  Check,
  Cookie,
  Flag,
  Pencil,
  Sandwich,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import type {
  ProductFlag,
  ProductFlagComment,
} from "@/lib/services/product-flags.service";
import type { PRDepartment, ProductDepartment } from "@/types/domain";

const RBU_DEPTS: PRDepartment[] = [
  "Bakery",
  "Produce",
  "Deli",
  "Meat-Seafood",
  "Grocery",
];

const DEPT_ICONS: Record<PRDepartment, LucideIcon> = {
  Bakery: Cookie,
  Produce: Apple,
  Deli: Sandwich,
  "Meat-Seafood": Beef,
  Grocery: ShoppingBasket,
};

function defaultDeptFor(
  productDept: ProductDepartment | null | undefined
): PRDepartment | null {
  if (!productDept) return null;
  if (productDept === "Bakery") return "Bakery";
  if (productDept === "Produce") return "Produce";
  if (productDept === "Deli") return "Deli";
  if (productDept === "Meat-Seafood") return "Meat-Seafood";
  if (productDept === "Grocery") return "Grocery";
  return null;
}

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

interface Props {
  productId: string;
  productDept: ProductDepartment | null | undefined;
  onChanged: () => void;
}

/**
 * Inline panel rendered below product drawer action buttons.
 *
 * - When the product has open flags, shows each flag's reason, original
 *   comment, comment thread, and a "Mark resolved" button.
 * - When the product has no open flags, shows a compact form to raise one.
 */
export function InlineFlagSection({ productId, productDept, onChanged }: Props) {
  const { data: flagsData, mutate: mutateFlags } = useSWR<ProductFlag[]>(
    `/api/product-flags?productId=${productId}&status=open`,
    fetcher
  );
  const openFlags = flagsData ?? [];

  if (openFlags.length === 0) {
    return (
      <RaiseFlagInline
        productId={productId}
        productDept={productDept}
        onCreated={() => {
          mutateFlags();
          onChanged();
        }}
      />
    );
  }

  return (
    <OpenFlagsPanel
      flags={openFlags}
      onChanged={() => {
        mutateFlags();
        onChanged();
      }}
    />
  );
}

function OpenFlagsPanel({
  flags,
  onChanged,
}: {
  flags: ProductFlag[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [resolving, setResolving] = useState(false);

  async function clearAll() {
    setResolving(true);
    try {
      const results = await Promise.all(
        flags.map((f) =>
          fetch(`/api/product-flags/${f.id}/resolve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note: "" }),
          })
        )
      );
      if (results.some((r) => !r.ok)) throw new Error();
      toast("success", flags.length === 1 ? "Flag cleared" : "Flags cleared");
      onChanged();
    } catch {
      toast("error", "Couldn't clear flag");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-warning">
          Open flags
        </p>
        <button
          type="button"
          onClick={clearAll}
          disabled={resolving}
          title="Clear once the issue is resolved"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-warning hover:text-amber-700 disabled:opacity-50 transition-colors"
        >
          <Check className="h-3 w-3" />
          {resolving ? "Clearing…" : "Clear Flag"}
        </button>
      </div>
      {flags.map((flag) => (
        <FlagItem key={flag.id} flag={flag} onChanged={onChanged} />
      ))}
    </div>
  );
}

function FlagItem({
  flag,
  onChanged,
}: {
  flag: ProductFlag;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const DeptIcon = DEPT_ICONS[flag.flaggedByDept];

  const { data: commentsData, mutate: mutateComments } = useSWR<
    ProductFlagComment[]
  >(`/api/product-flags/${flag.id}/comments`, fetcher);
  const comments = commentsData ?? [];

  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const canEditBody = !!user && !!flag.raisedByUserId && user.id === flag.raisedByUserId;
  const [editingBody, setEditingBody] = useState(false);
  const [bodyDraft, setBodyDraft] = useState(flag.comment);
  const [savingBody, setSavingBody] = useState(false);

  async function saveBody() {
    if (!bodyDraft.trim()) return;
    setSavingBody(true);
    try {
      const res = await fetch(`/api/product-flags/${flag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: bodyDraft }),
      });
      if (!res.ok) throw new Error();
      setEditingBody(false);
      onChanged();
    } catch {
      toast("error", "Couldn't save edit");
    } finally {
      setSavingBody(false);
    }
  }

  async function postComment() {
    if (!newComment.trim()) return;
    setPosting(true);
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
      setPosting(false);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-surface p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-warning border border-amber-200 px-2 py-0.5 text-[11px] font-medium">
          <DeptIcon className="h-3 w-3" />
          {flag.flaggedByDept}
        </span>
        <span className="text-[11px] text-text-tertiary">
          {reasonLabel(flag.reason)} · {formatRelative(flag.createdAt)}
        </span>
      </div>

      {editingBody ? (
        <div className="space-y-1.5">
          <textarea
            value={bodyDraft}
            onChange={(e) => setBodyDraft(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[13px] text-text-primary focus:outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-1.5 justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setBodyDraft(flag.comment);
                setEditingBody(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveBody}
              loading={savingBody}
              disabled={!bodyDraft.trim() || bodyDraft.trim() === flag.comment.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        flag.comment && (
          <div className="group flex items-start gap-1.5">
            <p className="text-[13px] text-text-primary whitespace-pre-wrap flex-1">
              {flag.comment}
            </p>
            {canEditBody && (
              <button
                type="button"
                onClick={() => {
                  setBodyDraft(flag.comment);
                  setEditingBody(true);
                }}
                className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary transition-opacity shrink-0 mt-0.5"
                title="Edit comment"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        )
      )}
      {flag.raisedByName && !editingBody && (
        <p className="text-[11px] text-text-tertiary">
          Flagged by {flag.raisedByName}
          {flag.editedAt && (
            <span className="italic" title={`Edited ${formatRelative(flag.editedAt)}`}>
              {" · edited"}
            </span>
          )}
        </p>
      )}

      {comments.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1.5">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              flagId={flag.id}
              onUpdated={() => mutateComments()}
            />
          ))}
        </div>
      )}

      <div className="flex gap-1.5 items-end pt-1">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Reply…"
          rows={1}
          className="flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary resize-none"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={postComment}
          loading={posting}
          disabled={!newComment.trim()}
        >
          Post
        </Button>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  flagId,
  onUpdated,
}: {
  comment: ProductFlagComment;
  flagId: string;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const canEdit = !!user && user.id === comment.authorUserId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/product-flags/${flagId}/comments/${comment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: draft }),
        }
      );
      if (!res.ok) throw new Error();
      setEditing(false);
      onUpdated();
    } catch {
      toast("error", "Couldn't save edit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="text-[12px] group">
      <span className="font-medium text-text-primary">
        {comment.authorUserName || comment.authorLabel || "Someone"}
      </span>
      <span className="text-text-tertiary">
        {" · "}
        {formatRelative(comment.createdAt)}
      </span>
      {comment.editedAt && (
        <span className="text-text-tertiary italic" title={`Edited ${formatRelative(comment.editedAt)}`}>
          {" · edited"}
        </span>
      )}
      {canEdit && !editing && (
        <button
          type="button"
          onClick={() => {
            setDraft(comment.body);
            setEditing(true);
          }}
          className="ml-1.5 opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-primary transition-opacity"
          title="Edit comment"
        >
          <Pencil className="inline h-3 w-3" />
        </button>
      )}
      {editing ? (
        <div className="mt-1 space-y-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-text-primary focus:outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-1.5 justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              loading={saving}
              disabled={!draft.trim() || draft.trim() === comment.body.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-text-secondary whitespace-pre-wrap">{comment.body}</p>
      )}
    </div>
  );
}

function RaiseFlagInline({
  productId,
  productDept,
  onCreated,
}: {
  productId: string;
  productDept: ProductDepartment | null | undefined;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [dept, setDept] = useState<PRDepartment | null>(
    defaultDeptFor(productDept)
  );
  const [reason, setReason] = useState<"inaccurate" | "about_to_change">(
    "about_to_change"
  );
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!dept) {
      toast("error", "Pick which department this is for");
      return;
    }
    if (!comment.trim()) {
      toast("error", "Add a comment so the team knows what to look at");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/product-flags/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          dept,
          reason,
          comment: comment.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      toast("success", `Flag sent to ${dept} team + BMM`);
      setComment("");
      onCreated();
    } catch {
      toast("error", "Couldn't send flag");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-secondary/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        Raise a flag
      </p>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
          Department to review
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {RBU_DEPTS.map((d) => {
            const Icon = DEPT_ICONS[d];
            const selected = dept === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDept(d)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-secondary"
                }`}
              >
                <Icon className="h-4 w-4" />
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
          Reason
        </p>
        <div className="flex gap-1">
          {(
            [
              ["about_to_change", "About to change"],
              ["inaccurate", "Inaccurate"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setReason(key)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] font-medium transition-colors ${
                reason === key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-text-secondary hover:bg-surface-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
          Comment
        </p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="What needs attention before the next shoot?"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary resize-none"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={submit}
          loading={submitting}
          disabled={!dept || !comment.trim()}
        >
          <Flag className="h-3.5 w-3.5" />
          Send flag
        </Button>
      </div>
    </div>
  );
}
