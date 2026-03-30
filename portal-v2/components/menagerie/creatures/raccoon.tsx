export function RaccoonSvg({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`text-primary ${className}`}
      viewBox="0 0 48 44"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Body — round and chunky */}
      <ellipse cx="24" cy="28" rx="11" ry="9" />
      {/* Head */}
      <circle cx="24" cy="14" r="8" />
      {/* Ears — pointed */}
      <path d="M17 8 L14 2 L19 7" />
      <path d="M31 8 L34 2 L29 7" />
      {/* Mask — the raccoon bandit mask */}
      <path d="M16 13 C18 11, 20 11, 22 13" strokeWidth={2.5} />
      <path d="M26 13 C28 11, 30 11, 32 13" strokeWidth={2.5} />
      {/* Eyes — beady, inside the mask */}
      <circle cx="19.5" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="28.5" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
      {/* Nose */}
      <circle cx="24" cy="16" r="1.5" />
      <circle cx="24" cy="16" r="0.6" fill="currentColor" stroke="none" />
      {/* Mouth — chewing */}
      <path d="M22 18 C23 19, 25 19, 26 18" className="raccoon-chew" />
      {/* Front paws — grabby, holding a tiny sandwich */}
      <g className="raccoon-paws">
        <path d="M16 25 L10 22 L8 24" />
        <path d="M32 25 L38 22 L40 24" />
        {/* The sandwich */}
        <rect x="9" y="21" width="6" height="4" rx="0.5" strokeWidth={1.2} />
        <path d="M9 23 L15 23" strokeWidth={0.8} />
        {/* Lettuce peeking out */}
        <path d="M9 22.5 C8 22, 8 23, 9 23.5" strokeWidth={0.8} />
      </g>
      {/* Back feet */}
      <path d="M16 36 L14 40 M14 40 L12 40 M14 40 L16 40" />
      <path d="M32 36 L34 40 M34 40 L32 40 M34 40 L36 40" />
      {/* Tail — striped */}
      <path d="M35 30 C40 28, 44 24, 46 20" />
      {/* Tail stripes */}
      <path d="M38 27 C39 28, 40 27, 39 26" strokeWidth={2.5} />
      <path d="M42 23 C43 24, 44 23, 43 22" strokeWidth={2.5} />
      <path d="M45 20 C46 21, 47 20, 46 19" strokeWidth={2.5} />
    </svg>
  );
}
