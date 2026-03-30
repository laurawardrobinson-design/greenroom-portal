export function PeacockSvg({
  className = "",
  tailClassName = "peacock-tail-fan",
}: {
  className?: string;
  tailClassName?: string;
}) {
  return (
    <svg
      className={`text-primary ${className}`}
      viewBox="0 0 56 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Body — plump oval */}
      <ellipse cx="28" cy="26" rx="10" ry="7" />
      {/* Legs — strutting pose */}
      <path d="M25 33 L22 39 M22 39 L20 39 M22 39 L24 39" />
      <path d="M31 33 L34 39 M34 39 L32 39 M34 39 L36 39" />
      {/* Neck — long and curved, proud posture */}
      <path d="M34 21 C36 16, 38 10, 36 6" />
      {/* Head */}
      <circle cx="36" cy="5" r="2.5" />
      {/* Eye */}
      <circle cx="37.2" cy="4.5" r="0.8" fill="currentColor" stroke="none" />
      {/* Beak — small and pointed */}
      <path d="M38.5 5 L41 4.5 L38.5 5.5" strokeWidth={1.5} />
      {/* Crown feathers — 3 wispy plumes */}
      <path d="M35 2.5 L33 -1 M36 2 L36 -2 M37 2.5 L39 -1" strokeWidth={1.2} />
      {/* Crown dots */}
      <circle cx="33" cy="-1.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="36" cy="-2.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="39" cy="-1.5" r="0.8" fill="currentColor" stroke="none" />
      {/* Tail feathers — the dramatic fan, folded back */}
      <g className={tailClassName}>
        <path d="M18 26 C10 20, 4 14, 2 6" strokeWidth={1.2} />
        <path d="M18 26 C12 18, 8 10, 8 2" strokeWidth={1.2} />
        <path d="M18 26 C14 16, 14 8, 16 0" strokeWidth={1.2} />
        <path d="M18 26 C16 16, 18 8, 22 2" strokeWidth={1.2} />
        <path d="M18 26 C18 18, 22 12, 26 6" strokeWidth={1.2} />
        {/* Eye spots on feather tips */}
        <circle cx="2" cy="5" r="2" strokeWidth={1} />
        <circle cx="8" cy="1" r="2" strokeWidth={1} />
        <circle cx="16" cy="-1" r="2" strokeWidth={1} />
        <circle cx="22" cy="1" r="2" strokeWidth={1} />
        <circle cx="26" cy="5" r="2" strokeWidth={1} />
        {/* Inner dots */}
        <circle cx="2" cy="5" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="8" cy="1" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="16" cy="-1" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="22" cy="1" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="26" cy="5" r="0.7" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
