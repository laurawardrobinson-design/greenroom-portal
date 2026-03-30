// ============================================================
// Mutant Menagerie — SVG creature components
// All creatures: stroke-only, hand-drawn style, text-primary
// ============================================================

type GatorVariant =
  | "current"
  | "bulldog"
  | "lurker"
  | "grin"
  | "stout"
  | "regal";

const GATOR_VARIANTS: Record<
  GatorVariant,
  {
    body: string;
    topJaw: string;
    bottomJaw: string;
    eye: { cx: number; cy: number };
    frontLegs: string;
    backLegs: string;
    tail: string;
    spikes: string;
  }
> = {
  current: {
    body: "M8 20 C8 14, 16 10, 28 10 L38 10 C42 10, 44 12, 44 14",
    topJaw: "M44 14 L48 13 L48 15",
    bottomJaw: "M44 16 L48 17 L48 15",
    eye: { cx: 40, cy: 11 },
    frontLegs: "M30 18 L28 25 M33 17 L35 24",
    backLegs: "M14 20 L12 26 M18 20 L20 26",
    tail: "M8 20 C4 18, 2 22, 0 20",
    spikes: "M18 10 L20 5 L22 10 M26 10 L28 6 L30 10 M34 10 L35 7 L36 10",
  },
  bulldog: {
    body: "M8.5 20.5 C8.5 15.2, 15.3 11.5, 27.6 11.5 L36.5 11.5 C41.7 11.5, 44.4 13.6, 44.8 16.2",
    topJaw: "M44.8 16.2 C47.2 15.1, 49.6 14.4, 51.8 14.5 C52.7 14.6, 53.1 15.2, 53.1 16 C50.2 16.2, 47.4 16.4, 44.8 16.5",
    bottomJaw: "M44.8 17.9 C47.3 18.7, 49.7 19.2, 51.8 18.9 C52.8 18.8, 53.1 18.1, 53.1 17.3 C50.5 17.2, 47.8 17.2, 44.9 17.1",
    eye: { cx: 38.8, cy: 12.9 },
    frontLegs: "M29 19.7 L27.3 25.1 M32.8 19.1 L34.8 24.3",
    backLegs: "M14.3 21 L12.6 26.4 M18.1 20.8 L20.2 26.1",
    tail: "M8.5 20.5 C5.2 18.1, 2.5 18.5, 0 20.5",
    spikes: "M17.6 11.6 L19.2 7.2 L20.9 11.6 M24.8 11.5 L26.2 8 L27.7 11.5 M31.9 11.5 L33.2 8.7 L34.7 11.5",
  },
  lurker: {
    body: "M8.2 21.5 C8.4 17.6, 15.6 14.1, 28.8 14.1 L39 14.1 C42.6 14.1, 44.8 15.2, 45 16.8",
    topJaw: "M45 16.8 C47.7 15.8, 50.4 15.3, 53.2 15.6 C53.8 15.7, 54.2 16.1, 54.2 16.6 C50.8 16.8, 47.7 16.9, 45 17",
    bottomJaw: "M45 18.1 C47.5 18.6, 50.1 19, 53 18.8 C53.7 18.7, 54.1 18.3, 54.1 17.7 C51 17.5, 47.9 17.4, 45 17.3",
    eye: { cx: 39.7, cy: 14.1 },
    frontLegs: "M30.3 21.2 L29 26 M34.3 20.7 L36 24.9",
    backLegs: "M15.4 21.8 L14 26.8 M19.5 21.7 L21.6 26.6",
    tail: "M8.2 21.5 C4.8 20.2, 2 23, 0 21.8",
    spikes: "M19.6 14.2 L20.9 10.6 L22.2 14.2 M27.2 14.2 L28.3 11.1 L29.5 14.2 M34.3 14.2 L35.2 11.6 L36.4 14.2",
  },
  grin: {
    body: "M8.4 20.4 C8.4 15, 15.1 11.1, 27.8 11.1 L36.8 11.1 C41.8 11.1, 44.5 13, 45 15.5",
    topJaw: "M45 15.5 C47.7 14.2, 50.3 13.8, 52.8 14.2 C53.6 14.3, 54 14.9, 54 15.6 C50.8 15.8, 47.8 16.1, 45.1 16.3",
    bottomJaw: "M44.9 18 C47.5 19.5, 50 20, 52.3 19.4 C53.1 19.2, 53.6 18.5, 53.6 17.7 C50.5 17.4, 47.6 17.1, 44.9 16.8",
    eye: { cx: 39.2, cy: 12.7 },
    frontLegs: "M29.4 19.6 L27.8 25.2 M33.2 18.9 L35.3 24.4",
    backLegs: "M14.7 20.8 L13 26.5 M18.6 20.6 L20.8 26.2",
    tail: "M8.4 20.4 C5.4 17.8, 2.6 17.6, 0 19.9",
    spikes: "M18 11.2 L19.8 6.6 L21.6 11.2 M25.7 11.1 L27.3 7.5 L29 11.1 M33.2 11.1 L34.5 8 L36.1 11.1",
  },
  stout: {
    body: "M9.2 20.6 C9.2 15.1, 15.5 11.6, 28.8 11.6 L36.8 11.6 C42.2 11.6, 44.8 13.8, 45.1 16.2",
    topJaw: "M45.1 16.2 C47.9 15.2, 50.6 14.8, 53.4 15.2 C54.2 15.3, 54.7 15.9, 54.7 16.7 C51.3 16.7, 48.2 16.8, 45.1 16.9",
    bottomJaw: "M45 18.2 C47.7 18.9, 50.4 19.4, 53 19.1 C53.8 19, 54.3 18.3, 54.3 17.5 C51.2 17.3, 48.1 17.1, 45 17",
    eye: { cx: 38.9, cy: 12.8 },
    frontLegs: "M29 20.1 L27.1 25.8 M32.7 19.5 L35.2 24.7",
    backLegs: "M14.9 21.1 L13.1 27 M18.8 21 L21.3 26.4",
    tail: "M9.2 20.6 C6.9 17.3, 3.3 17.3, 0 19.1",
    spikes: "M18.5 11.7 L20.4 6.9 L22.1 11.7 M26.4 11.6 L28 7.7 L29.8 11.6 M33.9 11.6 L35.3 8.4 L36.8 11.6",
  },
  regal: {
    body: "M8.3 20.1 C8.3 14.6, 15.2 10.8, 27.4 10.8 L37.5 10.8 C42.1 10.8, 44.7 12.7, 45.3 15",
    topJaw: "M45.3 15 C48.1 13.9, 50.9 13.3, 53.8 13.8 C54.6 13.9, 55 14.5, 55 15.3 C51.5 15.4, 48.2 15.7, 45.3 16.1",
    bottomJaw: "M45.1 17.2 C47.9 18.2, 50.7 18.7, 53.4 18.4 C54.2 18.3, 54.7 17.7, 54.7 16.9 C51.5 16.7, 48.2 16.5, 45.1 16.2",
    eye: { cx: 39.6, cy: 12 },
    frontLegs: "M29.6 19.2 L28 24.7 M33.5 18.6 L35.7 23.9",
    backLegs: "M14.2 20.4 L12.5 26.1 M18 20.2 L20.1 25.9",
    tail: "M8.3 20.1 C5.1 17, 2.6 16.9, 0 18.8",
    spikes: "M17.7 10.9 L19.5 6 L21.3 10.9 M25.5 10.8 L27.2 6.8 L28.9 10.8 M33.2 10.8 L34.6 7.5 L36.1 10.8",
  },
};

