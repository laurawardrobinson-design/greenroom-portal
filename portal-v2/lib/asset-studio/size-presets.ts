// ============================================================
// Output-size presets for Asset Studio.
//
// Physical POP sizes for in-store (Publix-scale grocery retail) +
// the standard digital channel sizes a weekly-promo asset ships to.
//
// Dimensions are based on industry-standard retail display hardware
// and Meta/Google/IAB current-gen ad specs. See
// `grocery-pop-sizes-research.md` at repo root for sources.
//
// Physical-print templates render at 100 DPI for fast design-phase
// proofing; real print runs go to pre-press at 300 DPI.
// ============================================================

export type SizePresetCategory =
  | "shelf"
  | "aisle"
  | "endcap"
  | "counter"
  | "window"
  | "print"
  | "social"
  | "email"
  | "display";

export type SizePresetChannel = "in-store" | "print" | "digital";

export interface SizePreset {
  /** Stable id used by the UI and API to request this preset. */
  code: string;
  /** Display label stored on the output_spec row. */
  label: string;
  category: SizePresetCategory;
  /** Stored in template_output_specs.channel for filtering downstream. */
  channel: SizePresetChannel;
  /** Render pixels (not physical). Physical size is in `physical` when applicable. */
  width: number;
  height: number;
  format: "png" | "jpg" | "webp";
  /** Physical size + DPI metadata (present for print-style presets only). */
  physical?: { widthIn: number; heightIn: number; dpi: number };
  /** Sorting hint within a category. */
  sortOrder?: number;
  /** Short explanation surfaced in the preset picker tooltip. */
  description: string;
}

