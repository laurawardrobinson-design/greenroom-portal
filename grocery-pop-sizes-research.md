# Grocery Retail POP Sizes — Reference

Research for Asset Studio Sprint 6. Consolidates what Publix (and any
grocery-scale retailer) actually prints + hangs in-store. Covers the
"versioning of assets into different POP sizes" ask.

Sources below are industry display-hardware suppliers, not Publix-specific
standards. Publix has its own in-house spec sheet — when we get a
conversation with their in-store marketing team, we'll reconcile these
defaults against their reality.

---

## What POP actually means in a grocery store

POP = "Point of Purchase." Every piece of paper, card, cling, decal, and
dangler between the store entrance and the checkout. For a Publix at ~50,000
sq ft, a single weekly promo typically needs 8–12 different sizes printed:
one master design, a dozen formats.

POP lives in five spatial zones:

1. **Shelf-level** — shelf edge strips, talkers, blades, bin cards
2. **In-aisle overhead** — ceiling danglers, aisle violators
3. **End-cap** — headers, risers, sidekicks
4. **Counter/checkout** — easels, cards, register-top signs
5. **Entrance/windows** — clings, A-frames, sidewalk boards

Plus printed handouts: circulars, couponers, half-sheet flyers.

---

## The curated list (what we're seeding as presets)

All 12 sizes below, rounded to whole inches, rendered at 100 DPI for
proofing speed (sharp renders a 2200×2800 PNG in ~400 ms). Real print
runs go to the pre-press vendor at 300 DPI; these templates are for
design + approval cycles, not final-output.

### Shelf-level

| Name | Physical | Pixels | Typical use |
|---|---|---|---|
| **Shelf Talker** | 11 × 1.5 in | 1100 × 150 | Horizontal promo strip clipped to shelf edge |
| **Shelf Strip** | 11 × 2.5 in | 1100 × 250 | Wider variant that fits a price + product name |
| **Bin Card** | 5.5 × 3.5 in | 550 × 350 | Produce bin header — "Organic Raspberries · $3.99" |

### In-aisle overhead

| Name | Physical | Pixels | Typical use |
|---|---|---|---|
| **Ceiling Dangler** | 12 × 12 in | 1200 × 1200 | Two-sided square sign hung from grid; weekly hero deals |
| **Aisle Violator** | 14 × 22 in | 1400 × 2200 | Rigid blade perpendicular to aisle — the "STOP THIS AISLE" asset |

### End-cap

| Name | Physical | Pixels | Typical use |
|---|---|---|---|
| **End-Cap Header** | 36 × 12 in | 3600 × 1200 | Horizontal crown across the top of an end-cap |
| **End-Cap Riser** | 22 × 28 in | 2200 × 2800 | Large backer card mounted behind the featured product |

### Counter / checkout

| Name | Physical | Pixels | Typical use |
|---|---|---|---|
| **Counter Card** | 5 × 7 in | 500 × 700 | Small easel card on deli / bakery counters |
| **Counter Easel** | 8.5 × 11 in | 850 × 1100 | Letter-size promo stand-up |

### Entrance / windows

| Name | Physical | Pixels | Typical use |
|---|---|---|---|
| **Window Cling** | 18 × 24 in | 1800 × 2400 | Seasonal or event window signage |

### Printed handouts

| Name | Physical | Pixels | Typical use |
|---|---|---|---|
| **Half-Sheet Flyer** | 5.5 × 8.5 in | 550 × 850 | Handout / in-bag insert |
| **Tabloid Poster** | 11 × 17 in | 1100 × 1700 | Aisle-end or hallway poster; common ad-department default |

---

## Digital channel sizes

Paired with the physical POP pack because the same weekly-promo design
typically needs to run on social + email + programmatic at the same time.
Sourced from the Meta / Google / IAB current-gen spec sheets.

### Social feed

