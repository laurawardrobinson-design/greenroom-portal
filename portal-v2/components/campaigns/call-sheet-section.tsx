"use client";

import { useState } from "react";
import useSWR from "swr";
import { format, parseISO } from "date-fns";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function CallSheetSection({
  campaignId,
  shoots,
}: {
  campaignId: string;
  shoots: Array<{ id: string; name: string; dates: Array<{ id: string; shootDate: string }> }>;
}) {
  const [selectedShoot, setSelectedShoot] = useState(shoots[0]?.id || "");
  const { data: callSheet } = useSWR(
    selectedShoot ? `/api/call-sheet?campaignId=${campaignId}&shootId=${selectedShoot}` : null,
    fetcher
  );

  return (
    <div className="space-y-4">
      {shoots.length > 1 && (
        <select
          value={selectedShoot}
          onChange={(e) => setSelectedShoot(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none"
        >
          {shoots.map((s) => (
            <option key={s.id} value={s.id}>{s.name || "Shoot"}</option>
          ))}
        </select>
      )}

      {callSheet && (
        <div className="rounded-lg bg-surface-secondary p-4 text-xs space-y-3">
          <div>
            <p className="font-semibold text-text-primary">{callSheet.campaignName} ({callSheet.wfNumber})</p>
            <p className="text-text-secondary">
              {callSheet.shootDate
                ? format(parseISO(callSheet.shootDate), "EEEE, MMMM d, yyyy")
                : "Date TBD"}
            </p>
            <p className="text-text-secondary">{callSheet.location || "Location TBD"}</p>
            {callSheet.callTime && <p className="text-text-secondary">Call Time: {callSheet.callTime}</p>}
          </div>

          {callSheet.crew?.length > 0 && (
            <div>
              <p className="font-semibold text-text-primary mb-1">Crew</p>
              {callSheet.crew.map((c: { name: string; role: string; phone: string }, i: number) => (
                <p key={i} className="text-text-secondary">
                  {c.role} — {c.name} {c.phone && `· ${c.phone}`}
                </p>
              ))}
            </div>
          )}

          {callSheet.vendors?.length > 0 && (
            <div>
              <p className="font-semibold text-text-primary mb-1">Vendors</p>
              {callSheet.vendors.map((v: { company: string; contact: string; role: string; phone: string }, i: number) => (
                <p key={i} className="text-text-secondary">
                  {v.role} — {v.company} ({v.contact}) {v.phone && `· ${v.phone}`}
                </p>
              ))}
            </div>
          )}

          {callSheet.deliverables?.length > 0 && (
            <div>
              <p className="font-semibold text-text-primary mb-1">Deliverables</p>
              {callSheet.deliverables.map((d: { channel: string; format: string; dimensions: string }, i: number) => (
                <p key={i} className="text-text-secondary">
                  {d.channel} — {d.format} ({d.dimensions})
                </p>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