// --- Mutant Gator (moved from gator-easter-egg.tsx) ---
export function GatorSvg({
  className = "",
  variant = "current",
}: {
  className?: string;
  variant?: GatorVariant;
}) {
  const shape = GATOR_VARIANTS[variant];
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
      <path d={shape.body} />
      {/* Top jaw */}
      <path d={shape.topJaw} />
      {/* Bottom jaw */}
      <path d={shape.bottomJaw} className="gator-jaw" />
      {/* Teeth */}
      <path d="M45 14 L46 15 L47 14" strokeWidth={1.5} />
      {/* Eye */}
      <circle cx={shape.eye.cx} cy={shape.eye.cy} r="1.2" fill="currentColor" stroke="none" />
      {/* Front legs */}
      <path d={shape.frontLegs} />
      {/* Back legs */}
      <path d={shape.backLegs} />
      {/* Tail */}
      <path d={shape.tail} />
      {/* Spikes */}
      <path d={shape.spikes} strokeWidth={1.5} />
    </svg>
  );
}

// --- Feral Peacock ---
export function PeacockSvg({
  className = "",
  tailClassName = "peacock-tail-fan",
  bodyClassName = "",
  headClassName = "",
}: {
  className?: string;
  tailClassName?: string;
  bodyClassName?: string;
  headClassName?: string;
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
      <g className={bodyClassName}>
        {/* Body — plump oval */}
        <ellipse cx="28" cy="26" rx="10" ry="7" />
        {/* Legs — strutting pose */}
        <path d="M25 33 L22 39 M22 39 L20 39 M22 39 L24 39" />
        <path d="M31 33 L34 39 M34 39 L32 39 M34 39 L36 39" />
      </g>
      <g className={headClassName}>
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
      </g>
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

// --- Swamp Moth ---
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

// --- Craft Services Raccoon ---
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

// --- Zookeeper (the fun police) — bright green, faces right ---
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
