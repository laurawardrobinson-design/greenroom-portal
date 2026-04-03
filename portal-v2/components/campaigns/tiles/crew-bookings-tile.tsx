"use client";

import { useState } from "react";
import type { CrewBooking } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/format";
import { UserCircle, Check, X, Calendar, Send, Clock } from "lucide-react";

const STATUS_BADGE: Record<string, { variant: "success" | "warning" | "error" | "default" | "info"; label: string }> = {
  "Draft": { variant: "default", label: "Draft" },
  "Pending Approval": { variant: "warning", label: "Pending Rate Approval" },
  "Confirmed": { variant: "success", label: "Confirmed" },
  "Completed": { variant: "info", label: "Completed" },
  "Cancelled": { variant: "error", label: "Cancelled" },
};

const PAYMENT_STATUS_BADGE: Record<string, { variant: "success" | "warning" | "error" | "default" | "info"; label: string }> = {
  "Pending Approval": { variant: "warning", label: "Payment Pending Approval" },
  "Approved": { variant: "success", label: "Payment Approved" },
  "Sent to Paymaster": { variant: "info", label: "Sent to Paymaster" },
  "Paid": { variant: "success", label: "Paid" },
};

interface CrewBookingsTileProps {
  bookings: CrewBooking[];
  canEdit: boolean;
  onMutate: () => void;
}

