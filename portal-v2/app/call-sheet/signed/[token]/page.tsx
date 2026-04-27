"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, Package } from "lucide-react";
import type {
  CallSheetContent,
  CallSheetDeliveryBlock,
  CallSheetTier,
  CallSheetVersion,
} from "@/types/domain";

type SignedResponse = {
  version: CallSheetVersion;
  tier: CallSheetTier;
  ackedAt: string | null;
  distributionId: string;
  campaignName: string;
  wfNumber: string;
  producerLine: string;
  payload: CallSheetContent & { deliveries?: CallSheetDeliveryBlock[] };
};

export default function SignedCallSheetPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [data, setData] = useState<SignedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acking, setAcking] = useState(false);
  const [ackedAt, setAckedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/call-sheets/signed/${token}`);
        if (!r.ok) {
          if (!cancelled) setError("This link is no longer valid.");
          return;
        }
        const body = (await r.json()) as SignedResponse;
        if (cancelled) return;
        setData(body);
        setAckedAt(body.ackedAt);
      } catch {
        if (!cancelled) setError("Couldn't load this call sheet.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAck = async () => {
    if (!token) return;
    setAcking(true);
    try {
      const r = await fetch(`/api/call-sheets/signed/${token}/ack`, { method: "POST" });
      if (r.ok) {
        const body = (await r.json()) as { ackedAt?: string; alreadyAcked?: boolean };
        setAckedAt(body.ackedAt || ackedAt || new Date().toISOString());
      }
    } finally {
      setAcking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-secondary">
        <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-surface-secondary p-6 text-center">
        <p className="text-sm text-text-primary">{error || "Not found"}</p>
        <p className="text-xs text-text-tertiary">
          Ask the producer for an updated link.
        </p>
      </div>
    );
  }

  const { payload, version, campaignName, wfNumber, tier } = data;
  const deliveries = payload.deliveries || [];
  const isSuperseded = Boolean(version.supersededAt);

  return (
    <div className="min-h-screen bg-surface-secondary py-4 sm:py-8">
      {/* Print-only SUPERSEDED watermark — hidden on screen, diagonal overlay
          on the printed page so a stale paper copy reads as superseded. */}
      {isSuperseded && (
        <div
          aria-hidden="true"
          className="hidden print:flex print:fixed print:inset-0 print:items-center print:justify-center print:pointer-events-none print:opacity-20 print:text-black print:font-bold print:text-8xl print:tracking-[0.2em] print:uppercase print:z-[9999] print:-rotate-[30deg] print:whitespace-nowrap"
        >
          SUPERSEDED
        </div>
      )}

      <div className="mx-auto max-w-3xl rounded-lg border border-border bg-surface p-4 sm:p-6 shadow-xs">
        {isSuperseded && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/8 px-3 py-2 text-xs text-[color:var(--color-warning)]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            This version was superseded{" "}
            {format(parseISO(version.supersededAt!), "MMM d 'at' h:mm a")}. Contact the
            producer for the current call sheet.
          </div>
        )}
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Call Sheet
            </p>
            <h1 className="text-base font-semibold text-text-primary">
              {wfNumber} {campaignName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              v{version.vNumber}
            </span>
            {tier === "redacted" && (
              <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Redacted view
              </span>
            )}
          </div>
        </div>

        {/* Header grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-border pb-3 mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Company
            </p>
            <p className="text-xs font-semibold text-text-primary">{payload.companyName}</p>
            <p className="text-xs text-text-secondary whitespace-pre-line">{payload.companyAddress}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Crew Call
            </p>
            <p className="text-xs font-semibold text-text-primary">
              {payload.generalCallTime || "TBD"}
            </p>
            {payload.estimatedWrap && (
              <p className="text-xs text-text-secondary">Est wrap {payload.estimatedWrap}</p>
            )}
            {payload.lunchTime && (
              <p className="text-xs text-text-secondary">Lunch {payload.lunchTime}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Weather
            </p>
            <p className="text-xs text-text-primary">{payload.weatherNotes || "—"}</p>
            {(payload.sunrise || payload.sunset) && (
              <p className="text-xs text-text-secondary">
                Sunrise {payload.sunrise} · Sunset {payload.sunset}
              </p>
            )}
          </div>
        </div>

        {/* Location / Emergency / Producer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-border pb-3 mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Shoot Location
            </p>
            <p className="text-xs text-text-primary whitespace-pre-line">{payload.location || "TBD"}</p>
            {payload.parkingDirections && (
              <p className="text-xs text-text-secondary whitespace-pre-line mt-1">
                {payload.parkingDirections}
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Emergency
            </p>
            <p className="text-xs text-text-primary">911</p>
            {payload.emergencyHospital && (
              <p className="text-xs text-text-secondary">{payload.emergencyHospital}</p>
            )}
            {payload.emergencyPhone && (
              <p className="text-xs text-text-secondary">{payload.emergencyPhone}</p>
            )}
            {payload.onSetMedic && (
              <p className="text-xs text-text-secondary">Medic: {payload.onSetMedic}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Producer
            </p>
            <p className="text-xs text-text-primary whitespace-pre-line">{data.producerLine}</p>
          </div>
        </div>

        {/* Crew */}
        {payload.crew.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
              Crew
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-surface-secondary/50">
                  <tr>
                    <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Role
                    </th>
                    <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Name
                    </th>
                    <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Phone
                    </th>
                    <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Call
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payload.crew.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-2 py-1.5">{c.role}</td>
                      <td className="px-2 py-1.5">{c.name}</td>
                      <td className="px-2 py-1.5 text-text-secondary">
                        {c.phone || <span className="italic">{c.email || "—"}</span>}
                      </td>
                      <td className="px-2 py-1.5">{c.callTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Talent */}
        {payload.talent.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
              Talent
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-surface-secondary/50">
                  <tr>
                    <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Name
                    </th>
                    <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Agency
                    </th>
                    <th className="text-left px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Call
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payload.talent.map((t) => (
                    <tr key={t.id} className="border-t border-border">
                      <td className="px-2 py-1.5">{t.name}</td>
                      <td className="px-2 py-1.5 text-text-secondary">{t.agency}</td>
                      <td className="px-2 py-1.5">{t.callTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Deliveries */}
        {deliveries.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2 flex items-center gap-1">
              <Package className="h-3 w-3" /> Deliveries Today
            </p>
            <div className="space-y-2">
              {deliveries.map((b) => (
                <div key={`${b.docId}-${b.department}`} className="rounded-lg border border-border p-2">
                  <p className="text-xs font-semibold text-text-primary">
                    {b.department}
                    {b.pickupTime && (
                      <span className="font-normal text-text-tertiary"> · {b.pickupTime}</span>
                    )}
                    {b.pickupPerson && (
                      <span className="font-normal text-text-tertiary"> · pickup: {b.pickupPerson}</span>
                    )}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {b.items.map((it, i) => (
                      <li key={i} className="text-xs text-text-secondary">
                        {it.name} <span className="text-text-tertiary">×{it.quantity}</span>
                        {it.notes && <span className="text-text-tertiary"> — {it.notes}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Allergen + safety */}
        {payload.allergenBulletin && (
          <div className="mb-4 rounded-lg border border-border bg-surface-secondary/30 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
              Allergen & Food Safety
            </p>
            <p className="text-xs text-text-secondary whitespace-pre-line">{payload.allergenBulletin}</p>
          </div>
        )}

        {payload.safetyReminders && (
          <div className="mb-4 rounded-lg border border-border bg-surface-secondary/30 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">
              Safety
            </p>
            <p className="text-xs text-text-secondary whitespace-pre-line">{payload.safetyReminders}</p>
          </div>
        )}

        {/* Acknowledgement */}
        <div className="mt-6 border-t border-border pt-4">
          {ackedAt ? (
            <div className="flex items-center gap-2 rounded-lg bg-[color:var(--color-success)]/8 px-3 py-2 text-xs text-[color:var(--color-success)]">
              <CheckCircle2 className="h-4 w-4" />
              Acknowledged {format(parseISO(ackedAt), "MMM d, h:mm a")}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAck}
              disabled={acking}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {acking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              I got this call sheet
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] text-text-tertiary">
          Published {format(parseISO(version.publishedAt), "MMM d, yyyy 'at' h:mm a")} · Version {version.vNumber}
        </p>
      </div>
    </div>
  );
}