| Name | Pixels | Ratio | Typical use |
|---|---|---|---|
| **Instagram Feed (1:1)** | 1080 × 1080 | 1:1 | Weekly deal squares — the bread-and-butter grocery post |
| **Instagram Feed (4:5)** | 1080 × 1350 | 4:5 | Meta's preferred portrait for feed; reads better on mobile |
| **Instagram / TikTok Story** | 1080 × 1920 | 9:16 | Vertical full-bleed; 9:16 works across IG Story, Reels, TikTok, Snap |
| **Facebook Feed (1:1)** | 1200 × 1200 | 1:1 | Companion for IG Feed 1:1 at Facebook's native asset size |
| **Facebook Link / Landscape** | 1200 × 628 | ~1.91:1 | Shared-link card; Google Display UAC also uses this ratio |

### Email

| Name | Pixels | Ratio | Typical use |
|---|---|---|---|
| **Email Hero Banner** | 1200 × 600 | 2:1 | Top-of-email hero @ 2× for retina; used by Publix Club / loyalty blasts |

### Programmatic display (IAB)

| Name | Pixels | Ratio | Typical use |
|---|---|---|---|
| **Medium Rectangle (IAB)** | 300 × 250 | 6:5 | #1 display-ad unit by volume; appears on nearly every ad exchange |
| **Leaderboard (IAB)** | 728 × 90 | ~8:1 | Horizontal header banner; desktop publisher sites |
| **Half Page (IAB)** | 300 × 600 | 1:2 | High-impact vertical; often used for premium grocery run-of-site |

---

## What we deliberately left out

- **Weekly circular** (11 × 22 in newsprint) — driven by a different
  system (InDesign → pre-press), not a pixel-render pipeline. Won't land
  in Asset Studio until we add a layout-based render path (HTML5
  or InDesign bridge, Phase 5/6).
- **Shopping cart sign / register topper** — fixed hardware sizes
  vary by vendor. Revisit with Publix's in-house facilities team.
- **Floor graphic** (24 × 24 in floor decal) — at 100 DPI that's
  2400 × 2400 px; at 300 DPI it's 7200 × 7200 and sharp starts getting
  unhappy. If wanted, we'll add it with an on-demand render job rather
  than default fan-out.
- **Produce case card** (bakery/deli-front 4 × 6 in) — sized close enough
  to the Bin Card + Counter Card to not add a third variant for the
  demo.

---

## Implementation notes

- Stored as a const `POP_SIZE_PRESETS` keyed by category.
- A new "Apply POP preset pack" button in the template editor's output-specs
  panel lets a designer multi-select sizes and bulk-add them to any
  template. No new migration; reuses existing `template_output_specs`.
- Channel field on each spec is set to `in-store` or `print` so the
  variant gallery can filter. Format defaults to PNG (JPG for larger
  sizes where JPG's smaller file beats lossless).

---

## Sources

Confirmed sizes / industry terms via these retail-display suppliers:

- [DGS Retail — end-cap display dimensions (36W × 54H × 16D)](https://www.dgsretail.com/P356U-EC/lozier-shelving-end-cap-display-unit-platinum-36w-54h-16d)
- [myboxprinter — shelf talker custom sizes](https://www.myboxprinter.com/shelf-talkers)
- [Sunrise Hitek — aisle violator materials and shapes](https://www.sunrisehitek.com/product/aisle-violators)
- [ScreenGems / SGI — end-cap and gondola headers](https://sgimerchandising.com/collections/end-cap-and-gondola-headers-signage)
- [Clip Strip — corrugated dump bin (24⅜ × 20¼ × 30¼)](https://www.clipstrip.com/large-corrugated-dump-bin-display-db-3.html)
- [IDL Displays — shelf wobblers / danglers](https://www.idldisplays.com/us_en/product-merchandising/shelf-management.html)
- [Wikipedia — Endcap](https://en.wikipedia.org/wiki/Endcap)
