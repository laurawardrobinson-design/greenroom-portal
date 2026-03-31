"use client";

import { useState, useEffect, useMemo } from "react";
import { Download, FileText, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { generateCallSheetPdf } from "@/lib/utils/pdf-generator";
import type { Shoot, AppUser } from "@/types/domain";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  shoots: Shoot[];
  vendors: Array<{
    id: string;
    vendor?: {
      companyName: string;
      contactName: string;
      phone: string;
      email: string;
      category: string;
    };
  }>;
  producerId: string | null;
}

interface CrewEntry {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  callTime: string;
  contactVisibility: "full" | "producer-only";
}

interface TalentEntry {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  callTime: string;
  agency: string;
}

export function CallSheetBuilder({
  campaignId,
  campaignName,
  wfNumber,
  shoots,
  vendors,
  producerId,
}: Props) {
  // Flatten dates
  const allDates = shoots.flatMap((s) =>
    s.dates.map((d) => ({ ...d, shootName: s.name, shootId: s.id, shootLocation: s.location }))
  ).sort((a, b) => a.shootDate.localeCompare(b.shootDate));

  const [selectedDateId, setSelectedDateId] = useState(allDates[0]?.id || "");
  const selectedDate = allDates.find((d) => d.id === selectedDateId);
  const selectedShoot = shoots.find((s) =>
    s.dates.some((d) => d.id === selectedDateId)
  );

  // Fetch users for crew details
  const { data: allUsers = [] } = useSWR<AppUser[]>("/api/users", fetcher);
  const producer = allUsers.find((u) => u.id === producerId);

  // Fetch shoot_date extra fields
  const { data: dateFields } = useSWR(
    selectedDateId ? `/api/campaigns/${campaignId}/schedule` : null,
    fetcher
  );

  const [showPreview, setShowPreview] = useState(true);

  // ─── Form state ────────────────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState("Publix Corporate");
  const [companyAddress, setCompanyAddress] = useState(
    "3300 Publix Corporate Pkwy\nLakeland, FL 33811\n863-688-1188"
  );
  const [location, setLocation] = useState("");
  const [parkingDirections, setParkingDirections] = useState("");
  const [generalCallTime, setGeneralCallTime] = useState("");
  const [weatherNotes, setWeatherNotes] = useState("");
  const [emergencyHospital, setEmergencyHospital] = useState("");
  const [emergencyAddress, setEmergencyAddress] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [safetyReminders, setSafetyReminders] = useState(
    "Safety Reminders:\nAlways wear closed toe shoes.\nDress for EXT or INT shoots with safety in mind.\nReview call sheets for safety information.\nKnow where the first aid kit is located (ask the producer).\nBe mindful of common production hazards:\n  Tripping (wires, cables, boxes)\n  Falling Objects (lighting, flags, stands)\n  Electrical (breakout boxes and high voltage cabling)\n  Vehicles\n  Water"
  );

  // Crew list (pre-populated from shoot crew)
  const [crewList, setCrewList] = useState<CrewEntry[]>([]);
  const [talentList, setTalentList] = useState<TalentEntry[]>([]);

  // Pre-populate when selected date changes
  // Only re-run when the selected date ID changes (not on every render)
  const selectedDateIdRef = selectedDateId;
  useEffect(() => {
    const curDate = allDates.find((d) => d.id === selectedDateIdRef);
    const curShoot = shoots.find((s) =>
      s.dates.some((d) => d.id === selectedDateIdRef)
    );
    const curProducer = allUsers.find((u) => u.id === producerId);

    if (!curDate) return;

    // Location
    setLocation(curDate.location || curShoot?.location || "");
    setGeneralCallTime(curDate.callTime || "");

    // Build crew from shoot crew assignments
    const shootCrew = curShoot?.crew || [];
    const entries: CrewEntry[] = [];

    // Add producer first
    if (curProducer) {
      entries.push({
        id: `producer-${curProducer.id}`,
        name: curProducer.name,
        role: "Producer",
        phone: curProducer.phone || "",
        email: curProducer.email || "",
        callTime: curDate.callTime || "",
        contactVisibility: "full",
      });
    }

    // Add shoot crew
    for (const c of shootCrew) {
      if (c.user && c.userId !== producerId) {
        entries.push({
          id: c.id,
          name: c.user.name,
          role: c.roleOnShoot || c.user.role,
          phone: c.user.phone || "",
          email: c.user.email || "",
          callTime: curDate.callTime || "",
          contactVisibility: "full",
        });
      }
    }

    // Add non-talent vendors as crew
    for (const cv of vendors) {
      if (cv.vendor && cv.vendor.category?.toLowerCase() !== "talent") {
        entries.push({
          id: `vendor-${cv.id}`,
          name: cv.vendor.contactName || cv.vendor.companyName,
          role: cv.vendor.category || cv.vendor.companyName,
          phone: cv.vendor.phone || "",
          email: cv.vendor.email || "",
          callTime: curDate.callTime || "",
          contactVisibility: "full",
        });
      }
    }

    setCrewList(entries);

    // Add talent vendors
    const talentEntries: TalentEntry[] = vendors
      .filter((cv) => cv.vendor?.category?.toLowerCase() === "talent")
      .map((cv) => ({
        id: `talent-${cv.id}`,
        name: cv.vendor?.contactName || cv.vendor?.companyName || "",
        role: "Talent",
        phone: cv.vendor?.phone || "",
        email: cv.vendor?.email || "",
        callTime: curDate.callTime || "",
        agency: cv.vendor?.companyName || "",
      }));

    setTalentList(talentEntries);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateIdRef, producerId]);

  // ─── Crew/Talent editing ───────────────────────────────────────────────────
  const updateCrew = (id: string, field: keyof CrewEntry, value: string) => {
    setCrewList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const addCrew = () => {
    setCrewList((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: "",
        role: "",
        phone: "",
        email: "",
        callTime: generalCallTime,
        contactVisibility: "full" as const,
      },
    ]);
  };

  const removeCrew = (id: string) => {
    setCrewList((prev) => prev.filter((c) => c.id !== id));
  };

  const addTalent = () => {
    setTalentList((prev) => [
      ...prev,
      {
        id: `new-talent-${Date.now()}`,
        name: "",
        role: "Talent",
        phone: "",
        email: "",
        callTime: generalCallTime,
        agency: "",
      },
    ]);
  };

  const removeTalent = (id: string) => {
    setTalentList((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTalent = (id: string, field: keyof TalentEntry, value: string) => {
    setTalentList((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  // ─── Download PDF ──────────────────────────────────────────────────────────
  const handleDownload = () => {
    const dayIdx = allDates.findIndex((d) => d.id === selectedDateId);

    const doc = generateCallSheetPdf({
      campaignName,
      wfNumber,
      shootDate: selectedDate?.shootDate || "",
      location,
      callTime: generalCallTime || null,
      crew: crewList
        .filter((c) => c.role !== "Producer")
        .map((c) => ({
          name: c.name,
          role: c.role,
          phone: c.contactVisibility === "full" ? c.phone : "",
          email: c.contactVisibility === "full" ? c.email : "reach out to producer for contact",
          callTime: c.callTime || null,
        })),
      vendors: [
        ...vendors
          .filter((cv) => cv.vendor?.category?.toLowerCase() !== "talent")
          .map((cv) => ({
            company: cv.vendor?.companyName || "",
            contact: cv.vendor?.contactName || "",
            phone: cv.vendor?.phone || "",
            email: cv.vendor?.email || "",
            role: cv.vendor?.category || "",
          })),
        ...talentList.map((t) => ({
          company: t.agency,
          contact: t.name,
          phone: t.phone,
          email: t.email,
          role: "Talent",
        })),
      ],
      deliverables: [],
      notes: "",
      producer: producer
        ? { name: producer.name, phone: producer.phone || "", email: producer.email || "" }
        : null,
      companyName,
      companyAddress,
      parkingDirections,
      weatherNotes,
      emergencyHospital,
      emergencyAddress,
      emergencyPhone,
      specialInstructions,
      safetyReminders,
      producerEmail: producer?.email || "",
      dayNumber: dayIdx >= 0 ? dayIdx + 1 : undefined,
      totalDays: allDates.length > 1 ? allDates.length : undefined,
    });

    const dateStr = selectedDate?.shootDate
      ? format(parseISO(selectedDate.shootDate), "MMdd")
      : "callsheet";
    doc.save(`${wfNumber}_CallSheet_${dateStr}.pdf`);
  };

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (allDates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
          <FileText className="h-4 w-4 text-text-tertiary" />
        </div>
        <p className="text-sm text-text-tertiary">No shoot dates scheduled yet.</p>
        <p className="text-xs text-text-tertiary">Add shoot dates from the campaign detail page to build a call sheet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date selector + Download */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {allDates.length > 1 ? (
            <select
              value={selectedDateId}
              onChange={(e) => setSelectedDateId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {allDates.map((d, i) => (
                <option key={d.id} value={d.id}>
                  Day {i + 1} — {format(parseISO(d.shootDate), "EEE, MMM d")}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm font-medium text-text-primary">
              {format(parseISO(allDates[0].shootDate), "EEEE, MMMM d, yyyy")}
            </p>
          )}

          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:bg-surface-secondary transition-colors lg:hidden"
          >
            {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showPreview ? "Hide Preview" : "Preview"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <Download className="h-4 w-4" />
          Download Call Sheet
        </button>
      </div>

      {/* Two-column: form + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── LEFT: Editable form ─── */}
        <div className="space-y-5">
          {/* Company Info */}
          <FormSection title="Company Info">
            <FormField label="Company Name" value={companyName} onChange={setCompanyName} />
            <FormTextarea label="Address & Phone" value={companyAddress} onChange={setCompanyAddress} rows={3} />
          </FormSection>

          {/* Shoot Details */}
          <FormSection title="Shoot Details">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="General Call Time" value={generalCallTime} onChange={setGeneralCallTime} placeholder="8:30 AM" />
              <FormField label="Weather" value={weatherNotes} onChange={setWeatherNotes} placeholder="Sunny, 78°F" />
            </div>
            <FormTextarea label="Location" value={location} onChange={setLocation} rows={2} placeholder="Studio name and address" />
            <FormTextarea label="Parking / Directions" value={parkingDirections} onChange={setParkingDirections} rows={2} placeholder="Turn onto Lone Palm Dr..." />
          </FormSection>

          {/* Emergency */}
          <FormSection title="Emergency Info">
            <FormField label="Hospital Name" value={emergencyHospital} onChange={setEmergencyHospital} placeholder="Lakeland Regional Medical Center" />
            <FormField label="Hospital Address" value={emergencyAddress} onChange={setEmergencyAddress} />
            <FormField label="Hospital Phone" value={emergencyPhone} onChange={setEmergencyPhone} />
          </FormSection>

          {/* Crew Contacts */}
          <FormSection title="Crew Contacts">
            <div className="space-y-2">
              {crewList.map((c) => (
                <div key={c.id} className="grid grid-cols-[100px_1fr_120px_80px_28px] gap-1.5 items-start">
                  <input
                    value={c.role}
                    onChange={(e) => updateCrew(c.id, "role", e.target.value)}
                    placeholder="Title"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    value={c.name}
                    onChange={(e) => updateCrew(c.id, "name", e.target.value)}
                    placeholder="Name"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    value={c.phone}
                    onChange={(e) => updateCrew(c.id, "phone", e.target.value)}
                    placeholder="Phone"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    value={c.callTime}
                    onChange={(e) => updateCrew(c.id, "callTime", e.target.value)}
                    placeholder="Call"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => removeCrew(c.id)}
                    className="flex items-center justify-center h-7 w-7 rounded hover:bg-surface-secondary text-text-tertiary transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addCrew}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="h-3 w-3" /> Add crew member
              </button>
            </div>
          </FormSection>

          {/* Talent */}
          <FormSection title="Talent">
            <div className="space-y-2">
              {talentList.map((t) => (
                <div key={t.id} className="grid grid-cols-[1fr_120px_80px_100px_28px] gap-1.5 items-start">
                  <input
                    value={t.name}
                    onChange={(e) => updateTalent(t.id, "name", e.target.value)}
                    placeholder="Name"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    value={t.phone}
                    onChange={(e) => updateTalent(t.id, "phone", e.target.value)}
                    placeholder="Phone"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    value={t.callTime}
                    onChange={(e) => updateTalent(t.id, "callTime", e.target.value)}
                    placeholder="Call"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    value={t.agency}
                    onChange={(e) => updateTalent(t.id, "agency", e.target.value)}
                    placeholder="Agency"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => removeTalent(t.id)}
                    className="flex items-center justify-center h-7 w-7 rounded hover:bg-surface-secondary text-text-tertiary transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addTalent}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="h-3 w-3" /> Add talent
              </button>
            </div>
          </FormSection>

          {/* Special Instructions */}
          <FormSection title="Special Instructions">
            <FormTextarea
              label=""
              value={specialInstructions}
              onChange={setSpecialInstructions}
              rows={3}
              placeholder="Any last-minute notes for crew..."
            />
          </FormSection>

          {/* Safety */}
          <FormSection title="Safety Reminders">
            <FormTextarea
              label=""
              value={safetyReminders}
              onChange={setSafetyReminders}
              rows={6}
            />
          </FormSection>
        </div>

        {/* ─── RIGHT: PDF Preview ─── */}
        <div className={`${showPreview ? "block" : "hidden"} lg:block`}>
          <div className="sticky top-4">
            <div className="rounded-lg border border-border bg-surface-secondary p-4 overflow-hidden">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">Call Sheet Preview</p>

              {/* Mini preview — simplified text representation */}
              <div className="bg-white rounded border border-border p-3 space-y-3 text-[10px] font-mono text-text-primary overflow-y-auto max-h-[600px]">
                {/* Header */}
                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                  <div>
                    <p className="font-bold text-[10px]">{companyName}</p>
                    <p className="text-[9px] text-gray-500 whitespace-pre-line">{companyAddress}</p>
                    {producer && (
                      <p className="text-[9px] text-gray-500 mt-1">{producer.email}<br />{producer.phone}</p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-[11px]">
                      {selectedDate
                        ? format(parseISO(selectedDate.shootDate), "EEEE").toUpperCase()
                        : "DATE TBD"}
                    </p>
                    <p className="text-[10px]">
                      {selectedDate
                        ? format(parseISO(selectedDate.shootDate), "MMMM d, yyyy")
                        : ""}
                    </p>
                    <p className="font-bold mt-1">CREW CALL: {generalCallTime || "TBD"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500">Weather</p>
                    <p>{weatherNotes || "—"}</p>
                  </div>
                </div>

                {/* Location / Emergency */}
                <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                  <div>
                    <p className="font-bold">Shoot Location</p>
                    <p className="text-[9px] text-gray-500 whitespace-pre-line">{location || "TBD"}</p>
                    {parkingDirections && (
                      <p className="text-[9px] text-gray-500 mt-1 whitespace-pre-line">{parkingDirections}</p>
                    )}
                  </div>
                  <div>
                    <p className="font-bold">Emergency</p>
                    <p className="text-[9px] text-gray-500">Dial 911</p>
                    {emergencyHospital && <p className="text-[9px] text-gray-500">{emergencyHospital}</p>}
                  </div>
                  <div>
                    <p className="font-bold">Job Number</p>
                    <p className="text-[9px] text-gray-500">{wfNumber} {campaignName}</p>
                  </div>
                </div>

                {/* Crew table */}
                <div>
                  <p className="font-bold mb-1">Crew Contacts</p>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-1 py-0.5 text-left text-[9px]">Title</th>
                        <th className="border border-gray-200 px-1 py-0.5 text-left text-[9px]">Name</th>
                        <th className="border border-gray-200 px-1 py-0.5 text-left text-[9px]">Contact</th>
                        <th className="border border-gray-200 px-1 py-0.5 text-left text-[9px]">Call</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crewList.map((c) => (
                        <tr key={c.id}>
                          <td className="border border-gray-200 px-1 py-0.5 text-[9px]">{c.role}</td>
                          <td className="border border-gray-200 px-1 py-0.5 text-[9px]">{c.name}</td>
                          <td className="border border-gray-200 px-1 py-0.5 text-[9px]">
                            {c.contactVisibility === "full" ? `${c.email}` : "reach out to producer"}
                          </td>
                          <td className="border border-gray-200 px-1 py-0.5 text-[9px]">{c.callTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Talent table */}
                {talentList.length > 0 && (
                  <div>
                    <p className="font-bold mb-1">Talent</p>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-200 px-1 py-0.5 text-left text-[9px]">Role</th>
                          <th className="border border-gray-200 px-1 py-0.5 text-left text-[9px]">Name</th>
                          <th className="border border-gray-200 px-1 py-0.5 text-left text-[9px]">Contact</th>
                          <th className="border border-gray-200 px-1 py-0.5 text-left text-[9px]">Call</th>
                          <th className="border border-gray-200 px-1 py-0.5 text-left text-[9px]">Agency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {talentList.map((t) => (
                          <tr key={t.id}>
                            <td className="border border-gray-200 px-1 py-0.5 text-[9px]">{t.role}</td>
                            <td className="border border-gray-200 px-1 py-0.5 text-[9px]">{t.name}</td>
                            <td className="border border-gray-200 px-1 py-0.5 text-[9px]">{t.email}</td>
                            <td className="border border-gray-200 px-1 py-0.5 text-[9px]">{t.callTime}</td>
                            <td className="border border-gray-200 px-1 py-0.5 text-[9px]">{t.agency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Safety */}
                <div className="border-t border-gray-200 pt-2">
                  <p className="text-[9px] text-gray-500 whitespace-pre-line">{safetyReminders}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Form helpers ────────────────────────────────────────────────────────────
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{title}</h3>
      </div>
      <div className="p-3.5 space-y-3">{children}</div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">{label}</label>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function FormTextarea({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  placeholder?: string;
}) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">{label}</label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
      />
    </div>
  );
}
