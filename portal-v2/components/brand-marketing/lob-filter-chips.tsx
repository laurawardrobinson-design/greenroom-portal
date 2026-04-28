"use client";

import {
  Apple,
  Beef,
  Cookie,
  LayoutGrid,
  Sandwich,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";
import {
  LINES_OF_BUSINESS,
  type LineOfBusiness,
} from "@/lib/constants/lines-of-business";

interface LobFilterChipsProps {
  value: LineOfBusiness | null;
  onChange: (value: LineOfBusiness | null) => void;
  availableLobs?: LineOfBusiness[]; // if provided, others render muted
}

const LOB_ICONS: Record<LineOfBusiness, LucideIcon> = {
  Bakery: Cookie,
  Deli: Sandwich,
  Produce: Apple,
  "Meat & Seafood": Beef,
  Grocery: ShoppingBasket,
};

export function LobFilterChips({
  value,
  onChange,
  availableLobs,
}: LobFilterChipsProps) {
  return (
    <div
      role="tablist"
      aria-label="Lines of business"
      className="grid grid-cols-3 gap-2 sm:grid-cols-6"
    >
      <Cube
        icon={LayoutGrid}
        label="All"
        active={value === null}
        onClick={() => onChange(null)}
      />
      {LINES_OF_BUSINESS.map((lob) => {
        const active = value === lob;
        const muted = availableLobs && !availableLobs.includes(lob);
        return (
          <Cube
            key={lob}
            icon={LOB_ICONS[lob]}
            label={lob}
            active={active}
            muted={muted}
            onClick={() => onChange(active ? null : lob)}
          />
        );
      })}
    </div>
  );
}

function Cube({
  icon: Icon,
  label,
  active,
  muted,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-[12px] font-medium leading-tight transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-surface text-text-secondary hover:bg-surface-secondary"
      } ${muted && !active ? "opacity-60" : ""}`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-center">{label}</span>
    </button>
  );
}
