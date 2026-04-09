"use client";

import { useState } from "react";
import useSWR from "swr";
import { Users, UserCircle, Plus, Check, X, Palette } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { VENDOR_STATUS_COLORS } from "@/lib/constants/statuses";
import type { AppUser, CampaignVendor, Vendor } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  campaignId: string;
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
  const [activeTab, setActiveTab] = useState<"internal" | "vendors">("internal");

  if (isVendor) return null;

  return (
    <Card padding="none">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">People</span>
        </div>
        {/* Tab pills */}
        <div className="flex items-center gap-1 bg-surface-secondary rounded-md p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("internal")}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              activeTab === "internal"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Internal
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("vendors")}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              activeTab === "vendors"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Vendors
          </button>
        </div>
      </div>

      <div className="px-3.5 py-3">
        {activeTab === "internal" ? (
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
        ) : (
          <VendorsTab campaignId={campaignId} canEdit={canEdit} />
        )}
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Producer row */}
      {producer && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 p-2">
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
      <div className="rounded-md border border-border bg-surface-secondary/40 p-2">
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

function VendorsTab({ campaignId, canEdit }: { campaignId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [showAssign, setShowAssign] = useState(false);
  const { data: rawData, mutate } = useSWR<CampaignVendor[]>(
    `/api/campaign-vendors?campaignId=${campaignId}`,
    fetcher
  );
  const vendors = Array.isArray(rawData) ? rawData : [];

  return (
    <div className="space-y-2">
      {vendors.length === 0 ? (
        <p className="text-xs text-text-tertiary py-1">No vendors assigned yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {vendors.map((cv) => {
          const statusColor = VENDOR_STATUS_COLORS[cv.status as keyof typeof VENDOR_STATUS_COLORS] ?? "bg-slate-100 text-slate-600";
          return (
            <div key={cv.id} className="flex items-center gap-3 rounded-md border border-border bg-surface-secondary/40 p-2">
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
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
                {cv.status}
              </span>
            </div>
          );
          })}
        </div>
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
  existingVendorIds,
  onAssigned,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  existingVendorIds: string[];
  onAssigned: () => void;
}) {
  const { toast } = useToast();
  const { data: allVendors = [] } = useSWR<Vendor[]>(open ? "/api/vendors" : null, fetcher);
  const [assigning, setAssigning] = useState<string | null>(null);

  const available = allVendors.filter((v) => !existingVendorIds.includes(v.id));

  async function handleAssign(vendorId: string) {
    setAssigning(vendorId);
    try {
      const res = await fetch("/api/campaign-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, vendorId }),
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
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {available.map((vendor) => (
            <div
              key={vendor.id}
              className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-surface-secondary transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">{vendor.companyName}</p>
                <p className="text-xs text-text-tertiary">
                  {vendor.contactName}
                  {vendor.category && ` — ${vendor.category}`}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                loading={assigning === vendor.id}
                disabled={assigning !== null}
                onClick={() => handleAssign(vendor.id)}
              >
                Assign
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
