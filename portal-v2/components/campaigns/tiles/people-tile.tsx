"use client";

import { useState } from "react";
import useSWR from "swr";
import { Users, Plus, X } from "lucide-react";
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
  showVendors?: boolean;
  currentAd: AppUser | null;
  producers: AppUser[];
  allUsers: AppUser[];
  initialVendors?: CampaignVendor[];
  excludeUserId?: string;
  onAddProducer: (userId: string) => Promise<void>;
  onRemoveProducer: (userId: string) => Promise<void>;
  onAssignAD: (userId: string | null) => Promise<void>;
}

export function PeopleTile({
  campaignId,
  canEdit,
  isVendor,
  showVendors = true,
  currentAd,
  producers,
  allUsers,
  initialVendors,
  excludeUserId,
  onAddProducer,
  onRemoveProducer,
  onAssignAD,
}: Props) {
  if (isVendor) return null;

  return (
    <Card padding="none" className="h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">People</span>
        </div>
      </div>

      <div className={showVendors ? "grid grid-cols-2" : ""}>
        <div className={`space-y-2 px-3.5 py-3 ${showVendors ? "border-r border-border" : ""}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            Internal
          </p>
          <InternalTab
            currentAd={currentAd}
            producers={producers}
            allUsers={allUsers}
            canEdit={canEdit}
            excludeUserId={excludeUserId}
            onAddProducer={onAddProducer}
            onRemoveProducer={onRemoveProducer}
            onAssignAD={onAssignAD}
          />
        </div>

        {showVendors && (
          <div className="space-y-2 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Vendors
            </p>
            <VendorsTab campaignId={campaignId} canEdit={canEdit} initialVendors={initialVendors} />
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Internal Tab ─────────────────────────────────────────────────────────────

function InternalTab({
  currentAd,
  producers,
  allUsers,
  canEdit,
  excludeUserId,
  onAddProducer,
  onRemoveProducer,
  onAssignAD,
}: {
  currentAd: AppUser | null;
  producers: AppUser[];
  allUsers: AppUser[];
  canEdit: boolean;
  excludeUserId?: string;
  onAddProducer: (userId: string) => Promise<void>;
  onRemoveProducer: (userId: string) => Promise<void>;
  onAssignAD: (userId: string | null) => Promise<void>;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const assignedIds = [...producers.map((p) => p.id), currentAd?.id].filter(Boolean) as string[];
  const available = allUsers.filter(
    (u) =>
      (u.role === "Producer" || u.role === "Post Producer" || u.role === "Art Director") &&
      !assignedIds.includes(u.id) &&
      u.id !== excludeUserId
  );

  async function assign(user: AppUser) {
    setSaving(user.id);
    if (user.role === "Producer" || user.role === "Post Producer") await onAddProducer(user.id);
    else await onAssignAD(user.id);
    setSaving(null);
    setShowAssign(false);
  }

  async function removeProducer(userId: string) {
    setSaving(userId);
    await onRemoveProducer(userId);
    setSaving(null);
  }

  async function removeAD() {
    setSaving("AD");
    await onAssignAD(null);
    setSaving(null);
  }

  const people: { user: AppUser; role: "Producer" | "Art Director" }[] = [
    ...producers.map((p) => ({ user: p, role: "Producer" as const })),
    ...(currentAd ? [{ user: currentAd, role: "Art Director" as const }] : []),
  ];

  return (
    <div className="space-y-1.5">
      {people.length === 0 && (
        <p className="text-xs text-text-tertiary py-1">No internal people assigned.</p>
      )}
      {people.map(({ user, role }) => (
        <div key={user.id} className="group flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-2.5 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
            <p className="text-[10px] text-text-tertiary">{role}</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => role === "Producer" ? removeProducer(user.id) : removeAD()}
              disabled={saving === user.id || saving === "AD"}
              className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-surface-secondary transition-opacity text-text-tertiary hover:text-text-primary disabled:opacity-30"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}

      {canEdit && (
        <button
          type="button"
          onClick={() => setShowAssign(true)}
          className="mt-1 inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add person
        </button>
      )}

      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Add Person" size="lg">
        {available.length === 0 ? (
          <EmptyState
            title="No available people"
            description="All eligible Producers, Post Producers, and Art Directors are already assigned."
          />
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {available.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-surface-secondary transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">{u.name}</p>
                  <p className="text-xs text-text-tertiary">{u.role}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={saving === u.id}
                  disabled={saving !== null}
                  onClick={() => assign(u)}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Vendors Tab ──────────────────────────────────────────────────────────────

function VendorsTab({ campaignId, canEdit, initialVendors }: { campaignId: string; canEdit: boolean; initialVendors?: CampaignVendor[] }) {
  const { toast } = useToast();
  const [showAssign, setShowAssign] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const { data: rawData, mutate } = useSWR<CampaignVendor[]>(
    `/api/campaign-vendors?campaignId=${campaignId}`,
    fetcher,
    { fallbackData: initialVendors, revalidateOnMount: !initialVendors }
  );
  // Warm the vendor roster cache so AssignVendorModal opens instantly.
  useSWR<Vendor[]>(canEdit ? "/api/vendors" : null, fetcher);
  const vendors = Array.isArray(rawData) ? rawData : [];

  async function handleRemove(cvId: string) {
    setRemoving(cvId);
    try {
      const res = await fetch(`/api/campaign-vendors/${cvId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove vendor");
      await mutate();
      toast("success", "Vendor removed");
    } catch {
      toast("error", "Failed to remove vendor");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-2">
      {vendors.length === 0 ? (
        <p className="text-xs text-text-tertiary py-1">No vendors assigned yet.</p>
      ) : (
        <div className="space-y-1.5">
          {vendors.map((cv) => {
            const statusColor = VENDOR_STATUS_COLORS[cv.status as keyof typeof VENDOR_STATUS_COLORS] ?? "bg-slate-100 text-slate-600";
            return (
              <div key={cv.id} className="group flex items-center gap-2 rounded-md border border-border bg-surface-secondary/40 px-2.5 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {cv.vendor?.companyName ?? "Unknown Vendor"}
                  </p>
                  {(cv.campaignRole || cv.vendor?.category) && (
                    <p className="text-[10px] text-text-tertiary">{cv.campaignRole ?? cv.vendor?.category}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
                  {cv.status}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemove(cv.id)}
                    disabled={removing === cv.id}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-surface-secondary transition-opacity text-text-tertiary hover:text-text-primary disabled:opacity-30"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
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
