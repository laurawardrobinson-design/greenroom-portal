"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import type { Vendor, RateCard, Shoot, OnboardingStatus } from "@/types/domain";
import { formatCurrency } from "@/lib/utils/format";
import { UserCircle, Search, ChevronDown, AlertTriangle, CheckCircle2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface BookCrewDrawerProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  shoots: Shoot[];
  onBooked: () => void;
}

export function BookCrewDrawer({
  open,
  onClose,
  campaignId,
  shoots,
  onBooked,
}: BookCrewDrawerProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Data sources
  const { data: vendors = [] } = useSWR<Vendor[]>(
    open ? "/api/vendors" : null,
    fetcher
  );
  const { data: rateCards = [] } = useSWR<RateCard[]>(
    open ? "/api/rate-cards" : null,
    fetcher
  );
  const { data: onboardingData } = useSWR<{ status: OnboardingStatus }>(
    open && selectedPersonId ? `/api/onboarding/${selectedPersonId}` : null,
    fetcher
  );
  const onboardingStatus = onboardingData?.status ?? null;

  // Form state
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const [role, setRole] = useState("");
  const [dayRate, setDayRate] = useState("");
  const [classification, setClassification] = useState("1099");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedPersonId("");
      setPersonSearch("");
      setRole("");
      setDayRate("");
      setClassification("1099");
      setSelectedDates([]);
      setNotes("");
    }
  }, [open]);

  // Auto-suggest rate when role changes
  useEffect(() => {
    if (role) {
      const match = rateCards.find(
        (rc) => rc.role.toLowerCase() === role.toLowerCase()
      );
      if (match && !dayRate) {
        setDayRate(String(match.dayRate));
      }
    }
  }, [role, rateCards, dayRate]);

  // Available shoot dates
  const allDates = shoots.flatMap((s) =>
    s.dates.map((d) => ({ date: d.shootDate, shootName: s.name }))
  );

  // Person list — vendors/freelancers only (internal team are salaried, not paymaster)
  const filteredVendors = vendors.filter(
    (v) =>
      v.active &&
      (v.companyName.toLowerCase().includes(personSearch.toLowerCase()) ||
        v.contactName.toLowerCase().includes(personSearch.toLowerCase()))
  );

  const selectedPerson = vendors.find((v) => v.id === selectedPersonId);
  const selectedPersonName =
    (selectedPerson as Vendor)?.contactName || (selectedPerson as Vendor)?.companyName || "";

  // Rate card suggestion
  const suggestedRate = rateCards.find(
    (rc) => rc.role.toLowerCase() === role.toLowerCase()
  );
  const rateExceedsStandard =
    suggestedRate && Number(dayRate) > suggestedRate.dayRate * 1.15;

  // Computed total
  const total = selectedDates.length * (Number(dayRate) || 0);

  function toggleDate(date: string) {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPersonId || !role || !dayRate || selectedDates.length === 0) {
      toast("error", "Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/crew-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          vendorId: selectedPersonId,
          role,
          dayRate: Number(dayRate),
          classification,
          dates: selectedDates,
          notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to book crew");
      }

      toast("success", `${selectedPersonName} booked as ${role}`);
      onBooked();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to book crew");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Book Crew" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Person selector */}
        <div className="relative">
          <label className="block text-base font-medium text-text-primary mb-1.5">
            Vendor / Freelancer
          </label>
          {selectedPersonId ? (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                <UserCircle className="h-4 w-4 text-text-tertiary shrink-0" />
                <span className="text-base text-text-primary flex-1">{selectedPersonName}</span>
                {onboardingStatus === "complete" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Onboarded
                  </span>
                )}
                {onboardingStatus === "partial" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                    <AlertTriangle className="h-3 w-3" />
                    Partial
                  </span>
                )}
                {onboardingStatus === "none" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-50 rounded-full px-2 py-0.5">
                    <AlertTriangle className="h-3 w-3" />
                    Not onboarded
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setSelectedPersonId(""); setPersonSearch(""); }}
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  Change
                </button>
              </div>
              {onboardingStatus && onboardingStatus !== "complete" && (
                <p className="mt-1.5 text-xs text-amber-700">
                  ⚠️ This person&apos;s paymaster onboarding is incomplete. They must be fully onboarded before payment can be released.
                </p>
              )}
            </>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search vendors and freelancers..."
                  value={personSearch}
                  onChange={(e) => { setPersonSearch(e.target.value); setShowPersonDropdown(true); }}
                  onFocus={() => setShowPersonDropdown(true)}
                  className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {showPersonDropdown && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
                  {filteredVendors.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedPersonId(v.id);
                        setShowPersonDropdown(false);
                        if (!role && v.category) setRole(v.category);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-secondary"
                    >
                      <UserCircle className="h-4 w-4 text-text-tertiary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary truncate">{v.contactName || v.companyName}</p>
                        <p className="text-xs text-text-tertiary">{v.category}</p>
                      </div>
                    </button>
                  ))}
                  {filteredVendors.length === 0 && (
                    <p className="px-3 py-4 text-sm text-text-tertiary text-center">No vendors found</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Role with autocomplete from rate cards */}
        <div className="relative">
          <label className="block text-base font-medium text-text-primary mb-1.5">Role</label>
          <input
            type="text"
            placeholder="e.g. Photographer, Food Stylist"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            list="role-suggestions"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <datalist id="role-suggestions">
            {rateCards.map((rc) => (
              <option key={rc.id} value={rc.role} />
            ))}
          </datalist>
        </div>

        {/* Day Rate */}
        <div>
          <label className="block text-base font-medium text-text-primary mb-1.5">Day Rate</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">$</span>
            <input
              type="number"
              min={0}
              step="1"
              placeholder="0"
              value={dayRate}
              onChange={(e) => setDayRate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface pl-7 pr-3 py-2 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          {suggestedRate && (
            <p className="mt-1 text-xs text-text-tertiary">
              Standard rate for {suggestedRate.role}: {formatCurrency(suggestedRate.dayRate)}
            </p>
          )}
          {rateExceedsStandard && (
            <p className="mt-1 text-xs text-amber-600 font-medium">
              Rate exceeds standard by &gt;15% — will require HOP approval
            </p>
          )}
        </div>

        {/* Classification */}
        <div>
          <label className="block text-base font-medium text-text-primary mb-1.5">Classification</label>
          <select
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="1099">1099</option>
            <option value="Paymaster">Paymaster</option>
            <option value="W-2 via Paymaster">W-2 via Paymaster</option>
            <option value="Loan Out">Loan Out</option>
          </select>
        </div>

        {/* Shoot Dates */}
        <div>
          <label className="block text-base font-medium text-text-primary mb-1.5">
            Shoot Dates
            {selectedDates.length > 0 && (
              <span className="ml-2 text-sm font-normal text-text-tertiary">
                {selectedDates.length} day{selectedDates.length !== 1 ? "s" : ""} selected
              </span>
            )}
          </label>
          {allDates.length === 0 ? (
            <p className="text-sm text-text-tertiary">No shoot dates scheduled yet. Add shoot dates first.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {allDates.map(({ date, shootName }) => {
                const isSelected = selectedDates.includes(date);
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => toggleDate(date)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-text-secondary hover:bg-surface-secondary"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : "border-border"
                      }`}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current">
                          <path d="M10.28 2.28a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 0 1-1.06 0l-2.25-2.25a.75.75 0 1 1 1.06-1.06L4.5 7 9.22 2.28a.75.75 0 0 1 1.06 0Z" />
                        </svg>
                      )}
                    </div>
                    <span className="flex-1">
                      {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-xs text-text-tertiary">{shootName}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-base font-medium text-text-primary mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special notes about this booking..."
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        {/* Total */}
        {total > 0 && (
          <div className="rounded-lg bg-surface-secondary p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">
                {selectedDates.length} day{selectedDates.length !== 1 ? "s" : ""} × {formatCurrency(Number(dayRate))}
              </span>
              <span className="text-lg font-semibold text-text-primary">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            loading={submitting}
            disabled={!selectedPersonId || !role || !dayRate || selectedDates.length === 0}
            className="flex-1"
          >
            {rateExceedsStandard ? "Book (Pending Approval)" : "Book Crew"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
