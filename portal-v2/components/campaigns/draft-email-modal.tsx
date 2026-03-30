"use client";

import { useState, useMemo } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Shoot, CampaignVendor } from "@/types/domain";

type EmailType = "callsheet" | "creative" | "vendor" | "update";

interface Includes {
  shootDates: boolean;
  location: boolean;
  crewList: boolean;
  vendorList: boolean;
  assetsDue: boolean;
  notes: boolean;
  budget: boolean;
}

const EMAIL_TYPES: Array<{ value: EmailType; label: string; description: string }> = [
  {
    value: "callsheet",
    label: "Call Sheet",
    description: "Pre-shoot notification for crew and vendors",
  },
  {
    value: "creative",
    label: "Creative Brief",
    description: "Shoot overview for the creative and art direction team",
  },
  {
    value: "vendor",
    label: "Vendor Confirmation",
    description: "Confirm shoot details with assigned vendors",
  },
  {
    value: "update",
    label: "Status Update",
    description: "General campaign update for stakeholders",
  },
];

const TYPE_DEFAULTS: Record<EmailType, Includes> = {
  callsheet: {
    shootDates: true,
    location: true,
    crewList: true,
    vendorList: true,
    assetsDue: false,
    notes: true,
    budget: false,
  },
  creative: {
    shootDates: true,
    location: false,
    crewList: false,
    vendorList: false,
    assetsDue: true,
    notes: true,
    budget: false,
  },
  vendor: {
    shootDates: true,
    location: true,
    crewList: false,
    vendorList: true,
    assetsDue: false,
    notes: true,
    budget: false,
  },
  update: {
    shootDates: true,
    location: false,
    crewList: false,
    vendorList: false,
    assetsDue: true,
    notes: true,
    budget: false,
  },
};

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: {
    name: string;
    wfNumber: string | null;
    status: string;
    notes?: string | null;
    assetsDeliveryDate?: string | null;
  };
  shoots: Shoot[];
  vendors: CampaignVendor[];
  showFinancials: boolean;
  financials: { budget: number; committed: number; remaining: number };
}

