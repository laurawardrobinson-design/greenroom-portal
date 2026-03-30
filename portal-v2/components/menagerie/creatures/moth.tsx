export function MothSvg({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`text-primary ${className}`}
      viewBox="0 0 48 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Body — fuzzy segmented oval */}
      <ellipse cx="24" cy="22" rx="3" ry="6" />
      {/* Fuzz lines on body */}
      <path d="M21.5 19 L22 19 M21.5 21 L22 21 M21.5 23 L22 23 M26 19 L26.5 19 M26 21 L26.5 21 M26 23 L26.5 23" strokeWidth={1} />
      {/* Left wing — large, rounded, detailed */}
      <g className="moth-wing-left">
        <path d="M21 20 C14 14, 4 12, 2 18 C0 24, 8 30, 16 26 C18 25, 20 23, 21 22" />
        {/* Wing pattern */}
        <path d="M16 18 C12 16, 8 17, 7 20" strokeWidth={1} />
        <circle cx="10" cy="20" r="2" strokeWidth={1} />
        <circle cx="10" cy="20" r="0.7" fill="currentColor" stroke="none" />
      </g>
      {/* Right wing — mirror */}
      <g className="moth-wing-right">
        <path d="M27 20 C34 14, 44 12, 46 18 C48 24, 40 30, 32 26 C30 25, 28 23, 27 22" />
        {/* Wing pattern */}
        <path d="M32 18 C36 16, 40 17, 41 20" strokeWidth={1} />
        <circle cx="38" cy="20" r="2" strokeWidth={1} />
        <circle cx="38" cy="20" r="0.7" fill="currentColor" stroke="none" />
      </g>
      {/* Antennae — curly */}
      <path d="M23 16 C20 10, 16 6, 12 4" strokeWidth={1.2} />
      <path d="M25 16 C28 10, 32 6, 36 4" strokeWidth={1.2} />
      {/* Antenna tips — fuzzy dots */}
      <circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="36" cy="4" r="1.5" fill="currentColor" stroke="none" />
      {/* Eyes — big and round (moth-like) */}
      <circle cx="22" cy="16.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="26" cy="16.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
