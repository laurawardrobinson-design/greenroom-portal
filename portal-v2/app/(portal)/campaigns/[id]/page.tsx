"use client";

import { use, useState, useRef } from "react";
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
import { formatCurrency } from "@/lib/utils/format";
import { ShotListTile } from "@/components/campaigns/tiles/shot-list-tile";
import { DocumentsTile } from "@/components/campaigns/tiles/documents-tile";
import { AddSetupDrawer } from "@/components/campaigns/add-setup-drawer";
import { LinkProductDrawer } from "@/components/campaigns/link-product-drawer";
import { LinkGearDrawer } from "@/components/campaigns/link-gear-drawer";
import { VendorAssignmentPanel, type VendorAssignmentPanelHandle } from "@/components/campaigns/vendor-assignment-panel";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { CrewBookingsTile } from "@/components/campaigns/tiles/crew-bookings-tile";
import { BookCrewDrawer } from "@/components/campaigns/book-crew-drawer";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ShoppingBasket, Wrench, Plus, DollarSign, Mail, Bell, Users, AlertCircle, Calendar, ChevronDown, X, UserCircle, Info, HardHat, Palette, Check } from "lucide-react";
import { BudgetSidebarTile } from "@/components/campaigns/tiles/budget-sidebar-tile";
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

  const vendorPanelRef = useRef<VendorAssignmentPanelHandle>(null);
  const assetsDueDateRef = useRef<HTMLInputElement>(null);

  // Selected shoot day for modal
  const [selectedShootId, setSelectedShootId] = useState<string | null>(null);

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  function startNotesEdit() {
    setNotesValue(campaign?.notes ?? "");
    setEditingNotes(true);
  }

  async function saveNotes() {
    await handleUpdate("notes", notesValue || null);
    setEditingNotes(false);
  }

  // Modal / drawer state
  const [showOverageRequest, setShowOverageRequest] = useState(false);
  const [overageAmount, setOverageAmount] = useState("");
  const [overageRationale, setOverageRationale] = useState("");
  const [submittingOverage, setSubmittingOverage] = useState(false);
  const [showAddSetup, setShowAddSetup] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddGear, setShowAddGear] = useState(false);
  const [showBookCrew, setShowBookCrew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Draft email modal
  const [showDraftEmail, setShowDraftEmail] = useState(false);
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(`dismissed-notifs-${id}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });


  // Permissions
  const canEdit = user?.role === "Admin" || user?.role === "Producer";
  const canEditShots = canEdit || user?.role === "Art Director";
  const canCompleteShots = canEdit || user?.role === "Art Director" || user?.role === "Studio";
  const isAdmin = user?.role === "Admin";
  const isVendor = user?.role === "Vendor";
  const isArtDirector = user?.role === "Art Director";
  const showFinancials = !isVendor && !isArtDirector;

  // Fetch users for producer name + AD picker (needed for non-vendor roles)
  const { data: allUsers = [] } = useSWR<AppUser[]>(
    !isVendor ? "/api/users" : null,
    fetcher
  );

  // Handlers
  async function handleStatusChange(newStatus: CampaignStatus) {
    try {
      await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      toast("success", `Status changed to ${newStatus}`);
      mutate();
    } catch {
      toast("error", "Failed to change status");
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
      await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      mutate();
    } catch {
      toast("error", "Failed to update");
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

  const producer = campaign.producerId
    ? allUsers.find((u) => u.id === campaign.producerId)
    : null;

  const artDirector = campaign.artDirectorId
    ? allUsers.find((u) => u.id === campaign.artDirectorId)
    : null;

  const artDirectorUsers = allUsers.filter((u) => u.role === "Art Director");

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

  return (
    <div className="space-y-2 -mt-3">
      {/* Header + logline + top-right actions */}
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-1">
        <CampaignDetailHeader
          campaign={campaign}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          deleting={deleting}
          onUpdate={handleUpdate}
        />

        {/* Logline — no box, aligned under title */}
        {(campaign.notes || canEdit) && (
          <div className="pl-11 max-w-xl">
            {editingNotes ? (
              <textarea
                autoFocus
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                onBlur={saveNotes}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setNotesValue(campaign.notes ?? "");
                    setEditingNotes(false);
                  }
                }}
                rows={1}
                placeholder="Add a logline — one sentence about what this campaign is and why it exists."
                className="w-full text-sm text-text-secondary bg-transparent focus:outline-none resize-none"
              />
            ) : campaign.notes ? (
              <p
                className={`text-sm text-text-secondary leading-relaxed whitespace-pre-wrap ${canEdit && campaign.status !== "Cancelled" ? "cursor-pointer hover:text-text-primary transition-colors" : ""}`}
                onClick={() => { if (canEdit && campaign.status !== "Cancelled") startNotesEdit(); }}
              >
                {campaign.notes}
              </p>
            ) : (
              <p
                className="text-sm text-text-tertiary italic cursor-pointer hover:text-text-secondary transition-colors"
                onClick={startNotesEdit}
              >
                Add a logline — one sentence about what this campaign is and why it exists.
              </p>
            )}
          </div>
        )}
        </div>

        {/* Status + Assets Due — top right */}
        <div className="shrink-0 space-y-2 pt-1">
          {/* Row 1: Planning + Mail — aligned with WF number */}
          <div className="flex items-center justify-end gap-2">
            <StatusDropdown
              status={campaign.status}
              onStatusChange={canEdit && campaign.status !== "Cancelled" ? handleStatusChange : undefined}
              disabled={!canEdit || campaign.status === "Cancelled"}
            />
            <button
              type="button"
              onClick={() => setShowDraftEmail(true)}
              title="Draft Email"
              className="flex items-center justify-center rounded-lg border border-border p-1.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors shrink-0"
            >
              <Mail className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Row 2: Assets Due — stacked label + big date */}
          {(showFinancials || campaign.assetsDeliveryDate) && (
            <div
              className={`relative text-right ${canEdit ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
              onClick={() => canEdit && assetsDueDateRef.current?.showPicker()}
            >
              <div className="flex items-center justify-end gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Assets Due</span>
              </div>
              {campaign.assetsDeliveryDate && (
                <p className="text-lg font-bold text-primary tracking-wide mt-0.5">
                  {format(parseISO(campaign.assetsDeliveryDate), "MMM d, yyyy").toUpperCase()}
                </p>
              )}
              {canEdit && (
                <input
                  ref={assetsDueDateRef}
                  type="date"
                  value={campaign.assetsDeliveryDate ?? ""}
                  onChange={(e) => handleUpdate("assetsDeliveryDate", e.target.value || null)}
                  className="absolute inset-0 opacity-0 pointer-events-none w-0"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* === TWO-COLUMN LAYOUT === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Left column — main content */}
        <div className="lg:col-span-2 space-y-2.5">

          {/* Calendar + Shoot Days side by side */}
          <div className="flex gap-4 items-stretch">
            <div className="shrink-0">
              <ProductionCalendarTile
                shoots={shoots}
                campaignId={id}
                wfNumber={campaign.wfNumber}
                canEdit={canEdit}
                onMutate={mutate}
                onDayClick={(shoot) => setSelectedShootId(shoot.id)}
              />
            </div>
            <div className="flex-1 min-w-0">
              <ShootDayListTile
                shoots={shoots}
                wfNumber={campaign.wfNumber}
                canEdit={canEdit}
                onDayClick={(shoot) => setSelectedShootId(shoot.id)}
                onMutate={mutate}
              />
            </div>
          </div>

          <ShotListTile
            campaignId={id}
            setups={setups}
            deliverables={deliverables}
            wfNumber={campaign.wfNumber ?? undefined}
            firstShootDate={allDates[0]?.shootDate}
            canEditShots={canEditShots}
            canCompleteShots={canCompleteShots}
            onSetMode={false}
            campaignStatus={campaign.status}
            onAddSetup={() => setShowAddSetup(true)}
            onMutate={mutate}
          />

          <DocumentsTile
            campaignId={id}
            isVendor={isVendor}
            canEdit={canEdit}
            uploading={uploading}
            onUpload={handleFileUpload}
          />

        </div>

        {/* Right column — info sidebar */}
        <div className="space-y-3">

          {/* Art Director Assignment */}
          {!isVendor && (
            <ArtDirectorPicker
              currentAd={artDirector ?? null}
              adUsers={artDirectorUsers}
              canEdit={canEdit}
              isArtDirector={isArtDirector}
              currentUserId={user?.id ?? ""}
              campaignAdId={campaign.artDirectorId}
              onAssign={async (userId: string | null) => {
                await handleUpdate("artDirectorId", userId);
              }}
            />
          )}

          {/* Activity — always visible */}
          <div className="border border-border rounded-lg bg-surface">
            <div className="flex items-center px-3.5 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-semibold text-text-primary tracking-wider uppercase">Activity</span>
              </div>
            </div>
            <div className="px-3.5 py-3">
              {visibleAttentionItems.length > 0 ? (
                <div className="space-y-1.5">
                  {visibleAttentionItems.map((item, i) => {
                    const key = item.label + (item.context ?? "");
                    return (
                      <div key={i} className="group flex items-start gap-2 pl-2.5 py-1.5 rounded-r-md border-l-2 border-primary bg-primary/5">
                        <AlertCircle className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-text-primary leading-tight">{item.label}</p>
                          {item.context && (
                            <p className="text-[13px] text-text-secondary mt-0.5">{item.context}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => dismissNotif(key)}
                          className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-surface-secondary transition-opacity"
                        >
                          <X className="h-3 w-3 text-text-tertiary" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">No activity</p>
              )}
            </div>
          </div>

          {/* Budget */}
          {showFinancials && (
            <CollapsibleSection
              id={`campaign-${id}-budget-sidebar`}
              title="Budget"
              icon={DollarSign}
              defaultExpanded={true}
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

          {/* Vendors */}
          {!isVendor && (
            <CollapsibleSection
              id={`campaign-${id}-vendors-sidebar`}
              title="Vendors"
              icon={Users}
              defaultExpanded={true}
              badge={vendors.length > 0 ? `${vendors.length} vendor${vendors.length !== 1 ? "s" : ""}` : undefined}
            >
              <VendorAssignmentPanel ref={vendorPanelRef} campaignId={id} canEdit={canEdit} />
            </CollapsibleSection>
          )}

          {/* Crew Bookings */}
          {showFinancials && (
            <CollapsibleSection
              id={`campaign-${id}-crew-sidebar`}
              title="Crew"
              icon={HardHat}
              defaultExpanded={true}
              badge={crewBookings.filter((b) => b.status !== "Cancelled").length > 0
                ? `${crewBookings.filter((b) => b.status !== "Cancelled").length} booked`
                : undefined
              }
            >
              {crewBookings.filter((b) => b.status !== "Cancelled").length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-4 px-5">
                  {canEdit && (
                    <button type="button" onClick={() => setShowBookCrew(true)}
                      className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors">
                      <Plus className="h-3 w-3" />
                      Book Crew
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <CrewBookingsTile
                    bookings={crewBookings}
                    canEdit={canEdit}
                    onMutate={mutate}
                  />
                  {canEdit && (
                    <div className="pt-2 px-1">
                      <button type="button" onClick={() => setShowBookCrew(true)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                        <Plus className="h-3 w-3" />
                        Book More Crew
                      </button>
                    </div>
                  )}
                </>
              )}
            </CollapsibleSection>
          )}

          {/* Products */}
          {(campaignProducts.length > 0 || canEdit) && (
            <CollapsibleSection
              id={`campaign-${id}-products-sidebar`}
              title="Products"
              icon={ShoppingBasket}
              defaultExpanded={true}
              badge={campaignProducts.length > 0 ? `${campaignProducts.length} product${campaignProducts.length !== 1 ? "s" : ""}` : undefined}
            >
              {campaignProducts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-4 px-5">
                  {canEdit && (
                    <button type="button" onClick={() => setShowAddProduct(true)}
                      className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors">
                      <Plus className="h-3 w-3" />
                      Add Product
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {campaignProducts.map((cp) => (
                    <div key={cp.id} className="flex items-start gap-3 rounded-lg bg-surface-secondary p-3">
                      <ShoppingBasket className="h-4 w-4 text-text-tertiary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-text-primary truncate">{cp.product?.name || "Unknown product"}</p>
                        <p className="text-sm text-text-tertiary">{cp.product?.department}</p>
                        {cp.notes && (
                          <p className="text-sm text-text-secondary mt-1 leading-relaxed">{cp.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          )}

          {/* Gear */}
          {!isVendor && !isArtDirector && (campaignGear.length > 0 || canEdit) && (
            <CollapsibleSection
              id={`campaign-${id}-gear-sidebar`}
              title="Gear"
              icon={Wrench}
              defaultExpanded={true}
              badge={campaignGear.length > 0 ? `${campaignGear.length} item${campaignGear.length !== 1 ? "s" : ""}` : undefined}
            >
              {campaignGear.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-4 px-5">
                  {canEdit && (
                    <button type="button" onClick={() => setShowAddGear(true)}
                      className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors">
                      <Plus className="h-3 w-3" />
                      Add Gear
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {campaignGear.map((cg) => (
                    <div key={cg.id} className="flex items-center gap-3 rounded-lg bg-surface-secondary p-3">
                      <Wrench className="h-4 w-4 text-text-tertiary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-text-primary truncate">{cg.gearItem?.name || "Unknown gear"}</p>
                        <p className="text-sm text-text-tertiary">{cg.gearItem?.category} · {cg.gearItem?.brand} {cg.gearItem?.model}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          )}

        </div>
      </div>

      {/* Shoot Day Modal */}
      <ShootDayModal
        shoot={shoots.find((s) => s.id === selectedShootId) ?? null}
        allShoots={shoots}
        open={!!selectedShootId}
        wfNumber={campaign.wfNumber}
        canEdit={canEdit}
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
        open={showAddGear}
        onClose={() => setShowAddGear(false)}
        campaignId={id}
        onLinked={() => { setShowAddGear(false); mutate(); }}
      />

      <BookCrewDrawer
        open={showBookCrew}
        onClose={() => setShowBookCrew(false)}
        campaignId={id}
        shoots={shoots}
        onBooked={() => { setShowBookCrew(false); mutate(); }}
      />

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
                <span className="font-semibold text-emerald-600">
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
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
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

// ── Art Director Picker ────────────────────────────────────────────────────

function ArtDirectorPicker({
  currentAd,
  adUsers,
  canEdit,
  isArtDirector,
  currentUserId,
  campaignAdId,
  onAssign,
}: {
  currentAd: AppUser | null;
  adUsers: AppUser[];
  canEdit: boolean;
  isArtDirector: boolean;
  currentUserId: string;
  campaignAdId: string | null;
  onAssign: (userId: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function assign(userId: string | null) {
    setSaving(true);
    await onAssign(userId);
    setSaving(false);
    setOpen(false);
  }

  const canAssign = canEdit || (isArtDirector && !campaignAdId);
  const isSelf = campaignAdId === currentUserId;

  return (
    <div className="border border-border rounded-lg bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <Palette className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          Art Director
        </span>
      </div>
      <div className="px-3.5 py-3">
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
                  onClick={() => setOpen(!open)}
                  className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Assign Art Director
                </button>
                {open && (
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
