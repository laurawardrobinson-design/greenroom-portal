"use client";

import { LINES_OF_BUSINESS, type LineOfBusiness } from "@/lib/constants/lines-of-business";

interface LobFilterChipsProps {
  value: LineOfBusiness | null;
  onChange: (value: LineOfBusiness | null) => void;
  availableLobs?: LineOfBusiness[]; // if provided, only these chips show "populated"
}

export function LobFilterChips({ value, onChange, availableLobs }: LobFilterChipsProps) {
  const all = LINES_OF_BUSINESS;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide ring-1 ring-inset transition-colors ${
          value === null
            ? "bg-text-primary text-white ring-text-primary"
            : "bg-transparent text-text-secondary ring-border hover:bg-surface-secondary"
        }`}
      >
        All departments
      </button>
      {all.map((lob) => {
        const active = value === lob;
        const muted = availableLobs && !availableLobs.includes(lob);
        return (
          <button
            key={lob}
            type="button"
            onClick={() => onChange(active ? null : lob)}
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide ring-1 ring-inset transition-colors ${
              active
                ? "bg-text-primary text-white ring-text-primary"
                : muted
                  ? "bg-transparent text-text-tertiary ring-border/60 hover:text-text-secondary"
                  : "bg-transparent text-text-secondary ring-border hover:bg-surface-secondary"
            }`}
          >
            {lob}
          </button>
        );
      })}
    </div>
  );
}
