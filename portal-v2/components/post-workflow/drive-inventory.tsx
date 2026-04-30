"use client";

import { useState } from "react";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import type { AppUser, MediaDrive, DriveCheckoutSession, DriveCheckoutItem } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckoutDrivesModal } from "./checkout-drives-modal";
import { ProcessReturnModal } from "./process-return-modal";
import { AddDriveModal } from "./add-drive-modal";
import { DRIVE_SIZES } from "@/lib/constants/edit-rooms";
import {
  HardDrive,
  Plus,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); });

interface Props {
  user: AppUser;
}

const STATUS_STYLE: Record<string, string> = {
  Available: "bg-emerald-100 text-success",
  Reserved: "bg-blue-100 text-blue-700",
  "Checked Out": "bg-amber-100 text-warning",
  "Pending Backup/Wipe": "bg-orange-100 text-warning",
  Retired: "bg-red-100 text-error",
};

const ROLE_STYLE: Record<string, { label: string; style: string }> = {
  shooter: { label: "Shooter", style: "bg-blue-100 text-blue-700" },
  media_manager: { label: "Media Mgr", style: "bg-violet-100 text-violet-700" },
};

function RetirementChip({ drive }: { drive: MediaDrive }) {
  if (drive.pastRetirement) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-error">
        <AlertTriangle className="h-3 w-3" />
        Past Retirement
      </span>
    );
  }
  if (drive.nearingRetirement) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-warning">
        <AlertTriangle className="h-3 w-3" />
        Retiring Soon
      </span>
    );
  }
  return null;
}

