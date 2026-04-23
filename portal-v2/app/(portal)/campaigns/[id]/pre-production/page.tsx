"use client";

import { use, useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCampaign, useCampaigns } from "@/hooks/use-campaigns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import useSWR from "swr";
import type { AppUser, Shoot, CampaignVendor, Vendor, StudioSpace, SpaceReservation, ShootMeal } from "@/types/domain";
import {
  CalendarDays,
  Truck,
  FileText,
  ChevronDown,
  Check,
  Users,
  Building2,
  Star,
  UserCircle,
  AlertTriangle,
  Package,
  Plus,
  X,
  Utensils,
  ExternalLink,
} from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  ScheduleTab,
  SCHEDULE_SUB_VIEWS,
  type ScheduleSubViewId,
} from "@/components/pre-production/schedule-tab";
import { VendorAssignmentPanel } from "@/components/campaigns/vendor-assignment-panel";
import { SpacePickerModal } from "@/components/studio/space-picker-modal";
import { SPACE_TYPE_ICON, SPACE_TYPE_COLOR } from "@/lib/constants/studio";
import { format, parseISO } from "date-fns";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => { if (!r.ok) throw new Error("Request failed"); return r.json(); });

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { id: "schedule",  label: "Schedule",  icon: CalendarDays },
  { id: "logistics", label: "Logistics", icon: Truck },
  { id: "people",    label: "People",    icon: Users },
  { id: "contracts", label: "Contracts", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];
type TabDef = (typeof TABS)[number];

function parseTabId(value: string | null): TabId | null {
  if (!value) return null;
  if (TABS.some((tab) => tab.id === value)) return value as TabId;
  return null;
}

