"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ShootsSection } from "@/components/campaigns/shoots-section";
import { VendorAssignmentPanel, type VendorAssignmentPanelHandle } from "@/components/campaigns/vendor-assignment-panel";
import { CallSheetSection } from "@/components/campaigns/call-sheet-section";
import { BudgetTab } from "@/components/campaigns/budget-tab";
import {
  Calendar,
  Users,
  ClipboardList,
  ShoppingBasket,
  Wrench,
  Plus,
  DollarSign,
} from "lucide-react";
import { LinkGearDrawer } from "@/components/campaigns/link-gear-drawer";
import type { Shoot, CampaignProduct, CampaignGearLink, CampaignVendor, CampaignFinancials } from "@/types/domain";

interface Props {
  campaignId: string;
  campaignName: string;
  shoots: Shoot[];
  vendors: CampaignVendor[];
  campaignProducts: CampaignProduct[];
  campaignGear: CampaignGearLink[];
  financials: CampaignFinancials;
  canEdit: boolean;
  isVendor: boolean;
  isArtDirector: boolean;
  showFinancials: boolean;
  showOverageRequest: boolean;
  setShowOverageRequest: (v: boolean) => void;
  onAddProduct: () => void;
  onMutate: () => void;
  onAddGear?: () => void;
}

export function ShootManagementTab({
  campaignId,
  campaignName,
  shoots,
  vendors,
  campaignProducts,
  campaignGear,
  financials,
  canEdit,
  isVendor,
  isArtDirector,
  showFinancials,
  showOverageRequest,
  setShowOverageRequest,
  onAddProduct,
  onMutate,
  onAddGear,
}: Props) {
  const vendorPanelRef = useRef<VendorAssignmentPanelHandle>(null);
  const [showAddGear, setShowAddGear] = useState(false);

  return (
    <div className="space-y-4">
      {/* Shoots */}
      <CollapsibleSection
        id={`${campaignId}-shoots`}
        title="Shoots"
        icon={Calendar}
        defaultExpanded={true}
        badge={
          <span className="flex items-center gap-1.5">
            <span>{shoots.length} {shoots.length !== 1 ? "shoots" : "shoot"}</span>
            {shoots.some(s => !s.dates || s.dates.length === 0) && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                dates missing
              </span>
            )}
            {shoots.some(s => !s.crew || s.crew.length === 0) && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                no crew
              </span>
            )}
          </span>
        }
        actions={
          canEdit ? (
            <Button size="sm" variant="ghost" onClick={() => {
              const el = document.getElementById(`${campaignId}-shoots-add`);
              if (el) el.click();
            }}>
              <Plus className="h-3.5 w-3.5" />
              Add Shoot
            </Button>
          ) : undefined
        }
      >
        <ShootsSection
          campaignId={campaignId}
          campaignName={campaignName}
          shoots={shoots}
          onMutate={onMutate}
        />
      </CollapsibleSection>

      {/* Call Sheet */}
      {shoots.length > 0 && (
        <CollapsibleSection
          id={`${campaignId}-callsheet`}
          title="Call Sheet"
          icon={ClipboardList}
          defaultExpanded={false}
        >
          <CallSheetSection campaignId={campaignId} shoots={shoots} />
        </CollapsibleSection>
      )}

      {/* Vendors */}
      {!isArtDirector && (
        <CollapsibleSection
          id={`${campaignId}-vendors`}
          title="Vendors"
          icon={Users}
          defaultExpanded={true}
          badge={vendors.length > 0 ? (
            <span className="flex items-center gap-1.5">
              <span>{vendors.length} {vendors.length !== 1 ? "vendors" : "vendor"}</span>
              {(() => {
                const actionVendors = vendors.filter(v =>
                  [
                    "Invited",
                    "Estimate Submitted",
                    "Estimate Revision Requested",
                    "PO Uploaded",
                    "Invoice Submitted",
                    "Invoice Pre-Approved",
                  ].includes(v.status)
                );
                return actionVendors.length > 0 ? (
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    {actionVendors.length} action needed
                  </span>
                ) : null;
              })()}
            </span>
          ) : undefined}
        >
          <VendorAssignmentPanel ref={vendorPanelRef} campaignId={campaignId} canEdit={canEdit} />
        </CollapsibleSection>
      )}

      {/* Budget (full detail) */}
      {showFinancials && (
        <CollapsibleSection
          id={`${campaignId}-budget-full`}
          title="Budget Details"
          icon={DollarSign}
          defaultExpanded={false}
        >
          <BudgetTab
            campaignId={campaignId}
            financials={financials}
            vendors={vendors}
            canEdit={canEdit}
            showOverageRequest={showOverageRequest}
            setShowOverageRequest={setShowOverageRequest}
            onMutate={onMutate}
          />
        </CollapsibleSection>
      )}

      {/* Products + Gear side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CollapsibleSection
          id={`${campaignId}-products`}
          title="Products"
          icon={ShoppingBasket}
          defaultExpanded={true}
          badge={campaignProducts.length > 0 ? `${campaignProducts.length} product${campaignProducts.length !== 1 ? "s" : ""}` : undefined}
        >
          {campaignProducts.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {campaignProducts.map((cp) => (
                <div
                  key={cp.id}
                  className="flex items-center gap-3 rounded-lg bg-surface-secondary p-3"
                >
                  {cp.product?.imageUrl ? (
                    <img
                      src={cp.product.imageUrl}
                      alt={cp.product.name}
                      className="h-10 w-10 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-tertiary">
                      <ShoppingBasket className="h-4 w-4 text-text-tertiary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{cp.product?.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {cp.product?.department}
                      {cp.product?.restrictions && ` · ${cp.product.restrictions}`}
                    </p>
                    {cp.product?.shootingNotes && (
                      <p className="text-xs text-text-secondary mt-0.5">{cp.product.shootingNotes}</p>
                    )}
                  </div>
                  {cp.product?.rpGuideUrl && (
                    <a
                      href={cp.product.rpGuideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-primary hover:underline"
                    >
                      R&P Guide
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 px-5">
              {canEdit && (
                <button type="button" onClick={onAddProduct}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors">
                  <Plus className="h-3 w-3" />
                  Add Product
                </button>
              )}
            </div>
          )}
        </CollapsibleSection>

        {!isVendor && !isArtDirector && (
          <CollapsibleSection
            id={`${campaignId}-gear`}
            title="Gear"
            icon={Wrench}
            defaultExpanded={true}
            badge={campaignGear.length > 0 ? `${campaignGear.length} item${campaignGear.length !== 1 ? "s" : ""}` : undefined}
          >
            {campaignGear.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {campaignGear.map((cg) => (
                  <div
                    key={cg.id}
                    className="flex items-center gap-3 rounded-lg bg-surface-secondary p-3"
                  >
                    <Wrench className="h-4 w-4 text-text-tertiary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {cg.gearItem?.name || "Unknown gear"}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {cg.gearItem?.category} · {cg.gearItem?.brand} {cg.gearItem?.model}
                      </p>
                    </div>
                    <Badge variant="custom" className={
                      cg.gearItem?.status === "Available"
                        ? "bg-emerald-50 text-emerald-700"
                        : cg.gearItem?.status === "Checked Out"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-amber-50 text-amber-700"
                    }>
                      {cg.gearItem?.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 px-5">
                {canEdit && (
                  <button type="button" onClick={() => setShowAddGear(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors">
                    <Plus className="h-3 w-3" />
                    Add Gear
                  </button>
                )}
              </div>
            )}
          </CollapsibleSection>
        )}
      </div>

      <LinkGearDrawer
        open={showAddGear}
        onClose={() => setShowAddGear(false)}
        campaignId={campaignId}
        onLinked={() => { setShowAddGear(false); onMutate(); }}
      />
    </div>
  );
}
