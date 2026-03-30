export function ZookeeperSvg({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`text-primary ${className}`}
      viewBox="0 0 40 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Head */}
      <circle cx="24" cy="8" r="4" />
      {/* Hat brim */}
      <path d="M18 7 L30 7" strokeWidth={2} />
      {/* Hat top */}
      <path d="M20 7 C20 3, 28 3, 28 7" />
      {/* Body */}
      <path d="M24 12 L24 28" />
      {/* Right arm — swinging forward */}
      <path d="M24 16 L30 24" />
      {/* Left arm — holding net behind */}
      <path d="M24 16 L14 10" />
      {/* Net handle extends behind */}
      <path d="M14 10 L8 4" strokeWidth={1.5} />
      {/* Net — mesh trailing behind */}
      <path d="M8 4 C2 6, 0 14, 6 16 L8 4" strokeWidth={1.2} />
      {/* Net mesh lines */}
      <path d="M7 6 L5 14 M6 5 L3 12 M5 8 L8 14" strokeWidth={0.6} />
      {/* Right leg — leading stride */}
      <path d="M24 28 L30 40" />
      <path d="M30 40 L32 40" strokeWidth={2} />
      {/* Left leg — trailing */}
      <path d="M24 28 L18 38" />
      <path d="M18 38 L16 38" strokeWidth={2} />
    </svg>
  );
}
