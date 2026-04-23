"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { PRDepartment, ProductDepartment } from "@/types/domain";

const RBU_DEPTS: PRDepartment[] = [
  "Bakery",
  "Produce",
  "Deli",
  "Meat-Seafood",
  "Grocery",
];

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

export function RaiseFlagDialog({
  productId,
  productName,
  productDept,
  onClose,
  onCreated,
}: {
  productId: string;
  productName: string;
  productDept: ProductDepartment | null | undefined;
  onClose: () => void;
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
      if (!res.ok) throw new Error(await res.text());
      toast("success", `Flag sent to ${dept} team + BMM`);
      onCreated();
      onClose();
    } catch {
      toast("error", "Couldn't send flag");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} size="md">
      <div className="flex items-start justify-between gap-2 mb-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Flag for BMM + RBU review
            </h2>
            <p className="text-[11px] text-text-tertiary mt-0.5 truncate max-w-xs">
              {productName}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
            Department to review
          </p>
          <div className="flex flex-wrap gap-1">
            {RBU_DEPTS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDept(d)}
                className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  dept === d
                    ? "bg-primary text-white"
                    : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-text-tertiary mt-1.5">
            BMM + the {dept ?? "…"} team will see this and can comment.
          </p>
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

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            loading={submitting}
            disabled={!dept}
          >
            <Flag className="h-3.5 w-3.5" />
            Send flag
          </Button>
        </div>
      </div>
    </Modal>
  );
}