export const SIZE_PRESETS: readonly SizePreset[] = [
  // ─── Shelf-level ─────────────────────────────────────────────
  {
    code: "pop.shelf-talker",
    label: "Shelf Talker",
    category: "shelf",
    channel: "in-store",
    width: 1100,
    height: 150,
    format: "png",
    physical: { widthIn: 11, heightIn: 1.5, dpi: 100 },
    sortOrder: 10,
    description: "11 × 1.5 in — horizontal strip clipped to the shelf edge.",
  },
  {
    code: "pop.shelf-strip",
    label: "Shelf Strip",
    category: "shelf",
    channel: "in-store",
    width: 1100,
    height: 250,
    format: "png",
    physical: { widthIn: 11, heightIn: 2.5, dpi: 100 },
    sortOrder: 20,
    description: "11 × 2.5 in — wider strip for price + short headline.",
  },
  {
    code: "pop.bin-card",
    label: "Bin Card",
    category: "shelf",
    channel: "in-store",
    width: 550,
    height: 350,
    format: "png",
    physical: { widthIn: 5.5, heightIn: 3.5, dpi: 100 },
    sortOrder: 30,
    description: "5.5 × 3.5 in — produce-bin header / deli case card.",
  },

  // ─── In-aisle overhead ───────────────────────────────────────
  {
    code: "pop.ceiling-dangler",
    label: "Ceiling Dangler",
    category: "aisle",
    channel: "in-store",
    width: 1200,
    height: 1200,
    format: "png",
    physical: { widthIn: 12, heightIn: 12, dpi: 100 },
    sortOrder: 10,
    description: "12 × 12 in — two-sided square sign hung from the ceiling grid.",
  },
  {
    code: "pop.aisle-violator",
    label: "Aisle Violator",
    category: "aisle",
    channel: "in-store",
    width: 1400,
    height: 2200,
    format: "png",
    physical: { widthIn: 14, heightIn: 22, dpi: 100 },
    sortOrder: 20,
    description: "14 × 22 in — rigid blade perpendicular to the aisle.",
  },

  // ─── End-cap ─────────────────────────────────────────────────
  {
    code: "pop.endcap-header",
    label: "End-Cap Header",
    category: "endcap",
    channel: "in-store",
    width: 3600,
    height: 1200,
    format: "jpg",
    physical: { widthIn: 36, heightIn: 12, dpi: 100 },
    sortOrder: 10,
    description: "36 × 12 in — horizontal crown across the top of an end-cap.",
  },
  {
    code: "pop.endcap-riser",
    label: "End-Cap Riser",
    category: "endcap",
    channel: "in-store",
    width: 2200,
    height: 2800,
    format: "jpg",
    physical: { widthIn: 22, heightIn: 28, dpi: 100 },
    sortOrder: 20,
    description: "22 × 28 in — large backer card behind the featured product.",
  },

  // ─── Counter / checkout ──────────────────────────────────────
  {
    code: "pop.counter-card",
    label: "Counter Card",
    category: "counter",
    channel: "in-store",
    width: 500,
    height: 700,
    format: "png",
    physical: { widthIn: 5, heightIn: 7, dpi: 100 },
    sortOrder: 10,
    description: "5 × 7 in — small easel card on deli / bakery counters.",
  },
  {
    code: "pop.counter-easel",
    label: "Counter Easel",
    category: "counter",
    channel: "in-store",
    width: 850,
    height: 1100,
    format: "png",
    physical: { widthIn: 8.5, heightIn: 11, dpi: 100 },
    sortOrder: 20,
    description: "8.5 × 11 in — letter-size tabletop promo.",
  },

  // ─── Entrance / window ───────────────────────────────────────
  {
    code: "pop.window-cling",
    label: "Window Cling",
    category: "window",
    channel: "in-store",
    width: 1800,
    height: 2400,
    format: "png",
    physical: { widthIn: 18, heightIn: 24, dpi: 100 },
    sortOrder: 10,
    description: "18 × 24 in — seasonal or event window signage.",
  },

  // ─── Print handouts ──────────────────────────────────────────
  {
    code: "print.half-sheet",
    label: "Half-Sheet Flyer",
    category: "print",
    channel: "print",
    width: 550,
    height: 850,
    format: "jpg",
    physical: { widthIn: 5.5, heightIn: 8.5, dpi: 100 },
    sortOrder: 10,
    description: "5.5 × 8.5 in — handout / in-bag insert.",
  },
  {
    code: "print.tabloid-poster",
    label: "Tabloid Poster",
    category: "print",
    channel: "print",
    width: 1100,
    height: 1700,
    format: "jpg",
    physical: { widthIn: 11, heightIn: 17, dpi: 100 },
    sortOrder: 20,
    description: "11 × 17 in — aisle-end or hallway poster.",
  },

  // ─── Social feed ─────────────────────────────────────────────
  {
    code: "social.ig-feed-square",
    label: "Instagram Feed (1:1)",
    category: "social",
    channel: "digital",
    width: 1080,
    height: 1080,
    format: "jpg",
    sortOrder: 10,
    description: "1080 × 1080 — the weekly-deal square. Also works on Facebook Feed.",
  },
  {
    code: "social.ig-feed-portrait",
    label: "Instagram Feed (4:5)",
    category: "social",
    channel: "digital",
    width: 1080,
    height: 1350,
    format: "jpg",
    sortOrder: 20,
    description: "1080 × 1350 — Meta's preferred portrait ratio for feed.",
  },
  {
    code: "social.story-reel",
    label: "Story / Reel / TikTok",
    category: "social",
    channel: "digital",
    width: 1080,
    height: 1920,
    format: "jpg",
    sortOrder: 30,
    description: "1080 × 1920 — 9:16 vertical for IG Story, Reels, TikTok, Snap.",
  },
  {
    code: "social.fb-link",
    label: "Facebook Link (1.91:1)",
    category: "social",
    channel: "digital",
    width: 1200,
    height: 628,
    format: "jpg",
    sortOrder: 40,
    description: "1200 × 628 — shared-link card; also Google UAC landscape.",
  },

  // ─── Email ───────────────────────────────────────────────────
  {
    code: "email.hero",
    label: "Email Hero Banner",
    category: "email",
    channel: "digital",
    width: 1200,
    height: 600,
    format: "jpg",
    sortOrder: 10,
    description: "1200 × 600 — top-of-email hero @ 2× for retina.",
  },

  // ─── Programmatic display (IAB) ──────────────────────────────
  {
    code: "display.mrec",
    label: "Medium Rectangle (IAB)",
    category: "display",
    channel: "digital",
    width: 300,
    height: 250,
    format: "png",
    sortOrder: 10,
    description: "300 × 250 — #1 display-ad unit by volume.",
  },
  {
    code: "display.leaderboard",
    label: "Leaderboard (IAB)",
    category: "display",
    channel: "digital",
    width: 728,
    height: 90,
    format: "png",
    sortOrder: 20,
    description: "728 × 90 — horizontal header banner (desktop publishers).",
  },
  {
    code: "display.half-page",
    label: "Half Page (IAB)",
    category: "display",
    channel: "digital",
    width: 300,
    height: 600,
    format: "png",
    sortOrder: 30,
    description: "300 × 600 — high-impact vertical.",
  },
];

export const CATEGORY_META: Record<
  SizePresetCategory,
  { label: string; group: "physical" | "digital" }
> = {
  shelf: { label: "Shelf-level", group: "physical" },
  aisle: { label: "In-aisle overhead", group: "physical" },
  endcap: { label: "End-cap", group: "physical" },
  counter: { label: "Counter / checkout", group: "physical" },
  window: { label: "Entrance / window", group: "physical" },
  print: { label: "Print handouts", group: "physical" },
  social: { label: "Social feed", group: "digital" },
  email: { label: "Email", group: "digital" },
  display: { label: "Programmatic display", group: "digital" },
};

export function getPresetByCode(code: string): SizePreset | undefined {
  return SIZE_PRESETS.find((p) => p.code === code);
}