export function DraftEmailModal({
  open,
  onClose,
  campaign,
  shoots,
  vendors,
  showFinancials,
  financials,
}: Props) {
  const [emailType, setEmailType] = useState<EmailType>("callsheet");
  const [includes, setIncludes] = useState<Includes>(TYPE_DEFAULTS.callsheet);
  const [customTo, setCustomTo] = useState("");

  function selectType(type: EmailType) {
    setEmailType(type);
    setIncludes(TYPE_DEFAULTS[type]);
  }

  function toggle(key: keyof Includes) {
    setIncludes((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const allDates = shoots
    .flatMap((s) => s.dates.map((d) => ({ ...d, shootName: s.name, shootType: s.shootType })))
    .sort((a, b) => a.shootDate.localeCompare(b.shootDate));

  const subject = useMemo(() => {
    const typeLabels: Record<EmailType, string> = {
      callsheet: "Call Sheet",
      creative: "Creative Brief",
      vendor: "Vendor Confirmation",
      update: "Status Update",
    };
    const wf = campaign.wfNumber ? `${campaign.wfNumber} ` : "";
    return `${wf}${campaign.name} — ${typeLabels[emailType]}`;
  }, [campaign.wfNumber, campaign.name, emailType]);

  const body = useMemo(() => {
    const lines: string[] = [];

    lines.push(campaign.name);
    if (campaign.wfNumber) lines.push(campaign.wfNumber);
    lines.push("");

    if (includes.shootDates && allDates.length > 0) {
      lines.push("SHOOT DATES");
      allDates.forEach((d) => {
        let line = format(parseISO(d.shootDate), "EEEE, MMMM d, yyyy");
        if (d.callTime) line += ` · Call: ${d.callTime}`;
        if (d.shootName) line += ` (${d.shootName})`;
        lines.push(line);
      });
      lines.push("");
    }

    if (includes.location) {
      const locations = [
        ...new Set(allDates.map((d) => d.location).filter(Boolean)),
      ];
      if (locations.length > 0) {
        lines.push("LOCATION");
        locations.forEach((l) => lines.push(l));
        lines.push("");
      }
    }

    if (includes.crewList) {
      const allCrew = shoots.flatMap((s) => s.crew);
      if (allCrew.length > 0) {
        lines.push("CREW");
        allCrew.forEach((c) => {
          const callPart = c.notes ? ` · ${c.notes}` : "";
          lines.push(`${c.roleOnShoot} — ${c.user?.name ?? "TBD"}${callPart}`);
        });
        lines.push("");
      }
    }

    if (includes.vendorList && vendors.length > 0) {
      lines.push("VENDORS");
      vendors.forEach((v) => {
        const contact = v.vendor?.contactName ? ` (${v.vendor.contactName})` : "";
        lines.push(`${v.vendor?.category ?? "Vendor"} — ${v.vendor?.companyName ?? ""}${contact}`);
      });
      lines.push("");
    }

    if (includes.assetsDue && campaign.assetsDeliveryDate) {
      lines.push("ASSETS DUE");
      lines.push(format(parseISO(campaign.assetsDeliveryDate), "MMMM d, yyyy"));
      lines.push("");
    }

    if (includes.budget && showFinancials) {
      lines.push("BUDGET");
      lines.push(`Total: $${financials.budget.toLocaleString()}`);
      lines.push(`Committed: $${financials.committed.toLocaleString()}`);
      lines.push(`Remaining: $${financials.remaining.toLocaleString()}`);
      lines.push("");
    }

    if (includes.notes && campaign.notes) {
      lines.push("NOTES");
      lines.push(campaign.notes);
      lines.push("");
    }

    return lines.join("\n");
  }, [campaign, shoots, vendors, allDates, includes, showFinancials, financials]);

  function openInMail() {
    const to = encodeURIComponent(customTo);
    const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");
  }

  return (
    <Modal open={open} onClose={onClose} title="Draft Email">
      <div className="space-y-5">
        {/* Email type selector */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Email Type
          </p>
          <div className="grid grid-cols-2 gap-2">
            {EMAIL_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => selectType(t.value)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  emailType === t.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30 hover:bg-surface-secondary"
                }`}
              >
                <p
                  className={`text-xs font-semibold ${
                    emailType === t.value ? "text-primary" : "text-text-primary"
                  }`}
                >
                  {t.label}
                </p>
                <p className="text-[10px] text-text-tertiary mt-0.5 leading-snug">
                  {t.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Recipients */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Send To
          </p>
          <div className="space-y-2.5">
            <input
              type="text"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              placeholder="Enter email address(es), comma-separated..."
              className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {vendors.length > 0 && (
              <p className="text-[10px] text-text-tertiary">
                Tip: assigned vendors — {vendors.map((v) => v.vendor?.email ?? v.vendor?.companyName).filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Content to include */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Include
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {(
              [
                { key: "shootDates" as const, label: "Shoot dates & call times" },
                { key: "location" as const, label: "Location" },
                { key: "crewList" as const, label: "Crew list" },
                { key: "vendorList" as const, label: "Vendor list" },
                { key: "assetsDue" as const, label: "Assets due date" },
                { key: "notes" as const, label: "Notes" },
                ...(showFinancials
                  ? [{ key: "budget" as const, label: "Budget summary" }]
                  : []),
              ] as Array<{ key: keyof Includes; label: string }>
            ).map((item) => (
              <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includes[item.key]}
                  onChange={() => toggle(item.key)}
                  className="rounded border-border accent-primary"
                />
                <span className="text-xs text-text-primary">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Subject preview */}
        <div className="rounded-lg bg-surface-secondary px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
            Subject
          </p>
          <p className="text-xs text-text-primary">{subject}</p>
        </div>
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={openInMail}>
          <Mail className="h-3.5 w-3.5" />
          Open in Mail
        </Button>
      </ModalFooter>
    </Modal>
  );
}