export function CrewBookingsTile({ bookings, canEdit, onMutate }: CrewBookingsTileProps) {
  const { toast } = useToast();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const activeBookings = bookings.filter((b) => b.status !== "Cancelled");
  const confirmingBooking = bookings.find((b) => b.id === confirmingId);

  // Day confirmation state
  const [dayConfirmations, setDayConfirmations] = useState<Record<string, boolean>>({});

  function openConfirmDays(booking: CrewBooking) {
    const initial: Record<string, boolean> = {};
    for (const d of booking.dates) {
      initial[d.id] = d.confirmed ?? true;
    }
    setDayConfirmations(initial);
    setConfirmingId(booking.id);
  }

  async function submitForPayment() {
    if (!confirmingId || !confirmingBooking) return;
    setActionLoading(true);
    try {
      const confirmations = Object.entries(dayConfirmations).map(([dateId, confirmed]) => ({
        dateId,
        confirmed,
      }));
      const res = await fetch(`/api/crew-bookings/${confirmingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_days",
          confirmations,
          submitPayment: true,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const confirmedCount = Object.values(dayConfirmations).filter(Boolean).length;
      toast("success", `${confirmedCount} day${confirmedCount !== 1 ? "s" : ""} submitted for payment approval`);
      setConfirmingId(null);
      onMutate();
    } catch {
      toast("error", "Failed to submit days for payment");
    } finally {
      setActionLoading(false);
    }
  }

  async function cancelBooking(id: string) {
    try {
      const res = await fetch(`/api/crew-bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Booking cancelled");
      onMutate();
    } catch {
      toast("error", "Failed to cancel booking");
    }
  }

  // Compute totals
  const totalCommitted = activeBookings.reduce(
    (sum, b) => sum + (b.plannedDays || 0) * b.dayRate,
    0
  );
  const totalConfirmed = activeBookings.reduce(
    (sum, b) => sum + (b.confirmedDays || 0) * b.dayRate,
    0
  );
  const totalApproved = activeBookings.reduce((sum, b) => {
    if (b.payment?.status === "Approved" || b.payment?.status === "Sent to Paymaster" || b.payment?.status === "Paid") {
      return sum + (b.payment.totalAmount || 0);
    }
    return sum;
  }, 0);

  if (activeBookings.length === 0) {
    return null;
  }

  return (
    <>
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-text-tertiary px-1 pb-2">
        <span>
          Booked: <span className="font-medium text-text-primary">{formatCurrency(totalCommitted)}</span>
        </span>
        {totalConfirmed > 0 && totalConfirmed !== totalCommitted && (
          <span>
            Confirmed: <span className="font-medium text-text-primary">{formatCurrency(totalConfirmed)}</span>
          </span>
        )}
        {totalApproved > 0 && (
          <span>
            Approved: <span className="font-medium text-primary">{formatCurrency(totalApproved)}</span>
          </span>
        )}
      </div>

      {/* Booking cards */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {activeBookings.map((booking) => {
          const personName = booking.vendor
            ? booking.vendor.contactName || booking.vendor.companyName
            : booking.user?.name || "Unknown";
          const badgeInfo = STATUS_BADGE[booking.status] || STATUS_BADGE["Draft"];
          const hasUnconfirmedDates =
            booking.status === "Confirmed" &&
            !booking.payment &&
            booking.dates.some((d) => d.confirmed === null);
          const confirmedCount = booking.dates.filter((d) => d.confirmed === true).length;
          const paymentBadge = booking.payment
            ? PAYMENT_STATUS_BADGE[booking.payment.status]
            : null;

          return (
            <div key={booking.id} className="rounded-lg bg-surface-secondary p-3">
              <div className="flex items-start gap-3">
                <UserCircle className="h-4 w-4 text-text-tertiary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-medium text-text-primary truncate">{personName}</p>
                    {paymentBadge ? (
                      <Badge variant={paymentBadge.variant}>{paymentBadge.label}</Badge>
                    ) : (
                      <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-text-tertiary">
                    {booking.role} · {formatCurrency(booking.dayRate)}/day
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {booking.payment
                        ? `${booking.payment.totalDays} day${booking.payment.totalDays !== 1 ? "s" : ""} confirmed`
                        : `${booking.dates.length} day${booking.dates.length !== 1 ? "s" : ""}${confirmedCount > 0 ? ` (${confirmedCount} confirmed)` : ""}`}
                    </span>
                    <span className="font-medium text-text-secondary">
                      {formatCurrency(
                        booking.payment
                          ? booking.payment.totalAmount
                          : (booking.confirmedDays || booking.plannedDays || 0) * booking.dayRate
                      )}
                    </span>
                  </div>
                  {booking.classification !== "1099" && (
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {booking.classification === "W2 Paymaster" ? "W-2 Paymaster" : "Loan Out"}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-border">
                  {hasUnconfirmedDates && (
                    <button
                      type="button"
                      onClick={() => openConfirmDays(booking)}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Send className="h-3 w-3" />
                      Submit for Payment
                    </button>
                  )}
                  {booking.status === "Confirmed" && !booking.payment && !hasUnconfirmedDates && confirmedCount === 0 && (
                    <button
                      type="button"
                      onClick={() => openConfirmDays(booking)}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Clock className="h-3 w-3" />
                      Confirm Days
                    </button>
                  )}
                  {booking.status !== "Completed" && !booking.payment && (
                    <>
                      {(hasUnconfirmedDates || confirmedCount === 0) && (
                        <span className="text-text-tertiary">·</span>
                      )}
                      <button
                        type="button"
                        onClick={() => cancelBooking(booking.id)}
                        className="text-xs text-text-tertiary hover:text-red-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit for Payment Modal */}
      <Modal
        open={!!confirmingId}
        onClose={() => setConfirmingId(null)}
        title="Submit Days for Payment"
      >
        {confirmingBooking && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Confirm the days{" "}
              <span className="font-medium text-text-primary">
                {confirmingBooking.vendor?.contactName ||
                  confirmingBooking.vendor?.companyName ||
                  confirmingBooking.user?.name}
              </span>{" "}
              actually worked. This will be submitted to HOP for payment approval.
            </p>

            <div className="space-y-1.5">
              {confirmingBooking.dates.map((d) => {
                const isChecked = dayConfirmations[d.id] ?? true;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      setDayConfirmations((prev) => ({
                        ...prev,
                        [d.id]: !isChecked,
                      }))
                    }
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      isChecked
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-text-tertiary line-through"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        isChecked
                          ? "border-primary bg-primary text-white"
                          : "border-border"
                      }`}
                    >
                      {isChecked && <Check className="h-2.5 w-2.5" />}
                    </div>
                    <span className="flex-1">
                      {new Date(d.shootDate + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-xs">
                      {isChecked ? formatCurrency(confirmingBooking.dayRate) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg bg-surface-secondary p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  {Object.values(dayConfirmations).filter(Boolean).length} day
                  {Object.values(dayConfirmations).filter(Boolean).length !== 1 ? "s" : ""}{" "}
                  × {formatCurrency(confirmingBooking.dayRate)}
                </span>
                <span className="text-lg font-semibold text-text-primary">
                  {formatCurrency(
                    Object.values(dayConfirmations).filter(Boolean).length *
                      confirmingBooking.dayRate
                  )}
                </span>
              </div>
              <p className="text-xs text-text-tertiary mt-1">
                Will be submitted to HOP for payment approval
              </p>
            </div>

            <ModalFooter>
              <Button variant="ghost" onClick={() => setConfirmingId(null)}>
                Cancel
              </Button>
              <Button
                onClick={submitForPayment}
                loading={actionLoading}
                disabled={Object.values(dayConfirmations).filter(Boolean).length === 0}
              >
                <Send className="h-3.5 w-3.5" />
                Submit for Payment
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </>
  );
}