export function DriveInventory({ user }: Props) {
  const [statusFilter, setStatusFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAddDrive, setShowAddDrive] = useState(false);
  const [returnItem, setReturnItem] = useState<{ session: DriveCheckoutSession; item: DriveCheckoutItem } | null>(null);
  const [activeCheckoutsOpen, setActiveCheckoutsOpen] = useState(true);

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (sizeFilter) params.set("size", sizeFilter);

  const { data: drives, mutate: mutateDrives, isLoading: isLoadingDrives } = useSWR<MediaDrive[]>(
    `/api/post-workflow/drives?${params.toString()}`,
    fetcher
  );
  const { data: sessions, mutate: mutateSessions } = useSWR<DriveCheckoutSession[]>(
    "/api/post-workflow/drive-checkouts?status=active",
    fetcher
  );
  const { data: partialSessions, mutate: mutatePartial } = useSWR<DriveCheckoutSession[]>(
    "/api/post-workflow/drive-checkouts?status=partial_return",
    fetcher
  );
  const { data: campaigns } = useSWR<any[]>("/api/campaigns", fetcher);

  const driveList = Array.isArray(drives) ? drives : [];
  const activeSessions = [
    ...(Array.isArray(sessions) ? sessions : []),
    ...(Array.isArray(partialSessions) ? partialSessions : []),
  ];
  const campaignList = Array.isArray(campaigns)
    ? campaigns.map((c: any) => ({ id: c.id, wfNumber: c.wfNumber ?? c.wf_number, name: c.name }))
    : [];

  function refresh() {
    mutateDrives();
    mutateSessions();
    mutatePartial();
  }

  const canWrite = ["Admin", "Producer", "Post Producer"].includes(user.role);

  const statusOptions = [
    { value: "", label: "All statuses" },
    { value: "Available", label: "Available" },
    { value: "Checked Out", label: "Checked Out" },
    { value: "Pending Backup/Wipe", label: "Pending Backup/Wipe" },
    { value: "Reserved", label: "Reserved" },
    { value: "Retired", label: "Retired" },
  ];

  const sizeOptions = [
    { value: "", label: "All sizes" },
    ...DRIVE_SIZES.map((s) => ({ value: s, label: s })),
  ];

  return (
    <div className="space-y-4">
      {/* Active checkouts */}
      {activeSessions.length > 0 && (
        <Card padding="none">
          <button
            className="flex w-full items-center gap-2 border-b border-border px-3.5 py-2.5"
            onClick={() => setActiveCheckoutsOpen((v) => !v)}
          >
            <RotateCcw className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="flex-1 text-left text-sm font-semibold uppercase tracking-wider text-text-primary">
              Active Checkouts
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-warning">
                {activeSessions.length}
              </span>
            </h3>
            {activeCheckoutsOpen ? (
              <ChevronDown className="h-4 w-4 text-text-tertiary" />
            ) : (
              <ChevronRight className="h-4 w-4 text-text-tertiary" />
            )}
          </button>
          {activeCheckoutsOpen && (
            <div className="divide-y divide-border-light p-3 space-y-3">
              {activeSessions.map((session) => (
                <div key={session.id} className="rounded-lg border border-border bg-surface-secondary p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {session.projectDisplayName ?? session.campaign?.wfNumber ?? "No campaign"}
                      </p>
                      {session.shootDate && (
                        <p className="text-xs text-text-tertiary">
                          Shoot: {format(parseISO(session.shootDate), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      session.status === "partial_return" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-warning"
                    }`}>
                      {session.status === "partial_return" ? "Partial Return" : "Active"}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {(session.items ?? []).map((item) => {
                      const roleInfo = ROLE_STYLE[item.checkoutRole];
                      const returned = !!item.returnedAt;
                      // Shooter locked until MM return confirmed
                      const mmItem = session.items?.find((i) => i.checkoutRole === "media_manager");
                      const shooterLocked = item.checkoutRole === "shooter" && !(mmItem?.dataOffloadedBackedUp && mmItem?.returnedAt);

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between rounded-md px-3 py-2 ${
                            returned ? "bg-surface opacity-50" : "bg-surface"
                          } border border-border`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <HardDrive className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-text-primary">
                                {item.drive?.brand} {item.drive?.model ?? ""} · {item.drive?.storageSize}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${roleInfo.style}`}>
                                  {roleInfo.label}
                                </span>
                                {returned && (
                                  <span className="text-[10px] text-success font-medium">Returned</span>
                                )}
                                {shooterLocked && !returned && (
                                  <span className="text-[10px] text-text-tertiary">Waiting for backup</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {!returned && canWrite && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReturnItem({ session, item })}
                              disabled={shooterLocked}
                              className="shrink-0 text-xs"
                            >
                              Process Return
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Inventory */}
      <Card padding="none">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
              Drive Inventory
            </h3>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <Select options={statusOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
            <Select options={sizeOptions} value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} />
            {canWrite && (
              <>
                <Button variant="primary" size="sm" onClick={() => setShowCheckout(true)}>
                  <Plus className="h-4 w-4" />
                  Check Out
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddDrive(true)}>
                  <Plus className="h-4 w-4" />
                  Add Drive
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        {isLoadingDrives ? null : driveList.length === 0 ? (
          <EmptyState title="No drives found" description="Adjust filters or add a drive." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-secondary text-left">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Drive</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Size</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Type</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Condition</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Location</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Purchased</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Retires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {driveList.map((drive) => (
                  <tr key={drive.id} className={`hover:bg-surface-secondary/50 ${drive.pastRetirement ? "bg-red-50/30" : drive.nearingRetirement ? "bg-orange-50/30" : ""}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 shrink-0 text-text-tertiary" />
                        <div>
                          <p className="font-medium text-text-primary">{drive.brand} {drive.model ?? ""}</p>
                          {drive.isPermanentlyAssigned && drive.assignedToUserName && (
                            <p className="text-[11px] text-text-tertiary">Assigned: {drive.assignedToUserName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{drive.storageSize}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{drive.driveType}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        drive.condition === "Good" ? "bg-emerald-50 text-success" :
                        drive.condition === "Fair" ? "bg-amber-50 text-warning" :
                        drive.condition === "Poor" ? "bg-orange-50 text-warning" :
                        "bg-red-50 text-error"
                      }`}>
                        {drive.condition}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[drive.status] ?? "bg-surface-secondary text-text-secondary"}`}>
                        {drive.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{drive.location}</td>
                    <td className="px-4 py-2.5 text-text-secondary">
                      {drive.purchaseDate ? format(parseISO(drive.purchaseDate), "MMM d, yyyy") : "Unknown"}
                    </td>
                    <td className="px-4 py-2.5">
                      {drive.retirementDate ? (
                        <div className="space-y-1">
                          <p className={`text-[11px] ${drive.pastRetirement ? "text-error font-semibold" : drive.nearingRetirement ? "text-warning font-medium" : "text-text-secondary"}`}>
                            {format(parseISO(drive.retirementDate), "MMM d, yyyy")}
                          </p>
                          <RetirementChip drive={drive} />
                        </div>
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CheckoutDrivesModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        campaigns={campaignList}
        onSuccess={refresh}
      />
      <AddDriveModal
        open={showAddDrive}
        onClose={() => setShowAddDrive(false)}
        onSuccess={refresh}
      />
      {returnItem && (
        <ProcessReturnModal
          open
          onClose={() => setReturnItem(null)}
          session={returnItem.session}
          item={returnItem.item}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
