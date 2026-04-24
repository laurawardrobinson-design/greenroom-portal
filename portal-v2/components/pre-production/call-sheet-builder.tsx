"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Aperture,
  Building2,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Download,
  Eye,
  EyeOff,
  FileText,
  Info,
  Loader2,
  Package,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { generateCallSheetPdf } from "@/lib/utils/pdf-generator";
import { useCallSheetDraft, type SaveState } from "@/hooks/use-call-sheet-draft";
import type {
  Shoot,
  CallSheetContent,
  CallSheetCrewRow,
  CallSheetTalentRow,
} from "@/types/domain";

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

export function CallSheetBuilder({
  campaignId,
  campaignName,
  wfNumber,
  shoots,
}: Props) {
  const allDates = useMemo(
    () =>
      shoots
        .flatMap((s) =>
          s.dates.map((d) => ({
            ...d,
            shootName: s.name,
            shootId: s.id,
            shootLocation: s.location,
          }))
        )
        .sort((a, b) => a.shootDate.localeCompare(b.shootDate)),
    [shoots]
  );

  const [selectedDateId, setSelectedDateId] = useState(allDates[0]?.id || "");
  const selectedDate = allDates.find((d) => d.id === selectedDateId);
  const [showPreview, setShowPreview] = useState(true);

  const {
    sheet,
    content,
    isLoading,
    saveState,
    lastSavedAt,
    updateContent,
    publish,
    publishError,
  } = useCallSheetDraft(campaignId, selectedDateId || null);

  // ─── Crew / Talent mutations ────────────────────────────────────────────────
  const setCrew = (next: CallSheetCrewRow[]) => updateContent({ crew: next });
  const setTalent = (next: CallSheetTalentRow[]) => updateContent({ talent: next });

  const addCrew = () => {
    if (!content) return;
    setCrew([
      ...content.crew,
      {
        id: `new-${Date.now()}`,
        name: "",
        role: "",
        dept: "",
        phone: "",
        email: "",
        callTime: content.generalCallTime || "",
        contactVisibility: "full",
      },
    ]);
  };

  const updateCrew = (id: string, field: keyof CallSheetCrewRow, value: string) => {
    if (!content) return;
    setCrew(
      content.crew.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };

  const removeCrew = (id: string) => {
    if (!content) return;
    setCrew(content.crew.filter((c) => c.id !== id));
  };

  const addTalent = () => {
    if (!content) return;
    setTalent([
      ...content.talent,
      {
        id: `new-talent-${Date.now()}`,
        name: "",
        role: "Talent",
        phone: "",
        email: "",
        callTime: content.generalCallTime || "",
        makeupWardrobeCall: "",
        pickupTime: "",
        agency: "",
      },
    ]);
  };

  const updateTalent = (id: string, field: keyof CallSheetTalentRow, value: string) => {
    if (!content) return;
    setTalent(
      content.talent.map((t) =>
        t.id === id ? { ...t, [field]: value } : t
      )
    );
  };

  const removeTalent = (id: string) => {
    if (!content) return;
    setTalent(content.talent.filter((t) => t.id !== id));
  };

  // ─── Download ──────────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!content || !selectedDate) return;
    const dayIdx = allDates.findIndex((d) => d.id === selectedDateId);
    const doc = generateCallSheetPdf({
      campaignName,
      wfNumber,
      shootDate: selectedDate.shootDate,
      location: content.location,
      callTime: content.generalCallTime || null,
      crew: content.crew
        .filter((c) => c.role !== "Producer")
        .map((c) => ({
          name: c.name,
          role: c.role,
          phone: c.contactVisibility === "full" ? c.phone : "",
          email:
            c.contactVisibility === "full"
              ? c.email
              : "reach out to producer for contact",
          callTime: c.callTime || null,
        })),
      vendors: content.talent.map((t) => ({
        company: t.agency,
        contact: t.name,
        phone: t.phone,
        email: t.email,
        role: "Talent",
      })),
      deliverables: [],
      notes: content.specialInstructions,
      producer: content.producer,
      companyName: content.companyName,
      companyAddress: content.companyAddress,
      parkingDirections: content.parkingDirections,
      weatherNotes: content.weatherNotes,
      emergencyHospital: content.emergencyHospital,
      emergencyAddress: content.emergencyAddress,
      emergencyPhone: content.emergencyPhone,
      specialInstructions: content.specialInstructions,
      safetyReminders: content.safetyReminders,
      producerEmail: content.producer?.email || "",
      dayNumber: dayIdx >= 0 ? dayIdx + 1 : undefined,
      totalDays: allDates.length > 1 ? allDates.length : undefined,
    });

    const dateStr = format(parseISO(selectedDate.shootDate), "MMdd");
    doc.save(`${wfNumber}_CallSheet_${dateStr}.pdf`);
  };

  const handlePublish = async () => {
    const result = await publish();
    if (result) {
      // Leave in-UI messaging to publishError state; success swaps the badge
    }
  };

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (allDates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
          <FileText className="h-4 w-4 text-text-tertiary" />
        </div>
        <p className="text-sm text-text-tertiary">No shoot dates scheduled yet.</p>
        <p className="text-xs text-text-tertiary">
          Add shoot dates from the campaign detail page to build a call sheet.
        </p>
      </div>
    );
  }

  if (isLoading || !content) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-text-tertiary">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading call sheet…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {allDates.length > 1 ? (
            <select
              value={selectedDateId}
              onChange={(e) => setSelectedDateId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none"
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

          <SaveStatusPill state={saveState} lastSavedAt={lastSavedAt} />

          {sheet?.currentVNumber !== null && sheet?.currentVNumber !== undefined && (
            <VersionStamp vNumber={sheet.currentVNumber} />
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>

          <button
            type="button"
            onClick={handlePublish}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <Send className="h-4 w-4" />
            Publish
          </button>
        </div>
      </div>

      {publishError && (
        <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-error)]/30 bg-[color:var(--color-error)]/8 px-3 py-2 text-xs text-[color:var(--color-error)]">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          {publishError}
        </div>
      )}

      {/* Two-column: form + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── LEFT: Editable form ─── */}
        <div className="space-y-5">
          <FormSection title="Company Info" icon={Building2}>
            <FormField
              label="Company Name"
              value={content.companyName}
              onChange={(v) => updateContent({ companyName: v })}
            />
            <FormTextarea
              label="Address & Phone"
              value={content.companyAddress}
              onChange={(v) => updateContent({ companyAddress: v })}
              rows={3}
            />
          </FormSection>

          <FormSection title="Shoot Details" icon={Aperture}>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="General Call Time"
                value={content.generalCallTime}
                onChange={(v) => updateContent({ generalCallTime: v })}
                placeholder="8:30 AM"
              />
              <FormField
                label="Estimated Wrap"
                value={content.estimatedWrap}
                onChange={(v) => updateContent({ estimatedWrap: v })}
                placeholder="6:30 PM"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Breakfast"
                value={content.breakfastTime}
                onChange={(v) => updateContent({ breakfastTime: v })}
                placeholder="8:00 AM"
              />
              <FormField
                label="Lunch"
                value={content.lunchTime}
                onChange={(v) => updateContent({ lunchTime: v })}
                placeholder="12:30 PM"
              />
            </div>
            <FormField
              label="Lunch Venue"
              value={content.lunchVenue}
              onChange={(v) => updateContent({ lunchVenue: v })}
              placeholder="On-site / catering vendor"
            />
            <FormTextarea
              label="Location"
              value={content.location}
              onChange={(v) => updateContent({ location: v })}
              rows={2}
              placeholder="Studio name and address"
            />
            <FormTextarea
              label="Parking / Directions"
              value={content.parkingDirections}
              onChange={(v) => updateContent({ parkingDirections: v })}
              rows={2}
              placeholder="Turn onto Lone Palm Dr..."
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Walkie Channels"
                value={content.walkieChannels}
                onChange={(v) => updateContent({ walkieChannels: v })}
                placeholder="1 Production, 2 Food Stylist..."
              />
              <FormField
                label="Company Moves"
                value={content.companyMoves}
                onChange={(v) => updateContent({ companyMoves: v })}
                placeholder="11 AM to Studio B"
              />
            </div>
          </FormSection>

          <FormSection title="Weather & Environment" icon={Cloud}>
            <FormField
              label="Weather"
              value={content.weatherNotes}
              onChange={(v) => updateContent({ weatherNotes: v })}
              placeholder="Sunny, 78°F"
            />
            <div className="grid grid-cols-3 gap-3">
              <FormField
                label="Sunrise"
                value={content.sunrise}
                onChange={(v) => updateContent({ sunrise: v })}
                placeholder="6:42 AM"
              />
              <FormField
                label="Sunset"
                value={content.sunset}
                onChange={(v) => updateContent({ sunset: v })}
                placeholder="7:58 PM"
              />
              <FormField
                label="Golden Hour"
                value={content.goldenHour}
                onChange={(v) => updateContent({ goldenHour: v })}
                placeholder="7:20 PM"
              />
            </div>
          </FormSection>

          <FormSection title="Safety & Emergency" icon={AlertTriangle}>
            <FormField
              label="Hospital Name"
              value={content.emergencyHospital}
              onChange={(v) => updateContent({ emergencyHospital: v })}
              placeholder="Lakeland Regional Medical Center"
              required
            />
            <FormField
              label="Hospital Address"
              value={content.emergencyAddress}
              onChange={(v) => updateContent({ emergencyAddress: v })}
              required
            />
            <FormField
              label="Hospital Phone"
              value={content.emergencyPhone}
              onChange={(v) => updateContent({ emergencyPhone: v })}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Urgent Care"
                value={content.urgentCareName}
                onChange={(v) => updateContent({ urgentCareName: v })}
              />
              <FormField
                label="Urgent Care Phone"
                value={content.urgentCarePhone}
                onChange={(v) => updateContent({ urgentCarePhone: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Police Non-Emergency"
                value={content.policeNonEmergencyPhone}
                onChange={(v) => updateContent({ policeNonEmergencyPhone: v })}
              />
              <FormField
                label="On-Set Medic"
                value={content.onSetMedic}
                onChange={(v) => updateContent({ onSetMedic: v })}
              />
            </div>
          </FormSection>

          <FormSection title="Allergen & Food Safety" icon={ShieldAlert}>
            <FormTextarea
              label=""
              value={content.allergenBulletin}
              onChange={(v) => updateContent({ allergenBulletin: v })}
              rows={4}
            />
          </FormSection>

          <FormSection title="Crew Contacts" icon={Users}>
            <div className="space-y-2">
              {content.crew.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[100px_1fr_120px_80px_28px] gap-1.5 items-start"
                >
                  <input
                    value={c.role}
                    onChange={(e) => updateCrew(c.id, "role", e.target.value)}
                    placeholder="Title"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none"
                  />
                  <input
                    value={c.name}
                    onChange={(e) => updateCrew(c.id, "name", e.target.value)}
                    placeholder="Name"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none"
                  />
                  <input
                    value={c.phone}
                    onChange={(e) => updateCrew(c.id, "phone", e.target.value)}
                    placeholder="Phone"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none"
                  />
                  <input
                    value={c.callTime}
                    onChange={(e) => updateCrew(c.id, "callTime", e.target.value)}
                    placeholder="Call"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none"
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

          <FormSection title="Talent" icon={Sparkles}>
            <div className="space-y-2">
              {content.talent.map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[1fr_120px_80px_100px_28px] gap-1.5 items-start"
                >
                  <input
                    value={t.name}
                    onChange={(e) => updateTalent(t.id, "name", e.target.value)}
                    placeholder="Name"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none"
                  />
                  <input
                    value={t.phone}
                    onChange={(e) => updateTalent(t.id, "phone", e.target.value)}
                    placeholder="Phone"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none"
                  />
                  <input
                    value={t.callTime}
                    onChange={(e) => updateTalent(t.id, "callTime", e.target.value)}
                    placeholder="Call"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none"
                  />
                  <input
                    value={t.agency}
                    onChange={(e) => updateTalent(t.id, "agency", e.target.value)}
                    placeholder="Agency"
                    className="rounded border border-border bg-surface px-2 py-1.5 text-xs focus:outline-none"
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

          <FormSection title="Special Instructions" icon={Info}>
            <FormTextarea
              label=""
              value={content.specialInstructions}
              onChange={(v) => updateContent({ specialInstructions: v })}
              rows={3}
              placeholder="Any last-minute notes for crew..."
            />
          </FormSection>

          <FormSection title="Safety Reminders" icon={ShieldAlert}>
            <FormTextarea
              label=""
              value={content.safetyReminders}
              onChange={(v) => updateContent({ safetyReminders: v })}
              rows={6}
            />
          </FormSection>
        </div>

        {/* ─── RIGHT: Preview ─── */}
        <div className={`${showPreview ? "block" : "hidden"} lg:block`}>
          <div className="sticky top-4">
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border bg-surface-secondary/50 px-3.5 py-2.5">
                <Eye className="h-4 w-4 shrink-0 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                  Call Sheet Preview
                </h3>
              </div>
              <div className="p-4">
                <div className="bg-white rounded border border-border p-3 space-y-3 text-[10px] text-text-primary overflow-y-auto max-h-[600px]">
                  <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                    <div>
                      <p className="font-bold text-[10px]">{content.companyName}</p>
                      <p className="text-[10px] text-gray-500 whitespace-pre-line">
                        {content.companyAddress}
                      </p>
                      {content.producer && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          {content.producer.email}
                          <br />
                          {content.producer.phone}
                        </p>
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
                      <p className="font-bold mt-1">
                        CREW CALL: {content.generalCallTime || "TBD"}
                      </p>
                      {content.estimatedWrap && (
                        <p className="text-[10px]">EST WRAP: {content.estimatedWrap}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">Weather</p>
                      <p>{content.weatherNotes || "—"}</p>
                      {content.sunrise && content.sunset && (
                        <p className="text-[10px] text-gray-500 mt-1">
                          Sunrise {content.sunrise} · Sunset {content.sunset}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-b border-gray-200 pb-2">
                    <div>
                      <p className="font-bold">Shoot Location</p>
                      <p className="text-[10px] text-gray-500 whitespace-pre-line">
                        {content.location || "TBD"}
                      </p>
                      {content.parkingDirections && (
                        <p className="text-[10px] text-gray-500 mt-1 whitespace-pre-line">
                          {content.parkingDirections}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="font-bold">Emergency</p>
                      <p className="text-[10px] text-gray-500">Dial 911</p>
                      {content.emergencyHospital && (
                        <p className="text-[10px] text-gray-500">{content.emergencyHospital}</p>
                      )}
                      {content.emergencyPhone && (
                        <p className="text-[10px] text-gray-500">{content.emergencyPhone}</p>
                      )}
                      {content.onSetMedic && (
                        <p className="text-[10px] text-gray-500">Medic: {content.onSetMedic}</p>
                      )}
                    </div>
                    <div>
                      <p className="font-bold">Job Number</p>
                      <p className="text-[10px] text-gray-500">
                        {wfNumber} {campaignName}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="font-bold mb-1">Crew Contacts</p>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-200 px-1 py-0.5 text-left text-[10px]">
                            Title
                          </th>
                          <th className="border border-gray-200 px-1 py-0.5 text-left text-[10px]">
                            Name
                          </th>
                          <th className="border border-gray-200 px-1 py-0.5 text-left text-[10px]">
                            Contact
                          </th>
                          <th className="border border-gray-200 px-1 py-0.5 text-left text-[10px]">
                            Call
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {content.crew.map((c) => (
                          <tr key={c.id}>
                            <td className="border border-gray-200 px-1 py-0.5 text-[10px]">
                              {c.role}
                            </td>
                            <td className="border border-gray-200 px-1 py-0.5 text-[10px]">
                              {c.name}
                            </td>
                            <td className="border border-gray-200 px-1 py-0.5 text-[10px]">
                              {c.contactVisibility === "full"
                                ? c.email
                                : "reach out to producer"}
                            </td>
                            <td className="border border-gray-200 px-1 py-0.5 text-[10px]">
                              {c.callTime}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {content.talent.length > 0 && (
                    <div>
                      <p className="font-bold mb-1">Talent</p>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-1 py-0.5 text-left text-[10px]">
                              Role
                            </th>
                            <th className="border border-gray-200 px-1 py-0.5 text-left text-[10px]">
                              Name
                            </th>
                            <th className="border border-gray-200 px-1 py-0.5 text-left text-[10px]">
                              Contact
                            </th>
                            <th className="border border-gray-200 px-1 py-0.5 text-left text-[10px]">
                              Call
                            </th>
                            <th className="border border-gray-200 px-1 py-0.5 text-left text-[10px]">
                              Agency
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {content.talent.map((t) => (
                            <tr key={t.id}>
                              <td className="border border-gray-200 px-1 py-0.5 text-[10px]">
                                {t.role}
                              </td>
                              <td className="border border-gray-200 px-1 py-0.5 text-[10px]">
                                {t.name}
                              </td>
                              <td className="border border-gray-200 px-1 py-0.5 text-[10px]">
                                {t.email}
                              </td>
                              <td className="border border-gray-200 px-1 py-0.5 text-[10px]">
                                {t.callTime}
                              </td>
                              <td className="border border-gray-200 px-1 py-0.5 text-[10px]">
                                {t.agency}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {sheet && sheet.liveDeliveries.length > 0 && (
                    <div className="border-t border-gray-200 pt-2">
                      <p className="font-bold mb-1 flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Deliveries Today
                      </p>
                      <div className="space-y-2">
                        {sheet.liveDeliveries.map((block) => (
                          <div key={`${block.docId}-${block.department}`} className="border border-gray-200 rounded p-1.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="font-semibold text-[10px]">
                                {block.department}
                                {block.pickupTime && (
                                  <span className="font-normal text-gray-500"> · {block.pickupTime}</span>
                                )}
                                {block.pickupPerson && (
                                  <span className="font-normal text-gray-500"> · pickup: {block.pickupPerson}</span>
                                )}
                              </p>
                              <span className="text-[10px] text-gray-500">{block.docNumber}</span>
                            </div>
                            <table className="w-full border-collapse">
                              <tbody>
                                {block.items.map((item, i) => (
                                  <tr key={i}>
                                    <td className="py-0.5 text-[10px]">{item.name}</td>
                                    <td className="py-0.5 text-[10px] text-right w-12">×{item.quantity}</td>
                                    <td className="py-0.5 text-[10px] text-gray-500 pl-2">{item.notes}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-2">
                    <p className="text-[10px] text-gray-500 whitespace-pre-line">
                      {content.safetyReminders}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Save status pill ────────────────────────────────────────────────────────
function SaveStatusPill({
  state,
  lastSavedAt,
}: {
  state: SaveState;
  lastSavedAt: Date | null;
}) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-text-secondary">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-[color:var(--color-error)]/8 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-error)]">
        <CircleAlert className="h-3 w-3" />
        Save failed
      </span>
    );
  }
  if (state === "saved" || (state === "idle" && lastSavedAt)) {
    const when = lastSavedAt ? format(lastSavedAt, "h:mm a") : null;
    return (
      <span className="flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        <CheckCircle2 className="h-3 w-3 text-[color:var(--color-success)]" />
        {when ? `Saved ${when}` : "Saved"}
      </span>
    );
  }
  if (state === "dirty") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Unsaved
      </span>
    );
  }
  return null;
}

function VersionStamp({ vNumber }: { vNumber: number }) {
  if (!vNumber) return null;
  return (
    <span className="flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-text-secondary">
      v{vNumber}
    </span>
  );
}

// ─── Form helpers ────────────────────────────────────────────────────────────
function FormSection({
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
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
          {title}
        </h3>
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
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      {label && (
        <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
          {label}
          {required && <span className="text-[color:var(--color-error)]">*</span>}
        </label>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
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
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none resize-y"
      />
    </div>
  );
}
