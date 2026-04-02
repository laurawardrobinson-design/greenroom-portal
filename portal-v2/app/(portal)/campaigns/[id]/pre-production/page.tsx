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
} from "lucide-react";
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

function ContractsTab() {
  return (
    <PlaceholderTab
      icon={FileText}
      title="Contracts"
      description="Legal and compliance — talent releases, crew deal memos, location agreements, and insurance certificates."
      items={["Talent Releases", "Crew Deals", "Location Agreements", "Insurance"]}
    />
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
    <div className="space-y-0 -mt-3">
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
        {activeTab === "contracts" && <ContractsTab />}
      </div>
    </div>
  );
}
