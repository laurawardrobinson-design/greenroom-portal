export function GatorSvg({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`text-primary ${className}`}
      viewBox="0 0 48 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Body */}
      <path d="M8 20 C8 14, 16 10, 28 10 L38 10 C42 10, 44 12, 44 14" />
      {/* Top jaw */}
      <path d="M44 14 L48 13 L48 15" />
      {/* Bottom jaw */}
      <path d="M44 16 L48 17 L48 15" className="gator-jaw" />
      {/* Teeth */}
      <path d="M45 14 L46 15 L47 14" strokeWidth={1.5} />
      {/* Eye */}
      <circle cx={40} cy={11} r="1.2" fill="currentColor" stroke="none" />
      {/* Front legs */}
      <path d="M30 18 L28 25 M33 17 L35 24" />
      {/* Back legs */}
      <path d="M14 20 L12 26 M18 20 L20 26" />
      {/* Tail */}
      <path d="M8 20 C4 18, 2 22, 0 20" />
      {/* Spikes */}
      <path d="M18 10 L20 5 L22 10 M26 10 L28 6 L30 10 M34 10 L35 7 L36 10" strokeWidth={1.5} />
    </svg>
  );
}
