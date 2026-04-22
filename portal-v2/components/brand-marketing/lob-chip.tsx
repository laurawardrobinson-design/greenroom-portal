import { LOB_CHIP_STYLES, type LineOfBusiness } from "@/lib/constants/lines-of-business";

interface LobChipProps {
  lob: LineOfBusiness | null;
  className?: string;
}

export function LobChip({ lob, className = "" }: LobChipProps) {
  if (!lob) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ring-1 ring-inset ${LOB_CHIP_STYLES[lob]} ${className}`}
    >
      {lob}
    </span>
  );
}
