"use client";

import { useState } from "react";
import {
  Apple,
  Beef,
  Cookie,
  Flag,
  Sandwich,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";
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

export function RaiseFlagDialog({
  productId,
  productName,
  productDept,
  onClose,
  onCreated,
  rbuToken = null,
}: {
  productId: string;
  productName: string;
  productDept: ProductDepartment | null | undefined;
  onClose: () => void;
  onCreated: () => void;
  // When set, post via the token-gated RBU endpoint (no auth session).
  rbuToken?: string | null;
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
      const url = rbuToken
        ? `/api/rbu/${rbuToken}/products/${productId}/flag`
        : "/api/product-flags/internal";
      const body = rbuToken
        ? { dept, reason, comment: comment.trim() }
        : { productId, dept, reason, comment: comment.trim() };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    <Modal
      open={true}
      onClose={onClose}
      size="md"
      title={`Flag ${productName}`}
    >
      <div className="space-y-3">
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
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] font-medium transition-colors ${
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
