"use client";

import { use, useState, useRef } from "react";
import Link from "next/link";
import { useCampaign } from "@/hooks/use-campaigns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { CampaignDetailHeader } from "@/components/campaigns/campaign-detail-header";
import { ProductionCalendarTile } from "@/components/campaigns/tiles/production-calendar-tile";
import { ShootDayListTile } from "@/components/campaigns/tiles/shoot-day-list-tile";
import { ShootDayModal } from "@/components/campaigns/shoot-day-modal";
import { ShotListTile } from "@/components/campaigns/tiles/shot-list-tile";
import { DocumentsTabTile } from "@/components/campaigns/tiles/documents-tab-tile";
import { InventoryTile } from "@/components/campaigns/tiles/inventory-tile";
import { AddSetupDrawer } from "@/components/campaigns/add-setup-drawer";
import { LinkProductDrawer } from "@/components/campaigns/link-product-drawer";
import { LinkGearDrawer } from "@/components/campaigns/link-gear-drawer";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { PeopleTile } from "@/components/campaigns/tiles/people-tile";
import { BudgetSidebarTile } from "@/components/campaigns/tiles/budget-sidebar-tile";
import { CampaignSectionTabs } from "@/components/campaigns/campaign-section-tabs";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils/format";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ShoppingBasket, Wrench, Plus, DollarSign, Bell, AlertCircle, Calendar, X, Mail, Trash2 } from "lucide-react";
import { ShotListModal } from "@/components/campaigns/shot-list-modal";
import useSWR from "swr";
import type { AppUser } from "@/types/domain";
const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Request failed"); return r.json(); });
import type { CampaignStatus } from "@/types/domain";
import { DraftEmailModal } from "@/components/campaigns/draft-email-modal";
import { StatusDropdown } from "@/components/campaigns/status-dropdown";

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const {
    campaign,
    shoots,
    deliverables,
    financials,
    setups,
    campaignProducts,
    campaignGear,
    vendors,
    crewBookings,
    isLoading,
    mutate,
  } = useCampaign(id);
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const assetsDueDateRef = useRef<HTMLInputElement>(null);

  // Selected shoot day for modal
  const [selectedShootId, setSelectedShootId] = useState<string | null>(null);
  const [sameCrew, setSameCrew] = useState(true);
  const [sameLocation, setSameLocation] = useState(false);

  // Modal / drawer state
  const [showOverageRequest, setShowOverageRequest] = useState(false);
  const [overageAmount, setOverageAmount] = useState("");
  const [overageRationale, setOverageRationale] = useState("");
  const [submittingOverage, setSubmittingOverage] = useState(false);
  const [showAddSetup, setShowAddSetup] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddProps, setShowAddProps] = useState(false);
  const [showAddGear, setShowAddGear] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Draft email modal
  const [showDraftEmail, setShowDraftEmail] = useState(false);
  const [showShotListModal, setShowShotListModal] = useState(false);
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(`dismissed-notifs-${id}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });


  // Permissions
  const canEdit = user?.role === "Admin" || user?.role === "Producer" || user?.role === "Post Producer";
  const canEditShots = canEdit || user?.role === "Art Director";
  const canCompleteShots = canEdit || user?.role === "Art Director" || user?.role === "Studio";
  const isAdmin = user?.role === "Admin";
  const canDelete = user?.role === "Admin" || user?.role === "Producer" || user?.role === "Post Producer";
  const isVendor = user?.role === "Vendor";
  const isArtDirector = user?.role === "Art Director";
  const showFinancials =
    user?.role === "Admin" ||
    user?.role === "Producer" ||
    user?.role === "Post Producer";
  const showVendors = showFinancials;

  // Fetch users for producer name + AD picker (needed for non-vendor roles)
  const { data: allUsers = [] } = useSWR<AppUser[]>(
    !isVendor ? "/api/users" : null,
    fetcher
  );

  // Handlers
  async function handleStatusChange(newStatus: CampaignStatus) {
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const message = await res.text().catch(() => res.statusText);
        throw new Error(message || "Failed to change status");
      }
      toast("success", `Status changed to ${newStatus}`);
      mutate();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Failed to change status");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast("success", "Campaign deleted");
      router.push("/campaigns");
    } catch {
      toast("error", "Failed to delete campaign");
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpdate(field: string, value: string | number | null) {
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const message = await res.text().catch(() => res.statusText);
        throw new Error(message || "Failed to update");
      }
      mutate();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Failed to update");
    }
  }

  async function handleFileUpload(file: File, category: string) {
    const MAX_SIZE = 100 * 1024 * 1024;
    const ALLOWED_TYPES = [
      "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain", "text/csv",
      "video/mp4", "video/quicktime", "video/x-msvideo",
      "application/zip",
    ];
    if (file.size > MAX_SIZE) {
      toast("error", `File too large — max 100MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast("error", "File type not supported. Use PDF, image, Office doc, or video.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignId", id);
      formData.append("category", category);
      const res = await fetch("/api/files", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      toast("success", `${file.name} uploaded`);
      mutate();
    } catch {
      toast("error", "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) return <DashboardSkeleton />;
  if (!campaign) {
    return (
      <EmptyState
        title="Campaign not found"
        description="This campaign may have been deleted or you don't have access."
      />
    );
  }

  const producers = allUsers.filter((u) => (campaign.producerIds ?? []).includes(u.id));

  const artDirector = campaign.artDirectorId
    ? allUsers.find((u) => u.id === campaign.artDirectorId)
    : null;

  const artDirectorUsers = allUsers.filter((u) => u.role === "Art Director");

  const activeVendorIds = new Set(
    vendors.filter((cv) => cv.status !== "Rejected").map((cv) => cv.vendorId)
  );
  const vendorUsers = allUsers.filter(
    (u) => u.vendorId && activeVendorIds.has(u.vendorId)
  );

  // Compute attention items for Campaign Info
  const attentionItems: { label: string; context?: string }[] = [];
  if (showFinancials) {
    const estimatePending = vendors.filter((v) => v.status === "Estimate Submitted");
    const invoicePending = vendors.filter(
      (v) => v.status === "Invoice Submitted" || v.status === "Invoice Pre-Approved"
    );
    for (const v of estimatePending) {
      attentionItems.push({
        label: "Estimate ready to review",
        context: v.vendor?.companyName,
      });
    }
    for (const v of invoicePending) {
      attentionItems.push({
        label: "Invoice needs review",
        context: v.vendor?.companyName,
      });
    }
    // Crew booking attention items
    const pendingBookings = crewBookings.filter((b) => b.status === "Pending Approval");
    const unconfirmedBookings = crewBookings.filter(
      (b) => b.status === "Confirmed" && b.dates.some((d) => d.confirmed === null)
    );
    if (pendingBookings.length > 0) {
      attentionItems.push({
        label: `${pendingBookings.length} crew booking${pendingBookings.length !== 1 ? "s" : ""} pending approval`,
      });
    }
    if (unconfirmedBookings.length > 0) {
      attentionItems.push({
        label: `${unconfirmedBookings.length} crew member${unconfirmedBookings.length !== 1 ? "s" : ""} need day confirmation`,
      });
    }

    if (campaign.assetsDeliveryDate) {
      const due = new Date(campaign.assetsDeliveryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) {
        attentionItems.push({ label: "Assets delivery date has passed" });
      } else if (daysUntil <= 7) {
        attentionItems.push({ label: `Assets due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}` });
      }
    }
  }

  function dismissNotif(key: string) {
    const next = new Set(dismissedNotifs);
    next.add(key);
    setDismissedNotifs(next);
    localStorage.setItem(`dismissed-notifs-${id}`, JSON.stringify([...next]));
  }

  const visibleAttentionItems = attentionItems.filter(
    (item) => !dismissedNotifs.has(item.label + (item.context ?? ""))
  );

  const allShots = setups.flatMap((s) => s.shots);

  const allDates = shoots.flatMap((s) =>
    s.dates.map((d) => ({ ...d, shootName: s.name, shootType: s.shootType }))
  );
  const assetsDueDate = campaign.assetsDeliveryDate ? parseISO(campaign.assetsDeliveryDate) : null;
  const assetsDueLabel = assetsDueDate
    ? format(assetsDueDate, "MMM d, yyyy").toUpperCase()
    : "Set Date";

  return (
    <div className="space-y-1 -mt-3">
      <div className="relative">
      <CampaignDetailHeader
        campaign={campaign}
        canEdit={canEdit}
        canDelete={false}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        deleting={deleting}
        onUpdate={handleUpdate}
      />

      <div className="flex flex-col gap-1 md:flex-row md:flex-wrap md:items-center">
        {/* Top-right actions collapse first on mobile, then align right on desktop */}
        <div className="order-1 flex w-full flex-wrap items-center gap-2 md:order-2 md:ml-auto md:w-auto md:justify-end md:shrink-0 md:absolute md:right-0 md:bottom-0">
          <div className="flex flex-col items-end gap-0">
            <div className="flex gap-0">
              <button
                type="button"
                onClick={() => setShowDraftEmail(true)}
                title="Draft Email"
                className="inline-flex h-6 w-6 items-center justify-center text-text-tertiary hover:text-text-primary"
              >
                <Mail className="h-3.5 w-3.5" />
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Delete campaign"
                  className="inline-flex h-6 w-6 items-center justify-center text-text-tertiary hover:text-error"
                >
                  <Trash2 className="h-3.5 w-3.5 -translate-y-px" />
                </button>
              )}
            </div>
            <div className="min-w-[9.5rem] md:min-w-0">
              <StatusDropdown
                status={campaign.status}
                onStatusChange={canEdit && campaign.status !== "Cancelled" ? handleStatusChange : undefined}
                disabled={!canEdit || campaign.status === "Cancelled"}
              />
            </div>
          </div>
          {(showFinancials || campaign.assetsDeliveryDate) && (
            <button
              type="button"
              className={`relative inline-flex min-h-11 flex-1 items-center gap-2.5 rounded-lg border border-border px-3.5 py-2 transition-colors md:min-h-0 md:flex-none ${
                canEdit ? "cursor-pointer hover:bg-surface-secondary" : ""
              }`}
              onClick={() => canEdit && assetsDueDateRef.current?.showPicker()}
              title={campaign.assetsDeliveryDate ? "Assets due date" : "Set assets due date"}
            >
              <Calendar className="h-5 w-5 shrink-0 text-primary" />
              <span className="flex min-w-0 flex-col gap-0.5 leading-none">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">Assets Due</span>
                <span className="truncate text-base font-bold text-primary">
                  {assetsDueLabel}
                </span>
              </span>
              {canEdit && (
                <input
                  ref={assetsDueDateRef}
                  type="date"
                  value={campaign.assetsDeliveryDate ?? ""}
                  onChange={(e) => handleUpdate("assetsDeliveryDate", e.target.value || null)}
                  className="pointer-events-none absolute inset-0 w-0 opacity-0"
                />
              )}
            </button>
          )}
        </div>

        {/* Section tab nav — Brief / Asset Studio / Pre-Production all live behind tabs */}
        {!isVendor && (
          <div className="order-2 min-w-0 w-full md:order-1 md:flex-1">
            <CampaignSectionTabs campaignId={id} />
          </div>
        )}
      </div>
      </div>

      {/* === ROW 1: Calendar + Shoot Days | Documents | Budget === */}
      <div className={`grid grid-cols-1 items-stretch gap-4 ${isVendor ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>

        {/* Calendar + Shoot Days */}
        <div className="lg:col-span-2 min-h-0 h-full lg:max-h-[22rem]">
          <div className="flex items-stretch gap-4 min-h-0 h-full">
            <div className="shrink-0 h-full">
              <ProductionCalendarTile
                shoots={shoots}
                campaignId={id}
                wfNumber={campaign.wfNumber}
                canEdit={canEdit}
                onMutate={mutate}
                onDayClick={(shoot) => setSelectedShootId(shoot.id)}
              />
            </div>
            <div className="flex-1 min-w-0 min-h-0 h-full">
              <ShootDayListTile
                shoots={shoots}
                wfNumber={campaign.wfNumber}
                canEdit={canEdit}
                sameCrew={sameCrew}
                onSameCrewChange={setSameCrew}
                sameLocation={sameLocation}
                onSameLocationChange={setSameLocation}
                onDayClick={(shoot) => setSelectedShootId(shoot.id)}
                onMutate={mutate}
              />
            </div>
          </div>
        </div>

        {/* Documents (tabbed) */}
        <div className="min-h-0 h-full lg:max-h-[22rem]">
          <DocumentsTabTile
            campaignId={id}
            isVendor={isVendor}
            canEdit={canEdit}
            uploading={uploading}
            onUpload={handleFileUpload}
            hideAdminDocs={isArtDirector}
          />
        </div>

        {/* Budget / Inventory (vendors see inventory here instead) */}
        <div className={`min-h-0 h-full lg:max-h-[22rem] ${isVendor ? "lg:col-span-2" : ""}`}>
          {showFinancials && (
            <CollapsibleSection
              id={`campaign-${id}-budget-sidebar`}
              title="Budget"
              icon={DollarSign}
              defaultExpanded={true}
              className="h-full"
            >
              <BudgetSidebarTile
                campaignId={id}
                financials={financials}
                vendors={vendors}
                canEdit={canEdit}
                onRequestOverage={() => setShowOverageRequest(true)}
              />
            </CollapsibleSection>
          )}
          {isVendor && (
            <InventoryTile
              campaignProducts={campaignProducts}
              campaignGear={campaignGear}
              canEdit={false}
              onAddProduct={() => {}}
              onAddProps={() => {}}
              onAddGear={() => {}}
            />
          )}
        </div>
      </div>

      {/* === ONE-LINER (full width, just below Row 1) === */}
      <ShotListTile
        campaignId={id}
        setups={setups}
        deliverables={deliverables}
        campaignProducts={campaignProducts}
        wfNumber={campaign.wfNumber ?? undefined}
        firstShootDate={allDates[0]?.shootDate}
        canEditShots={canEditShots}
        canCompleteShots={canCompleteShots}
        onSetMode={false}
        campaignStatus={campaign.status}
        onAddSetup={() => setShowAddSetup(true)}
        onMutate={mutate}
        onViewFullList={isVendor ? () => setShowShotListModal(true) : undefined}
      />

      {/* === ROW 2: People | Inventory === */}
      <div className={`grid grid-cols-1 gap-4 items-stretch ${isVendor ? "" : "lg:grid-cols-2"}`}>
        <div>
          <PeopleTile
            campaignId={id}
            canEdit={canEdit}
            isVendor={isVendor}
            showVendors={showVendors}
            currentAd={artDirector ?? null}
            producers={producers}
            allUsers={allUsers}
            excludeUserId={user?.id}
            onAddProducer={async (userId) => {
              await fetch(`/api/campaigns/${id}/producers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
              });
              mutate();
            }}
            onRemoveProducer={async (userId) => {
              await fetch(`/api/campaigns/${id}/producers/${userId}`, { method: "DELETE" });
              mutate();
            }}
            onAssignAD={async (userId) => { await handleUpdate("artDirectorId", userId); }}
          />
        </div>
        {!isVendor && (
          <InventoryTile
            campaignProducts={campaignProducts}
            campaignGear={campaignGear}
            canEdit={canEdit}
            onAddProduct={() => setShowAddProduct(true)}
            onAddProps={() => setShowAddProps(true)}
            onAddGear={() => setShowAddGear(true)}
            onMutate={mutate}
          />
        )}
      </div>

      {/* Shoot Day Modal */}
      <ShootDayModal
        shoot={shoots.find((s) => s.id === selectedShootId) ?? null}
        allShoots={shoots}
        open={!!selectedShootId}
        wfNumber={campaign.wfNumber}
        canEdit={canEdit}
        campaignId={id}
        sameCrew={sameCrew}
        sameLocation={sameLocation}
        campaignPeople={[...producers, ...(artDirector ? [artDirector] : []), ...vendorUsers]}
        campaignVendors={vendors}
        producerRoles={campaign.producerRoles ?? {}}
        onClose={() => setSelectedShootId(null)}
        onMutate={mutate}
      />

      {/* Modals & Drawers */}
      <AddSetupDrawer
        open={showAddSetup}
        onClose={() => setShowAddSetup(false)}
        campaignId={id}
        onAdded={() => { setShowAddSetup(false); mutate(); }}
      />

      <LinkProductDrawer
        open={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        campaignId={id}
        onLinked={() => { setShowAddProduct(false); mutate(); }}
      />

      <LinkGearDrawer
        open={showAddProps}
        onClose={() => setShowAddProps(false)}
        campaignId={id}
        section="Props"
        onLinked={() => { setShowAddProps(false); mutate(); }}
      />
      <LinkGearDrawer
        open={showAddGear}
        onClose={() => setShowAddGear(false)}
        campaignId={id}
        onLinked={() => { setShowAddGear(false); mutate(); }}
      />

      {/* Shot List Modal (vendors) */}
      <ShotListModal
        open={showShotListModal}
        onClose={() => setShowShotListModal(false)}
        campaignName={campaign.name}
        wfNumber={campaign.wfNumber}
        setups={setups}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Campaign"
        size="sm"
      >
        <p className="text-base text-text-secondary">
          Are you sure you want to delete <strong>{campaign.name}</strong>?
          This will remove all shoots, vendor assignments, deliverables, and
          files associated with this campaign. This cannot be undone.
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleting}
            onClick={() => { handleDelete(); setShowDeleteConfirm(false); }}
          >
            Delete Campaign
          </Button>
        </ModalFooter>
      </Modal>

      {/* Draft Email Modal */}
      <DraftEmailModal
        open={showDraftEmail}
        onClose={() => setShowDraftEmail(false)}
        campaign={campaign}
        shoots={shoots}
        vendors={vendors}
        showFinancials={showFinancials}
        financials={financials}
      />

      {/* Overage Request Modal — available from both tabs */}
      <Modal
        open={showOverageRequest}
        onClose={() => setShowOverageRequest(false)}
        title="Request Budget Overage"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!overageAmount || !overageRationale) return;
            setSubmittingOverage(true);
            try {
              const res = await fetch("/api/budget/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignId: id, amount: Number(overageAmount), rationale: overageRationale }),
              });
              if (!res.ok) throw new Error("Failed");
              toast("success", "Overage request submitted");
              setShowOverageRequest(false);
              setOverageAmount("");
              setOverageRationale("");
              mutate();
            } catch {
              toast("error", "Failed to submit request");
            } finally {
              setSubmittingOverage(false);
            }
          }}
          className="space-y-4"
        >
          <p className="text-sm text-text-secondary">
            Current budget: {formatCurrency(financials.budget)} · Remaining: {formatCurrency(financials.remaining)}
          </p>
          <div>
            <Input
              label="Additional Amount Needed"
              type="number"
              min={1}
              step="1"
              placeholder="0"
              value={overageAmount}
              onChange={(e) => setOverageAmount(e.target.value)}
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {overageAmount && Number(overageAmount) > 0 && (
              <p className="mt-1.5 text-xs text-text-secondary">
                New total if approved:{" "}
                <span className="font-semibold text-success">
                  {formatCurrency(financials.committed + Number(overageAmount))}
                </span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-base font-medium text-text-primary mb-1.5">
              Rationale
            </label>
            <textarea
              value={overageRationale}
              onChange={(e) => setOverageRationale(e.target.value)}
              placeholder="Why is the additional budget needed?"
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none resize-none"
            />
          </div>
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setShowOverageRequest(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submittingOverage}>
              Submit Request
            </Button>
          </ModalFooter>
        </form>
      </Modal>

    </div>
  );
}
