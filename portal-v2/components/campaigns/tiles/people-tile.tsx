"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Users, UserCircle, Plus, Check, X, Palette, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { VENDOR_STATUS_COLORS } from "@/lib/constants/statuses";
import type { AppUser, CampaignVendor, Shoot, Vendor } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  campaignId: string;
  shoots: Shoot[];
  canEdit: boolean;
  isVendor: boolean;
  currentAd: AppUser | null;
  adUsers: AppUser[];
  producer: AppUser | null;
  currentUserId: string;
  campaignAdId: string | null;
  isArtDirector: boolean;
  onAssign: (userId: string | null) => Promise<void>;
}

export function PeopleTile({
  campaignId,
  shoots,
  canEdit,
  isVendor,
  currentAd,
  adUsers,
  producer,
  currentUserId,
  campaignAdId,
  isArtDirector,
  onAssign,
}: Props) {
  if (isVendor) return null;

  return (
    <Card padding="none">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">People</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-3.5 py-3">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Internal
          </p>
          <InternalTab
            currentAd={currentAd}
            adUsers={adUsers}
            producer={producer}
            canEdit={canEdit}
            isArtDirector={isArtDirector}
            currentUserId={currentUserId}
            campaignAdId={campaignAdId}
            onAssign={onAssign}
          />
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Vendors
          </p>
          <VendorsTab campaignId={campaignId} shoots={shoots} canEdit={canEdit} />
        </div>
      </div>
    </Card>
  );
}

// ─── Internal Tab ─────────────────────────────────────────────────────────────

