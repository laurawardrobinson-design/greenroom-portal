"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/format";
import { AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function BudgetTab({
  campaignId,
  financials,
  vendors: campaignVendors,
  canEdit,
  showOverageRequest,
  setShowOverageRequest,
  onMutate,
}: {
  campaignId: string;
  financials: { budget: number; committed: number; spent: number; remaining: number };
  vendors: Array<{ id: string; vendorId: string; estimateTotal: number; invoiceTotal: number; paymentAmount: number; status: string; vendor?: { companyName: string; category: string } }>;
  canEdit: boolean;
  showOverageRequest: boolean;
  setShowOverageRequest: (v: boolean) => void;
  onMutate: () => void;
}) {
  const { toast } = useToast();
  const { data: overageRequests = [], mutate: mutateOverages } = useSWR<
    Array<{
      id: string;
      amount: number;
      rationale: string;
      status: string;
      createdAt: string;
      requester?: { name: string };
    }>
  >(`/api/budget/requests?campaignId=${campaignId}`, fetcher);
  const [amount, setAmount] = useState("");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const projectedTotal = financials.committed + Number(amount || 0);
  const projectedOverBudget = projectedTotal > financials.budget;

  async function handleSubmitOverage(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !rationale) {
      toast("error", "Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/budget/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, amount: Number(amount), rationale }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Overage request submitted");
      setShowOverageRequest(false);
      setAmount("");
      setRationale("");
      mutateOverages();
      onMutate();
    } catch {
      toast("error", "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-surface-secondary p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Budget</p>
            <p className="text-lg font-semibold text-text-primary">{formatCurrency(financials.budget)}</p>
          </div>
          <div className="rounded-lg bg-surface-secondary p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Committed</p>
            <p className="text-lg font-semibold text-blue-600">{formatCurrency(financials.committed)}</p>
          </div>
          <div className="rounded-lg bg-surface-secondary p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Spent</p>
            <p className="text-lg font-semibold text-success">{formatCurrency(financials.spent)}</p>
          </div>
        </div>
        {financials.budget > 0 && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-text-secondary">{formatCurrency(financials.committed)} committed</span>
              <span className="text-text-tertiary">{formatCurrency(financials.remaining)} remaining</span>
            </div>
            <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min((financials.committed / financials.budget) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
        {canEdit && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowOverageRequest(true)}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Request Overage
          </Button>
        )}
      </div>

      {campaignVendors.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Vendor Costs</p>
          <div className="space-y-1">
            {campaignVendors.map((cv) => (
              <div key={cv.id} className="flex items-center justify-between rounded-md bg-surface-secondary px-3 py-2 text-xs">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-text-primary">{cv.vendor?.companyName || "Unknown"}</span>
                  <span className="text-text-tertiary ml-1.5">{cv.vendor?.category}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {cv.estimateTotal > 0 && (
                    <span className="text-text-secondary">Est: {formatCurrency(cv.estimateTotal)}</span>
                  )}
                  {cv.paymentAmount > 0 && (
                    <span className="text-success">Paid: {formatCurrency(cv.paymentAmount)}</span>
                  )}
                  <span className={`font-medium ${
                    ["Paid", "Invoice Approved"].includes(cv.status)
                      ? "text-success"
                      : "text-text-primary"
                  }`}>
                    {formatCurrency(cv.estimateTotal || cv.invoiceTotal || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {overageRequests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Overage Requests</p>
          {overageRequests.map((req) => (
            <div
              key={req.id}
              className="flex items-start gap-3 rounded-lg bg-surface-secondary p-3"
            >
              <div className="mt-0.5">
                {req.status === "Pending" ? (
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                ) : req.status === "Approved" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-text-primary">
                    {formatCurrency(req.amount)}
                  </span>
                  <Badge
                    variant="custom"
                    className={
                      req.status === "Approved"
                        ? "bg-emerald-50 text-success"
                        : req.status === "Declined"
                        ? "bg-red-50 text-error"
                        : "bg-amber-50 text-warning"
                    }
                  >
                    {req.status}
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary">{req.rationale}</p>
                <p className="text-[10px] text-text-tertiary mt-1">
                  {req.requester?.name && `${req.requester.name} · `}
                  {format(parseISO(req.createdAt), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showOverageRequest}
        onClose={() => setShowOverageRequest(false)}
        title="Request Budget Overage"
      >
        <form onSubmit={handleSubmitOverage} className="space-y-4">
          <p className="text-xs text-text-secondary">
            Current budget: {formatCurrency(financials.budget)} · Remaining: {formatCurrency(financials.remaining)}
          </p>
          <div>
            <Input
              label="Additional Amount Needed"
              type="number"
              min={1}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {amount && Number(amount) > 0 && (
              <p className="mt-1.5 text-xs text-text-secondary">
                New total if approved:{" "}
                <span className={projectedOverBudget ? "font-semibold text-error" : "font-semibold text-success"}>
                  {formatCurrency(projectedTotal)}
                </span>
                {projectedOverBudget && (
                  <span className="text-red-500 ml-1">
                    &nbsp;({formatCurrency(projectedTotal - financials.budget)} over budget)
                  </span>
                )}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Rationale
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why is the additional budget needed?"
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none resize-none"
            />
          </div>
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setShowOverageRequest(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Submit Request
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
