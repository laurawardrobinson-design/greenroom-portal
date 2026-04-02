"use client";

import { use, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCampaign, useCampaigns } from "@/hooks/use-campaigns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import useSWR from "swr";
import type { AppUser, Shoot, CampaignVendor } from "@/types/domain";
import {
  CalendarDays,
  Truck,
  DollarSign,
  FileText,
  ChevronDown,
  Check,
  Users,
  Building2,
  Star,
  UserCircle,
  AlertTriangle,
} from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ScheduleTab } from "@/components/pre-production/schedule-tab";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { id: "schedule",  label: "Schedule",  icon: CalendarDays },
  { id: "logistics", label: "Logistics", icon: Truck },
  { id: "people",    label: "People",    icon: Users },
  { id: "payments",  label: "Payments",  icon: DollarSign },
  { id: "contracts", label: "Contracts", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Placeholder tab content ──────────────────────────────────────────────────
function PlaceholderTab({
  icon: Icon,
  title,
  description,
  items,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-secondary">
        <Icon className="h-5 w-5 text-text-tertiary" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="text-xs text-text-tertiary leading-relaxed">{description}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 mt-1">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-border bg-surface-secondary px-3 py-1 text-xs text-text-tertiary"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

function LogisticsTab() {
  return (
    <PlaceholderTab
      icon={Truck}
      title="Logistics"
      description="Operational prep — locations, styling notes, and catering headcounts."
      items={["Locations", "Styling", "Catering"]}
    />
  );
}

function PaymentsTab() {
  return (
    <PlaceholderTab
      icon={DollarSign}
      title="Payments"
      description="Financial approvals and disbursements — vendor estimates, invoices, and talent/crew paymaster."
      items={["Estimates", "Invoices", "Paymaster"]}
    />
  );
}

function ContractsTab({ campaignId, shoots, vendors }: { campaignId: string; shoots: Shoot[]; vendors: CampaignVendor[] }) {
  const [showCoiModal, setShowCoiModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Contract categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Talent Releases", count: 0 },
          { label: "Crew Deals", count: 0 },
          { label: "Location Agreements", count: 0 },
          { label: "Insurance", count: 0 },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-surface p-4 text-center"
          >
            <p className="text-sm font-medium text-text-primary">{item.label}</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{item.count}</p>
            <p className="text-xs text-text-tertiary">documents</p>
          </div>
        ))}
      </div>

      {/* COI Request */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Insurance Certificates</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-text-secondary mb-3">
            Generate a Certificate of Insurance (COI) request to send to your insurance broker.
          </p>
          <Button size="sm" onClick={() => setShowCoiModal(true)}>
            <FileText className="h-3.5 w-3.5" />
            Generate COI Request
          </Button>
        </div>
      </div>

      <CoiRequestModal
        open={showCoiModal}
        onClose={() => setShowCoiModal(false)}
        shoots={shoots}
        vendors={vendors}
      />
    </div>
  );
}

function CoiRequestModal({
  open,
  onClose,
  shoots,
  vendors,
}: {
  open: boolean;
  onClose: () => void;
  shoots: Shoot[];
  vendors: CampaignVendor[];
}) {
  const [selectedVendor, setSelectedVendor] = useState("");
  const [addressSource, setAddressSource] = useState<"vendor" | "location">("vendor");
  const [holderAddress, setHolderAddress] = useState("");
  const [selectedShootDates, setSelectedShootDates] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // Gather all vendors for selection
  const vendorOptions = vendors
    .filter((cv) => cv.vendor)
    .map((cv) => ({
      id: cv.vendorId,
      name: cv.vendor?.companyName || "Unknown",
      contactName: cv.vendor?.contactName || "",
    }));

  // Gather all shoot dates
  const allShootDates = shoots.flatMap((s) =>
    s.dates.map((d) => ({
      id: d.id,
      date: d.shootDate,
      location: d.location || s.location || "TBD",
      shootName: s.name,
    }))
  );

  const selectedVendorData = vendorOptions.find((v) => v.id === selectedVendor);
  const holderName = selectedVendorData?.name || "";

  const shootDateText = selectedShootDates
    .map((id) => {
      const sd = allShootDates.find((d) => d.id === id);
      if (!sd) return "";
      return new Date(sd.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    })
    .filter(Boolean)
    .join(", ");

  function generateEmailBody() {
    return `COI Request

Certificate Holder Name: ${holderName}
Certificate Holder Address: ${holderAddress}
Shoot Date(s): ${shootDateText || "TBD"}

Please issue a Certificate of Insurance for the above holder and dates.

Thank you.`;
  }

  function handleCopy() {
    navigator.clipboard.writeText(generateEmailBody());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate COI Request" size="lg">
      <div className="space-y-4">
        {/* Warning */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Production insurance does <strong>NOT</strong> automatically cover hazardous and/or unusual activity including wild animals, horses, stunts, racing, watercraft, aircraft, railroads, pyrotechnics, adverse weather, filming outside of the US or Canada. You must not generate any COI for these activities and notify HOP for unusual scenarios.
            </p>
          </div>
        </div>

        {/* Vendor (Certificate Holder) */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Certificate Holder Name (Vendor Legal Name)
          </label>
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Select a vendor...</option>
            {vendorOptions.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        {/* Address Source */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Certificate Holder Address
          </label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => {
                setAddressSource("vendor");
                setHolderAddress("");
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                addressSource === "vendor"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-text-secondary hover:border-primary/40"
              }`}
            >
              Vendor Address
            </button>
            <button
              type="button"
              onClick={() => {
                setAddressSource("location");
                const firstDate = allShootDates[0];
                if (firstDate) setHolderAddress(firstDate.location);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                addressSource === "location"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-text-secondary hover:border-primary/40"
              }`}
            >
              Location Address
            </button>
          </div>
          {addressSource === "location" && allShootDates.length > 0 && (
            <select
              value=""
              onChange={(e) => setHolderAddress(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary mb-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Pick a shoot location...</option>
              {allShootDates.map((sd) => (
                <option key={sd.id} value={sd.location}>{sd.shootName} — {sd.location}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={holderAddress}
            onChange={(e) => setHolderAddress(e.target.value)}
            placeholder="Enter or select certificate holder address"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Shoot Dates */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Shoot Dates
          </label>
          {allShootDates.length === 0 ? (
            <p className="text-sm text-text-tertiary">No shoot dates scheduled yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {allShootDates.map((sd) => (
                <label
                  key={sd.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-surface-secondary transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedShootDates.includes(sd.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedShootDates((prev) => [...prev, sd.id]);
                      } else {
                        setSelectedShootDates((prev) => prev.filter((id) => id !== sd.id));
                      }
                    }}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-primary">
                    {new Date(sd.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="text-xs text-text-tertiary ml-auto">{sd.shootName} — {sd.location}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        {selectedVendor && (
          <div className="rounded-lg border border-border bg-surface-secondary p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-2">Email Preview</p>
            <pre className="text-xs text-text-primary whitespace-pre-wrap font-sans leading-relaxed">
              {generateEmailBody()}
            </pre>
          </div>
        )}

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCopy} disabled={!selectedVendor}>
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied!
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                Copy to Clipboard
              </>
            )}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}

// ─── People tab ──────────────────────────────────────────────────────────────
function PeopleSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">{title}</span>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

function PeopleTab({
  shoots,
  vendors,
  producerId,
}: {
  shoots: Shoot[];
  vendors: CampaignVendor[];
  producerId: string | null;
}) {
  const { data: allUsers = [] } = useSWR<AppUser[]>("/api/users", fetcher);

  // Collect unique internal crew from all shoots
  const crewMap = new Map<string, { user: AppUser; roles: string[] }>();
  for (const shoot of shoots) {
    for (const c of shoot.crew) {
      if (!c.user) continue;
      if (crewMap.has(c.userId)) {
        const entry = crewMap.get(c.userId)!;
        if (c.roleOnShoot && !entry.roles.includes(c.roleOnShoot)) {
          entry.roles.push(c.roleOnShoot);
        }
      } else {
        crewMap.set(c.userId, {
          user: c.user,
          roles: c.roleOnShoot ? [c.roleOnShoot] : [],
        });
      }
    }
  }

  // Ensure producer is included
  if (producerId && !crewMap.has(producerId)) {
    const producer = allUsers.find((u) => u.id === producerId);
    if (producer) {
      crewMap.set(producerId, { user: producer, roles: ["Producer"] });
    }
  }

  const internalPeople = [...crewMap.values()];

  // Split vendors vs talent
  const talentVendors = vendors.filter((cv) =>
    cv.vendor?.category?.toLowerCase() === "talent"
  );
  const companyVendors = vendors.filter((cv) =>
    cv.vendor?.category?.toLowerCase() !== "talent"
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Internal */}
      <PeopleSection title="Internal" icon={Users}>
        {internalPeople.length === 0 ? (
          <p className="text-sm text-text-tertiary py-2">No crew assigned to any shoots yet.</p>
        ) : (
          <div className="space-y-2">
            {internalPeople.map(({ user, roles }) => (
              <div key={user.id} className="flex items-center gap-3 py-1.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <UserCircle className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
                  <p className="text-xs text-text-tertiary truncate">
                    {roles.length > 0 ? roles.join(", ") : user.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </PeopleSection>

      {/* Vendors */}
      <PeopleSection title="Vendors" icon={Building2}>
        {companyVendors.length === 0 ? (
          <p className="text-sm text-text-tertiary py-2">No vendors assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {companyVendors.map((cv) => (
              <div key={cv.id} className="flex items-start gap-3 py-1.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                  <Building2 className="h-4 w-4 text-text-tertiary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {cv.vendor?.companyName ?? "Unknown"}
                  </p>
                  {cv.vendor?.contactName && (
                    <p className="text-xs text-text-tertiary truncate">{cv.vendor.contactName}</p>
                  )}
                  {cv.vendor?.category && (
                    <p className="text-xs text-text-tertiary truncate">{cv.vendor.category}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PeopleSection>

      {/* Talent */}
      <PeopleSection title="Talent" icon={Star}>
        {talentVendors.length === 0 ? (
          <p className="text-sm text-text-tertiary py-2">No talent assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {talentVendors.map((cv) => (
              <div key={cv.id} className="flex items-start gap-3 py-1.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                  <Star className="h-4 w-4 text-text-tertiary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {cv.vendor?.companyName ?? "Unknown"}
                  </p>
                  {cv.vendor?.contactName && (
                    <p className="text-xs text-text-tertiary truncate">{cv.vendor.contactName}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PeopleSection>
    </div>
  );
}

// ─── Campaign switcher dropdown ───────────────────────────────────────────────
function CampaignSwitcher({ currentId, currentName, currentWf }: { currentId: string; currentName: string; currentWf?: string | null }) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { campaigns } = useCampaigns();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Pre-production campaigns only
  const prepCampaigns = campaigns.filter(
    (c) => c.status === "Planning" || c.status === "In Production"
  );

  // Default: only campaigns assigned to this producer
  const mine = prepCampaigns.filter(
    (c) => c.producerId === user?.id || c.createdBy === user?.id
  );
  const displayed = showAll || mine.length === 0 ? prepCampaigns : mine;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-xs transition-all hover:bg-primary-hover hover:shadow-sm"
      >
        {currentWf && <span>{currentWf}</span>}
        <span className="truncate max-w-[240px]">{currentName}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 rounded-xl border border-border bg-surface shadow-lg z-50 overflow-hidden">
          {/* My campaigns / All toggle */}
          {mine.length > 0 && prepCampaigns.length > mine.length && (
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${!showAll ? "text-primary bg-primary/5" : "text-text-tertiary hover:text-text-secondary"}`}
              >
                My Campaigns
              </button>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className={`flex-1 px-4 py-2 text-xs font-medium border-l border-border transition-colors ${showAll ? "text-primary bg-primary/5" : "text-text-tertiary hover:text-text-secondary"}`}
              >
                All
              </button>
            </div>
          )}

          {/* Campaign list */}
          <div className="max-h-64 overflow-y-auto">
            {displayed.length === 0 ? (
              <p className="px-4 py-3 text-xs text-text-tertiary">No campaigns in pre-production</p>
            ) : (
              displayed.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/campaigns/${c.id}/pre-production`);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-secondary transition-colors"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                    {c.wfNumber && (
                      <span className="text-base text-text-primary shrink-0">{c.wfNumber}</span>
                    )}
                    <span className="text-base text-text-primary truncate">{c.name}</span>
                  </div>
                  {c.id === currentId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PreProductionWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { campaign, shoots, vendors, isLoading } = useCampaign(id);
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<TabId>("schedule");

  if (isLoading) return <DashboardSkeleton />;
  if (!campaign) {
    return (
      <EmptyState
        title="Campaign not found"
        description="This campaign may have been deleted or you don't have access."
      />
    );
  }

  const canAccess =
    user?.role === "Admin" ||
    user?.role === "Producer" ||
    user?.role === "Art Director";

  if (!canAccess) {
    return (
      <EmptyState
        title="Access restricted"
        description="Pre-production is available to Producers and Art Directors."
      />
    );
  }

  const campaignLabel = campaign.wfNumber
    ? `${campaign.wfNumber} ${campaign.name}`
    : campaign.name;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="space-y-3 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold text-text-primary">Pre Production</h2>
          <CampaignSwitcher currentId={id} currentName={campaign.name} currentWf={campaign.wfNumber} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border">
        <nav className="flex gap-0">
          {TABS.map(({ id: tabId, label, icon: Icon }) => {
            const active = activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={`
                  relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors
                  ${active
                    ? "text-text-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                  }
                `}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-text-tertiary/60"}`} />
                {label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="pt-6">
        {activeTab === "schedule"  && (
          <ScheduleTab
            campaignId={id}
            campaignName={campaign.name}
            wfNumber={campaign.wfNumber}
            assetsDeliveryDate={campaign.assetsDeliveryDate}
            producerId={campaign.producerId}
            shoots={shoots}
            vendors={vendors}
          />
        )}
        {activeTab === "logistics" && <LogisticsTab />}
        {activeTab === "people"    && <PeopleTab shoots={shoots} vendors={vendors} producerId={campaign.producerId} />}
        {activeTab === "payments"  && <PaymentsTab />}
        {activeTab === "contracts" && <ContractsTab campaignId={id} shoots={shoots} vendors={vendors} />}
      </div>
    </div>
  );
}