function InternalTab({
  currentAd,
  adUsers,
  producer,
  canEdit,
  isArtDirector,
  currentUserId,
  campaignAdId,
  onAssign,
}: {
  currentAd: AppUser | null;
  adUsers: AppUser[];
  producer: AppUser | null;
  canEdit: boolean;
  isArtDirector: boolean;
  currentUserId: string;
  campaignAdId: string | null;
  onAssign: (userId: string | null) => Promise<void>;
}) {
  const [adPickerOpen, setAdPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function assign(userId: string | null) {
    setSaving(true);
    await onAssign(userId);
    setSaving(false);
    setAdPickerOpen(false);
  }

  const canAssign = canEdit || (isArtDirector && !campaignAdId);
  const isSelf = campaignAdId === currentUserId;

  return (
    <div className="space-y-3">
      {/* Producer row */}
      {producer && (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{producer.name}</p>
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Producer</p>
          </div>
        </div>
      )}

      {/* Art Director row */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Palette className="h-3 w-3 text-text-tertiary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Art Director</span>
        </div>
        {currentAd ? (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600">
              <UserCircle className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-text-primary flex-1 truncate">
              {isSelf && isArtDirector ? "You" : currentAd.name}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => assign(null)}
                disabled={saving}
                className="shrink-0 p-1 rounded hover:bg-surface-secondary transition-colors text-text-tertiary hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : canAssign ? (
          <div className="relative">
            {isArtDirector && !canEdit ? (
              <button
                type="button"
                onClick={() => assign(currentUserId)}
                disabled={saving}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                {saving ? "Assigning..." : "Assign myself"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAdPickerOpen(!adPickerOpen)}
                  className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Assign Art Director
                </button>
                {adPickerOpen && (
                  <div className="absolute top-8 left-0 right-0 z-20 rounded-lg border border-border bg-surface shadow-lg max-h-48 overflow-y-auto">
                    {adUsers.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-text-tertiary">No Art Directors found</p>
                    ) : (
                      adUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => assign(u.id)}
                          disabled={saving}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-primary hover:bg-surface-secondary transition-colors text-left disabled:opacity-50"
                        >
                          <UserCircle className="h-4 w-4 text-text-tertiary shrink-0" />
                          {u.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">Not assigned</p>
        )}
      </div>
    </div>
  );
}

// ─── Vendors Tab ──────────────────────────────────────────────────────────────

function VendorsTab({
  campaignId,
  shoots,
  canEdit,
}: {
  campaignId: string;
  shoots: Shoot[];
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [showAssign, setShowAssign] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { data: rawData, mutate } = useSWR<CampaignVendor[]>(
    `/api/campaign-vendors?campaignId=${campaignId}`,
    fetcher
  );
  const vendors = Array.isArray(rawData) ? rawData : [];

  async function handleRemove(cv: CampaignVendor) {
    const vendorName = cv.vendor?.companyName || "this vendor";
    const ok = confirm(
      `Remove ${vendorName} from this campaign?\n\nThis removes their current estimate/PO/invoice workflow from this campaign.`
    );
    if (!ok) return;

    setRemovingId(cv.id);
    try {
      const res = await fetch(`/api/campaign-vendors/${cv.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || "Failed to remove vendor");
      }
      toast("success", "Vendor removed from campaign");
      mutate();
    } catch (error) {
      toast(
        "error",
        error instanceof Error ? error.message : "Failed to remove vendor"
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {vendors.length === 0 ? (
        <p className="text-xs text-text-tertiary py-1">No vendors assigned yet.</p>
      ) : (
        vendors.map((cv) => {
          const statusColor = VENDOR_STATUS_COLORS[cv.status as keyof typeof VENDOR_STATUS_COLORS] ?? "bg-slate-100 text-slate-600";
          return (
            <div key={cv.id} className="flex items-center gap-3 py-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                <Users className="h-3.5 w-3.5 text-text-tertiary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {cv.vendor?.companyName ?? "Unknown Vendor"}
                </p>
                {cv.vendor?.category && (
                  <p className="text-[10px] text-text-tertiary">{cv.vendor.category}</p>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemove(cv)}
                  disabled={removingId !== null}
                  className="shrink-0 rounded p-1 text-text-tertiary hover:bg-surface-secondary hover:text-error transition-colors disabled:opacity-50"
                  title="Remove vendor from campaign"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
                {cv.status}
              </span>
            </div>
          );
        })
      )}

      {canEdit && (
        <button
          type="button"
          onClick={() => setShowAssign(true)}
          className="mt-1 inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Assign Vendor
        </button>
      )}

      <AssignVendorModal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        campaignId={campaignId}
        shoots={shoots}
        existingVendorIds={vendors.map((cv) => cv.vendorId)}
        onAssigned={() => { mutate(); setShowAssign(false); }}
      />
    </div>
  );
}

// ─── Assign Vendor Modal ──────────────────────────────────────────────────────

function AssignVendorModal({
  open,
  onClose,
  campaignId,
  shoots,
  existingVendorIds,
  onAssigned,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  shoots: Shoot[];
  existingVendorIds: string[];
  onAssigned: () => void;
}) {
  const { toast } = useToast();
  const { data: allVendors = [] } = useSWR<Vendor[]>(open ? "/api/vendors" : null, fetcher);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const shootDateOptions = useMemo(
    () =>
      shoots
        .flatMap((shoot) =>
          shoot.dates.map((date) => ({
            id: date.id,
            shootName: shoot.name,
            shootType: shoot.shootType,
            shootDate: date.shootDate,
            dateLabel: new Date(`${date.shootDate}T00:00:00`).toLocaleDateString(
              "en-US",
              {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              }
            ),
          }))
        )
        .sort((a, b) => a.shootDate.localeCompare(b.shootDate)),
    [shoots]
  );
  const shootDateIds = useMemo(
    () => shootDateOptions.map((option) => option.id),
    [shootDateOptions]
  );
  const [selectedShootDateIds, setSelectedShootDateIds] = useState<Set<string>>(
    () => new Set(shootDateIds)
  );

  useEffect(() => {
    if (!open) return;
    setAssigning(null);
    setSelectedVendorId(null);
    setSearch("");
    setSelectedShootDateIds(new Set(shootDateIds));
  }, [open, shootDateIds]);

  const available = allVendors
    .filter((v) => !existingVendorIds.includes(v.id))
    .filter((vendor) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        vendor.companyName.toLowerCase().includes(q) ||
        vendor.contactName.toLowerCase().includes(q) ||
        vendor.email.toLowerCase().includes(q) ||
        vendor.phone.toLowerCase().includes(q)
      );
    });
  const selectedVendor =
    available.find((vendor) => vendor.id === selectedVendorId) ?? null;

  function toggleShootDate(shootDateId: string) {
    setSelectedShootDateIds((current) => {
      const next = new Set(current);
      if (next.has(shootDateId)) {
        next.delete(shootDateId);
      } else {
        next.add(shootDateId);
      }
      return next;
    });
  }

  async function handleAssign() {
    if (!selectedVendor) return;
    setAssigning(selectedVendor.id);
    try {
      const payload: {
        campaignId: string;
        vendorId: string;
        assignedShootDateIds?: string[];
      } = {
        campaignId,
        vendorId: selectedVendor.id,
      };

      if (shootDateIds.length > 0) {
        const selectedIds = shootDateIds.filter((id) =>
          selectedShootDateIds.has(id)
        );
        // Omit when all days are selected so new future shoot dates remain included.
        if (selectedIds.length !== shootDateIds.length) {
          payload.assignedShootDateIds = selectedIds;
        }
      }

      const res = await fetch("/api/campaign-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast("success", "Vendor assigned");
      onAssigned();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setAssigning(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign Vendor" size="lg">
      {available.length === 0 ? (
        <EmptyState
          title="No available vendors"
          description={
            allVendors.length === 0
              ? "Add vendors to the roster first."
              : "All vendors are already assigned to this campaign."
          }
        />
      ) : (
        <div className="space-y-4">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by company, contact, email, or phone..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {available.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text-tertiary">
                No vendors match that search.
              </p>
            ) : (
              available.map((vendor) => (
                <button
                  key={vendor.id}
                  type="button"
                  onClick={() => setSelectedVendorId(vendor.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
                    selectedVendorId === vendor.id
                      ? "bg-primary/5"
                      : "hover:bg-surface-secondary"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {vendor.companyName}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {vendor.contactName}
                      {vendor.category && ` — ${vendor.category}`}
                    </p>
                  </div>
                  {selectedVendorId === vendor.id && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>

          {shootDateOptions.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border bg-surface-secondary p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                  Call Sheet Shoot Days (Optional)
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedShootDateIds(new Set(shootDateIds))}
                    className="rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                  >
                    All Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedShootDateIds(new Set())}
                    className="rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                  >
                    Post-Only
                  </button>
                </div>
              </div>
              <p className="text-xs text-text-tertiary">
                Keep all days selected for on-set coverage. Clear all for vendors
                that only work in post.
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-surface p-2">
                {shootDateOptions.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-surface-secondary transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedShootDateIds.has(option.id)}
                      onChange={() => toggleShootDate(option.id)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-xs text-text-primary">
                      {option.dateLabel}
                    </span>
                    <span className="text-[11px] text-text-tertiary ml-auto">
                      {option.shootName} · {option.shootType}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-text-tertiary">
                {selectedShootDateIds.size === 0
                  ? "Post-only: this vendor will not be added to shoot call sheets."
                  : selectedShootDateIds.size === shootDateIds.length
                  ? "All shoot days selected."
                  : `${selectedShootDateIds.size} shoot day${
                      selectedShootDateIds.size === 1 ? "" : "s"
                    } selected.`}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={assigning !== null}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              loading={assigning === selectedVendor?.id}
              disabled={!selectedVendor || assigning !== null}
            >
              Assign Vendor
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