function SectionDropdown({
  tabs,
  activeTab,
  onSelect,
  showActiveUnderline = true,
}: {
  tabs: readonly TabDef[];
  activeTab: TabId;
  onSelect: (tabId: TabId) => void;
  showActiveUnderline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const ActiveIcon = active.icon;

  useEffect(() => {
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-[var(--density-tabs-gap)] px-[var(--density-tabs-px)] py-[var(--density-tabs-py)] text-sm font-medium leading-none text-text-primary transition-colors hover:text-text-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ActiveIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>{active.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform ${open ? "rotate-180" : ""}`} />
        {showActiveUnderline && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect(tab.id);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  isActive ? "bg-primary/5 text-text-primary" : "text-text-secondary hover:bg-surface-secondary"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : "text-text-tertiary"}`} />
                <span className="flex-1">{tab.label}</span>
                {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

function LogisticsTab({ campaignId, shoots }: { campaignId: string; shoots: Shoot[] }) {
  const { toast } = useToast();

  const { data: spaces } = useSWR<StudioSpace[]>("/api/studio/spaces", fetcher);
  const { data: reservations, mutate: refreshRes } = useSWR<SpaceReservation[]>(
    `/api/studio/reservations?campaignId=${campaignId}`,
    fetcher
  );
  const { data: meals, mutate: refreshMeals } = useSWR<ShootMeal[]>(
    `/api/shoot-meals?campaignId=${campaignId}`,
    fetcher
  );

  const [spaceModal, setSpaceModal] = useState<string | null>(null); // shoot date

  // All shoot dates across all shoots, deduplicated and sorted
  const allDates = useMemo(() => {
    const dates = new Set<string>();
    shoots.forEach((s) => s.dates.forEach((d) => dates.add(d.shootDate)));
    return [...dates].sort();
  }, [shoots]);

  // For a given date: which spaces does this campaign have?
  function reservedSpaces(date: string) {
    return (reservations ?? []).filter((r) => r.reservedDate === date && r.campaignId === campaignId);
  }

  // All reservations on a date (for picker conflict detection)
  const { data: allResOnDate } = useSWR<SpaceReservation[]>(
    spaceModal ? `/api/studio/reservations?dateFrom=${spaceModal}&dateTo=${spaceModal}` : null,
    fetcher
  );

  // Meals grouped by date
  const mealsByDate = useMemo(() => {
    const m = new Map<string, ShootMeal[]>();
    (meals ?? []).forEach((meal) => {
      const arr = m.get(meal.shootDate) ?? [];
      arr.push(meal);
      m.set(meal.shootDate, arr);
    });
    return m;
  }, [meals]);

  if (!allDates.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
          <Truck className="h-5 w-5 text-text-tertiary" />
        </div>
        <p className="text-sm font-medium text-text-secondary">No shoot dates yet</p>
        <p className="text-xs text-text-tertiary">Add shoot days in the Schedule tab first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Spaces section */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
          <Building2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Studio Spaces</span>
          <Link href="/studio" className="ml-auto flex items-center gap-1 text-xs text-text-tertiary hover:text-primary transition-colors">
            View calendar
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {allDates.map((date) => {
            const claimed = reservedSpaces(date);
            return (
              <div key={date} className="flex items-center gap-3 px-3.5 py-3">
                <div className="w-24 shrink-0">
                  <p className="text-xs font-semibold text-text-primary">
                    {format(parseISO(date), "EEE, MMM d")}
                  </p>
                </div>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {claimed.length > 0 ? (
                    claimed.map((r) => {
                      const Icon = SPACE_TYPE_ICON[r.space?.type ?? ""] ?? Building2;
                      const color = SPACE_TYPE_COLOR[r.space?.type ?? ""] ?? "bg-surface-secondary text-text-secondary border-border";
                      return (
                        <div
                          key={r.id}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${color}`}
                        >
                          <Icon className="h-3 w-3" />
                          {r.space?.name ?? "Space"}
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-xs text-text-tertiary italic">No spaces reserved</span>
                  )}
                </div>
                <button
                  onClick={() => setSpaceModal(date)}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {claimed.length > 0 ? "Edit" : "Reserve"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Food & Crafty quick view */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
          <Utensils className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wider text-text-primary">Food & Crafty</span>
          <Link href="/studio?tab=food" className="ml-auto flex items-center gap-1 text-xs text-text-tertiary hover:text-primary transition-colors">
            Open full view
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {allDates.map((date) => {
            const dayMeals = mealsByDate.get(date) ?? [];
            const MEAL_LABEL: Record<string, string> = { crafty: "Crafty", breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };
            const STATUS_COLOR: Record<string, string> = {
              pending: "bg-slate-100 text-slate-600", ordered: "bg-blue-100 text-blue-700",
              confirmed: "bg-amber-100 text-amber-700", received: "bg-violet-100 text-violet-700", set: "bg-emerald-100 text-emerald-700",
            };
            return (
              <div key={date} className="flex items-center gap-3 px-3.5 py-3">
                <div className="w-24 shrink-0">
                  <p className="text-xs font-semibold text-text-primary">
                    {format(parseISO(date), "EEE, MMM d")}
                  </p>
                </div>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {dayMeals.length > 0 ? (
                    dayMeals.map((m) => (
                      <span
                        key={m.id}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[m.status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {MEAL_LABEL[m.mealType] ?? m.mealType}
                        {m.headcount ? ` · ${m.headcount}` : ""}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-text-tertiary italic">Nothing logged</span>
                  )}
                </div>
                <Link
                  href="/studio?tab=food"
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-text-secondary hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {dayMeals.length > 0 ? "Edit" : "Add"}
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Space picker modal */}
      {spaceModal && spaces && (
        <SpacePickerModal
          campaignId={campaignId}
          date={parseISO(spaceModal)}
          spaces={spaces}
          reservations={allResOnDate ?? []}
          onClose={() => setSpaceModal(null)}
          onChanged={() => refreshRes()}
        />
      )}
    </div>
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
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none/40"
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
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary mb-2 focus:outline-none/40"
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
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none/40"
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
                    className="rounded border-border text-primary"
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
  actions,
  className,
  children,
}: {
  title: string;
  icon: React.ElementType;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border border-border bg-surface overflow-hidden ${className ?? ""}`}>
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-semibold uppercase tracking-wider text-text-primary flex-1">{title}</span>
        {actions}
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

interface ShotTalentEntry {
  id: string;
  shot_id: string;
  campaign_id: string;
  talent_number: number;
  label: string;
  age_range: string;
  gender: string;
  ethnicity: string;
  skin_tone: string;
  hair: string;
  build: string;
  wardrobe_notes: string;
  notes: string;
}

// ─── Add Internal modal ───────────────────────────────────────────────────────
function AddInternalModal({
  allUsers,
  shoots,
  assignedUserIds,
  campaignId,
  onClose,
  onSuccess,
}: {
  allUsers: AppUser[];
  shoots: Shoot[];
  assignedUserIds: Set<string>;
  campaignId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const internalRoles: AppUser["role"][] = ["Admin", "Producer", "Studio", "Art Director"];
  const available = allUsers.filter(
    (u) => internalRoles.includes(u.role) && !assignedUserIds.has(u.id)
  );
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState("");
  const [selectedShootIds, setSelectedShootIds] = useState<Set<string>>(
    shoots.length === 1 ? new Set([shoots[0].id]) : new Set()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = available.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  function toggleShoot(id: string) {
    setSelectedShootIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!selectedUser) return;
    if (shoots.length > 0 && selectedShootIds.size === 0) {
      setError("Select at least one shoot day.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const shootTargets = shoots.length === 0 ? [] : [...selectedShootIds];
      if (shootTargets.length === 0 && shoots.length === 0) {
        setError("No shoot days exist yet. Add shoot dates first.");
        setSaving(false);
        return;
      }
      await Promise.all(
        shootTargets.map((shootId) =>
          fetch(`/api/shoots/${shootId}/crew`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: selectedUser.id, roleOnShoot: role || selectedUser.role }),
          })
        )
      );
      onSuccess();
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Add Internal Person" onClose={onClose}>
      <div className="space-y-4">
        {/* User search */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Person</label>
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none/30"
          />
          <div className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text-tertiary">No people found.</p>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setSelectedUser(u); setRole(u.role); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-secondary ${selectedUser?.id === u.id ? "bg-primary/5" : ""}`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <UserCircle className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{u.name}</p>
                    <p className="text-xs text-text-tertiary">{u.role}</p>
                  </div>
                  {selectedUser?.id === u.id && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Role label */}
        {selectedUser && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Role on This Campaign</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none/30"
            />
          </div>
        )}

        {/* Shoot day selector */}
        {selectedUser && shoots.length > 1 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">Shoot Days</label>
            <div className="space-y-1">
              {shoots.map((s) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedShootIds.has(s.id)}
                    onChange={() => toggleShoot(s.id)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-text-primary">{s.name}</span>
                  {s.dates.length > 0 && (
                    <span className="text-xs text-text-tertiary">
                      {new Date(s.dates[0].shootDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {s.dates.length > 1 && ` +${s.dates.length - 1}`}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {shoots.length === 0 && selectedUser && (
          <p className="text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
            No shoot days exist yet. Add shoot dates to this campaign first.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          disabled={saving || !selectedUser || (shoots.length > 0 && selectedShootIds.size === 0)}
        >
          {saving ? "Adding..." : "Add"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ─── Add Vendor modal ────────────────────────────────────────────────────────
function AddVendorModal({
  campaignId,
  assignedVendorIds,
  talentOnly,
  onClose,
  onSuccess,
}: {
  campaignId: string;
  assignedVendorIds: Set<string>;
  talentOnly: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [search, setSearch] = useState("");
  const { data: allVendors = [] } = useSWR<Vendor[]>(
    `/api/vendors${talentOnly ? "?category=Talent" : ""}`,
    fetcher
  );
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = allVendors
    .filter((v) => !assignedVendorIds.has(v.id))
    .filter((v) =>
      v.companyName.toLowerCase().includes(search.toLowerCase()) ||
      v.contactName.toLowerCase().includes(search.toLowerCase())
    );

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/campaign-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, vendorId: selected.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add vendor");
      }
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={talentOnly ? "Add Talent Agency" : "Add Vendor"} onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            {talentOnly ? "Talent Agency" : "Vendor"}
          </label>
          <input
            type="text"
            placeholder="Search by company or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none/30"
          />
          <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text-tertiary">No {talentOnly ? "talent agencies" : "vendors"} found.</p>
            ) : (
              filtered.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelected(v)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-secondary ${selected?.id === v.id ? "bg-primary/5" : ""}`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                    <Building2 className="h-3.5 w-3.5 text-text-tertiary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{v.companyName}</p>
                    <p className="text-xs text-text-tertiary truncate">{v.contactName}{v.category ? ` · ${v.category}` : ""}</p>
                  </div>
                  {selected?.id === v.id && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !selected}>
          {saving ? "Adding..." : "Add"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ─── People tab main component ────────────────────────────────────────────────
function PeopleTab({
  campaignId,
  shoots,
  vendors,
  producerIds,
  canManage,
  onRefresh,
}: {
  campaignId: string;
  shoots: Shoot[];
  vendors: CampaignVendor[];
  producerIds: string[];
  canManage: boolean;
  onRefresh: () => void;
}) {
  const { data: allUsers = [] } = useSWR<AppUser[]>("/api/users", fetcher);
  const { data: allVendors = [] } = useSWR<Vendor[]>("/api/vendors", fetcher);
  const { data: talentEntries = [] } = useSWR<ShotTalentEntry[]>(
    `/api/shot-list/talent?campaignId=${campaignId}`,
    fetcher
  );
  const [internalQuery, setInternalQuery] = useState("");
  const [vendorQuery, setVendorQuery] = useState("");
  const [talentQuery, setTalentQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  // Deduplicate talent by number (same person across shots)
  const uniqueTalent = talentEntries.reduce((acc, t) => {
    if (!acc.find((x) => x.talent_number === t.talent_number)) acc.push(t);
    return acc;
  }, [] as ShotTalentEntry[]);

  // Collect unique internal crew from all shoots
  const crewMap = new Map<string, { user: AppUser; roles: string[] }>();
  for (const shoot of shoots) {
    for (const c of shoot.crew) {
      if (!c.user) continue;
      if (c.user.role === "Vendor") continue;
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

  // Ensure all producers are included
  for (const pid of producerIds) {
    if (!crewMap.has(pid)) {
      const producer = allUsers.find((u) => u.id === pid);
      if (producer) crewMap.set(pid, { user: producer, roles: ["Producer"] });
    }
  }

  const internalPeople = [...crewMap.values()];
  const assignedUserIds = new Set(crewMap.keys());

  // Split vendors vs talent
  const talentVendors = vendors.filter((cv) =>
    cv.vendor?.category?.toLowerCase() === "talent"
  );
  const companyVendors = vendors.filter((cv) =>
    cv.vendor?.category?.toLowerCase() !== "talent"
  );
  const assignedVendorIds = new Set(vendors.map((cv) => cv.vendor?.id).filter(Boolean) as string[]);

  // Inline search filtered lists
  const internalRoles: AppUser["role"][] = ["Admin", "Producer", "Studio", "Art Director"];
  const availableInternal = allUsers.filter(u => internalRoles.includes(u.role) && !assignedUserIds.has(u.id));
  const filteredInternal = internalQuery ? availableInternal.filter(u => u.name.toLowerCase().includes(internalQuery.toLowerCase())) : [];

  const availableCompanyVendors = allVendors.filter(v => !assignedVendorIds.has(v.id) && v.category?.toLowerCase() !== "talent");
  const filteredVendors = vendorQuery ? availableCompanyVendors.filter(v =>
    v.companyName.toLowerCase().includes(vendorQuery.toLowerCase()) ||
    v.contactName.toLowerCase().includes(vendorQuery.toLowerCase())
  ) : [];

  const availableTalentVendors = allVendors.filter(v => !assignedVendorIds.has(v.id) && v.category?.toLowerCase() === "talent");
  const filteredTalent = talentQuery ? availableTalentVendors.filter(v =>
    v.companyName.toLowerCase().includes(talentQuery.toLowerCase()) ||
    v.contactName.toLowerCase().includes(talentQuery.toLowerCase())
  ) : [];

  async function handleAddInternal(user: AppUser) {
    if (shoots.length === 0) return;
    setSaving(user.id);
    setInternalQuery("");
    try {
      await Promise.all(shoots.map(shoot =>
        fetch(`/api/shoots/${shoot.id}/crew`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, roleOnShoot: user.role }),
        })
      ));
      onRefresh();
    } finally {
      setSaving(null);
    }
  }

  async function handleAddVendor(vendor: Vendor) {
    setSaving(vendor.id);
    setVendorQuery("");
    try {
      await fetch("/api/campaign-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, vendorId: vendor.id }),
      });
      onRefresh();
    } finally {
      setSaving(null);
    }
  }

  async function handleAddTalent(vendor: Vendor) {
    setSaving(vendor.id + "-t");
    setTalentQuery("");
    try {
      await fetch("/api/campaign-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, vendorId: vendor.id }),
      });
      onRefresh();
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Internal */}
        <PeopleSection title="Internal" icon={Users}>
          {internalPeople.length === 0 ? (
            <p className="text-sm text-text-tertiary py-2">No crew assigned to any shoots yet.</p>
          ) : (
            <div className="space-y-2">
              {internalPeople.map(({ user, roles }) => (
                <div key={user.id} className="flex items-center gap-3 py-1.5">
                  <UserAvatar name={user.name} favoriteProduct={user.favoritePublixProduct} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
                    {roles.length > 0 && (
                      <p className="text-xs text-text-tertiary truncate">{roles.join(", ")}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {canManage && (
            <div className="mt-3 border-t border-border pt-2.5">
              <input
                type="text"
                placeholder="Add person..."
                value={internalQuery}
                onChange={e => setInternalQuery(e.target.value)}
                onKeyDown={e => e.key === "Escape" && setInternalQuery("")}
                className="w-full rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none/40"
              />
              {internalQuery && (
                <div className="mt-1 rounded-md border border-border divide-y divide-border bg-surface">
                  {shoots.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-amber-600">Add shoot dates first.</p>
                  ) : filteredInternal.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-text-tertiary">No matches.</p>
                  ) : filteredInternal.map(u => (
                    <button key={u.id} type="button" onClick={() => handleAddInternal(u)}
                      disabled={saving === u.id}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-secondary transition-colors disabled:opacity-50"
                    >
                      <UserAvatar name={u.name} favoriteProduct={u.favoritePublixProduct} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">{u.name}</p>
                        <p className="text-xs text-text-tertiary">{u.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
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
                  <UserAvatar name={cv.vendor?.companyName ?? "?"} favoriteProduct={cv.vendor?.favoritePublixProduct} size="sm" />
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
          {canManage && (
            <div className="mt-3 border-t border-border pt-2.5">
              <input
                type="text"
                placeholder="Add vendor..."
                value={vendorQuery}
                onChange={e => setVendorQuery(e.target.value)}
                onKeyDown={e => e.key === "Escape" && setVendorQuery("")}
                className="w-full rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none/40"
              />
              {vendorQuery && (
                <div className="mt-1 rounded-md border border-border divide-y divide-border bg-surface">
                  {filteredVendors.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-text-tertiary">No matches.</p>
                  ) : filteredVendors.map(v => (
                    <button key={v.id} type="button" onClick={() => handleAddVendor(v)}
                      disabled={saving === v.id}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-secondary transition-colors disabled:opacity-50"
                    >
                      <UserAvatar name={v.companyName} favoriteProduct={v.favoritePublixProduct} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">{v.companyName}</p>
                        <p className="text-xs text-text-tertiary truncate">{v.contactName}{v.category ? ` · ${v.category}` : ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </PeopleSection>

        {/* Talent */}
        <PeopleSection title="Talent" icon={Star}>
          {uniqueTalent.length === 0 && talentVendors.length === 0 ? (
            <p className="text-sm text-text-tertiary py-2">No talent assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {uniqueTalent.map((t) => {
                const shotCount = talentEntries.filter((e) => e.talent_number === t.talent_number).length;
                const details = [t.age_range, t.gender, t.ethnicity].filter((v) => v && v !== "Open");
                return (
                  <div key={t.talent_number} className="flex items-start gap-3 py-1.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100">
                      <span className="text-xs font-bold text-violet-700">T{t.talent_number}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {t.label || `Talent ${t.talent_number}`}
                      </p>
                      <p className="text-xs text-text-tertiary truncate">
                        {details.length > 0 ? details.join(" · ") : "Open casting"}
                        {" · "}{shotCount} shot{shotCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              {talentVendors.map((cv) => (
                <div key={cv.id} className="flex items-start gap-3 py-1.5">
                  <UserAvatar name={cv.vendor?.companyName ?? "?"} favoriteProduct={cv.vendor?.favoritePublixProduct} size="sm" />
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
          {canManage && (
            <div className="mt-3 border-t border-border pt-2.5">
              <input
                type="text"
                placeholder="Add talent agency..."
                value={talentQuery}
                onChange={e => setTalentQuery(e.target.value)}
                onKeyDown={e => e.key === "Escape" && setTalentQuery("")}
                className="w-full rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none/40"
              />
              {talentQuery && (
                <div className="mt-1 rounded-md border border-border divide-y divide-border bg-surface">
                  {filteredTalent.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-text-tertiary">No matches.</p>
                  ) : filteredTalent.map(v => (
                    <button key={v.id} type="button" onClick={() => handleAddTalent(v)}
                      disabled={saving === v.id + "-t"}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-secondary transition-colors disabled:opacity-50"
                    >
                      <Star className="h-4 w-4 text-text-tertiary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">{v.companyName}</p>
                        <p className="text-xs text-text-tertiary truncate">{v.contactName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </PeopleSection>
      </div>
    </>
  );
}

// ─── Campaign switcher dropdown ───────────────────────────────────────────────
function CampaignSwitcher({
  currentId,
  currentName,
  currentWf,
  activeTab,
}: {
  currentId: string;
  currentName: string;
  currentWf?: string | null;
  activeTab: TabId;
}) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { campaigns } = useCampaigns();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Pre-production campaigns only
  const prepCampaigns = campaigns.filter(
    (c) => c.status === "Planning" || c.status === "Upcoming" || c.status === "In Production"
  );

  // Default: only campaigns assigned to this producer
  const mine = prepCampaigns.filter(
    (c) => c.producerIds.includes(user?.id ?? "") || c.createdBy === user?.id || c.artDirectorId === user?.id
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
                    router.push(`/campaigns/${c.id}/pre-production?tab=${activeTab}`);
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
  const searchParams = useSearchParams();
  const tabFromUrl = parseTabId(searchParams.get("tab"));
  const { campaign, shoots, vendors, isLoading, mutate: refreshCampaign } = useCampaign(id);
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<TabId>(tabFromUrl ?? "schedule");
  const [activeScheduleView, setActiveScheduleView] = useState<ScheduleSubViewId>("shot-list");

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, activeTab]);

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
    user?.role === "Producer" || user?.role === "Post Producer" ||
    user?.role === "Art Director";

  if (!canAccess) {
    return (
      <EmptyState
        title="Access restricted"
        description="Pre-production is available to Producers and Art Directors."
      />
    );
  }

  const isArtDirector = user?.role === "Art Director";
  const canManagePeople = user?.role === "Admin" || user?.role === "Producer" || user?.role === "Post Producer";
  const visibleTabs = isArtDirector
    ? TABS.filter((t) => t.id === "schedule" || t.id === "people")
    : TABS;
  const visibleScheduleViews = isArtDirector
    ? SCHEDULE_SUB_VIEWS.filter((view) => view.id === "shot-list")
    : SCHEDULE_SUB_VIEWS;

  const resolvedActiveTab = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : visibleTabs[0].id;
  const resolvedScheduleView = visibleScheduleViews.some((view) => view.id === activeScheduleView)
    ? activeScheduleView
    : visibleScheduleViews[0].id;

  function handleTabClick(tabId: TabId) {
    setActiveTab(tabId);
    router.replace(`/campaigns/${id}/pre-production?tab=${tabId}`, { scroll: false });
  }

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="space-y-[var(--density-page-header-gap)] border-b border-border pb-[var(--density-page-header-pb)]">
        <div className="flex items-start justify-between gap-[var(--density-page-header-row-gap)]">
          <h1 className="text-2xl font-bold text-text-primary">Pre Production</h1>
          <CampaignSwitcher
            currentId={id}
            currentName={campaign.name}
            currentWf={campaign.wfNumber}
            activeTab={resolvedActiveTab}
          />
        </div>
      </div>

      {/* Section selector + contextual sub-tabs */}
      <div className="border-b border-border">
        <div className="flex flex-wrap items-center gap-2">
          <SectionDropdown
            tabs={visibleTabs}
            activeTab={resolvedActiveTab}
            onSelect={handleTabClick}
            showActiveUnderline={resolvedActiveTab !== "schedule"}
          />

          {resolvedActiveTab === "schedule" && (
            <>
              <span className="h-5 w-px bg-border/70" aria-hidden />
              <nav className="flex flex-wrap items-center gap-2">
              {visibleScheduleViews.map((view) => {
                const active = resolvedScheduleView === view.id;
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setActiveScheduleView(view.id)}
                    className={`
                      relative px-[var(--density-tabs-px)] py-[var(--density-tabs-py)] text-sm font-medium leading-none transition-colors
                      ${active ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary"}
                    `}
                  >
                    {view.label}
                    {active && (
                      <span className="absolute bottom-0 left-[var(--density-tabs-px)] right-[var(--density-tabs-px)] h-0.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
              </nav>
            </>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="pt-[var(--density-preprod-content-pt)]">
        {resolvedActiveTab === "schedule"  && (
          <ScheduleTab
            campaignId={id}
            campaignName={campaign.name}
            wfNumber={campaign.wfNumber}
            assetsDeliveryDate={campaign.assetsDeliveryDate}
            producerId={campaign.producerId}
            shoots={shoots}
            vendors={vendors}
            isArtDirector={isArtDirector}
            activeView={resolvedScheduleView}
            onActiveViewChange={setActiveScheduleView}
            showViewSwitcher={false}
          />
        )}
        {resolvedActiveTab === "logistics" && <LogisticsTab campaignId={id} shoots={shoots} />}
        {resolvedActiveTab === "people"    && <PeopleTab campaignId={id} shoots={shoots} vendors={vendors} producerIds={campaign.producerIds} canManage={canManagePeople} onRefresh={refreshCampaign} />}
        {resolvedActiveTab === "contracts" && <ContractsTab campaignId={id} shoots={shoots} vendors={vendors} />}
      </div>
    </div>
  );
}
