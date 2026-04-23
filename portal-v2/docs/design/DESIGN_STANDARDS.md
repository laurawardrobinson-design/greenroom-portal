# Portal V2 — Design Standards

*The contract. If it isn't here, it isn't in the system. Every page, modal, tile, and pill complies with this document. Derived from the six councils in DESIGN_AUDIT.md.*

Version 1.0 · 2026-04-23 · Maintainer: design system owner · Breaking changes require a council.

---

## 0. Non-negotiables

1. **Inter is the only typeface.** No monospace, no serif, no `@font-face` additions, no exceptions. `--font-sans` references `var(--font-inter)`.
2. **No text smaller than 10pt (≈13.3px).** Baseline floor is `--font-size-min-readable`.
3. **No hardcoded Tailwind colors for semantic meaning.** Always use tokens (`var(--color-*)` or class mapped to token). Raw `bg-amber-50`, `text-slate-700`, etc. forbidden.
4. **Every overlay honors the overlay contract** (§7). Esc + click-outside + X + focus trap + shadow-lg + backdrop `bg-black/50 backdrop-blur-[2px]`. Mandatory.
5. **Every tile uses the tile header pattern** (§5). ALL CAPS, text-sm, icon, gap-2, `border-b`. No drift.
6. **Minimize clicks by default.** Every list defaults to "what's waiting on you." Every card exposes actions via kebab menu. Every destructive action has Undo.
7. **The editorial litmus test.** A tile, page, or pill that wouldn't pass a creative-director stare is not shipped.

---

## 1. Color system

### 1.1 Canonical tokens (defined in globals.css — do not fork)

**Brand**
- `--color-sidebar` `#10442B` — sidebar nav surface
- `--color-sidebar-hover` `#4A7458` — sidebar hover
- `--color-sidebar-active` `#0b3321` — sidebar active item
- `--color-primary` `#69A925` — CTAs, active state, focus rings, primary accent
- `--color-primary-hover` `#5a9420`
- `--color-primary-light` `#e8f5e0` — selection, subtle highlight

**Surfaces**
- `--color-surface` `#ffffff` — page, card, modal background
- `--color-surface-secondary` `#F5F7F5` — secondary surfaces (hovers, subtle differentiation)
- `--color-surface-tertiary` `#EDEFED` — rarely used, bordered pills, chip backgrounds

**Borders**
- `--color-border` `#D9D9D9` — default
- `--color-border-light` `#CFCFCF` — subtler separators; use sparingly

**Text**
- `--color-text-primary` `#1F1F1F` — body, headings
- `--color-text-secondary` `#4b5563` — metadata, labels
- `--color-text-tertiary` `#6b7280` — disabled, placeholder, timestamps
- `--color-text-inverse` `#ffffff` — on primary/sidebar

**Status (semantic)**
- `--color-success` `#059669` — done, approved, paid
- `--color-warning` `#d97706` — pending, at-risk, submitted-not-yet-approved
- `--color-error` `#dc2626` — rejected, over budget, flagged
- `--color-info` `#2563eb` — in-review, queued, submitted

### 1.2 Status-pill color mapping (single source of truth)

| State | Token | Tint | Border |
|---|---|---|---|
| Draft | `--color-text-tertiary` | `rgba(107, 114, 128, 0.08)` | `rgba(107, 114, 128, 0.20)` |
| Submitted | `--color-info` | `rgba(37, 99, 235, 0.08)` | `rgba(37, 99, 235, 0.20)` |
| Pending / Awaiting | `--color-warning` | `rgba(217, 119, 6, 0.08)` | `rgba(217, 119, 6, 0.20)` |
| Approved / Ready | `--color-success` | `rgba(5, 150, 105, 0.08)` | `rgba(5, 150, 105, 0.20)` |
| Rejected / Error | `--color-error` | `rgba(220, 38, 38, 0.08)` | `rgba(220, 38, 38, 0.20)` |
| Info / Queued | `--color-info` | `rgba(37, 99, 235, 0.08)` | `rgba(37, 99, 235, 0.20)` |

Implementation: one `<StatusPill variant="draft|submitted|pending|approved|rejected|info">` component. Nothing else renders a status pill.

### 1.3 Role-badge mapping (single source of truth)

| Role | Text color | Tint |
|---|---|---|
| Admin / HOP | `#6b21a8` (purple-800) | `rgba(107, 33, 168, 0.08)` |
| Producer | `#1e40af` (blue-800) | `rgba(30, 64, 175, 0.08)` |
| Studio | `#0f766e` (teal-700) | `rgba(15, 118, 110, 0.08)` |
| Art Director | `#b45309` (amber-700) | `rgba(180, 83, 9, 0.08)` |
| Creative Director | `#9a3412` (orange-800) | `rgba(154, 52, 18, 0.08)` |
| Designer | `#6b21a8` | `rgba(107, 33, 168, 0.08)` |
| Brand Marketing Manager | `#047857` (emerald-700) | `rgba(4, 120, 87, 0.08)` |
| Vendor | `#4b5563` (text-secondary) | `rgba(75, 85, 99, 0.08)` |

Implementation: one `<RoleBadge role="Producer">` component, reading from a single `ROLE_STYLES` constant.

### 1.4 Budget-state dots (appears wherever a $ amount does)

- <80% of budget → `--color-success`
- 80–100% → `--color-warning`
- >100% → `--color-error`

### 1.5 Banned patterns

- `bg-amber-50`, `bg-emerald-50`, `bg-blue-50`, `bg-red-50`, `text-amber-800`, any raw Tailwind color class used for semantic meaning.
- `bg-white/10`, `border-white/20` on anything not inside a photo overlay.
- Duplicate hex values in component files.

---

## 2. Typography

### 2.1 Scale

| Token | Size | Use |
|---|---|---|
| `--text-display` | 2rem (32px) | Hero titles (dashboard hero only) |
| `--text-page` | `clamp(1.5rem, 1.35rem + 0.3vw, 1.75rem)` (24–28px) | Page titles via `.ui-page-title` |
| `--text-section` | 1.125rem (18px) | Inside-tile section headers, sentence case, semibold |
| `--text-tile-header` | 0.875rem (14px) | Tile headers, ALL CAPS, tracking-wider, semibold |
| `--text-body` | 0.875rem (14px) | Default body |
| `--text-small` | 0.833rem (≈13.3px) | Dense data, metadata |
| `--text-caption` | 0.75rem (12px) | Floor — only in chips/badges, never paragraphs |

No `text-[13px]`, `text-[15px]`, `text-[11px]` anywhere. Use the tokens above.

### 2.2 Weights

- `font-normal` (400) — body
- `font-medium` (500) — emphasized labels, nav items
- `font-semibold` (600) — all UI chrome (tabs, tile headers, buttons, titles)
- `font-bold` (700) — page title only
- `font-black` — never

### 2.3 Letter-spacing

- Tile headers: `tracking-wider` (0.05em) + `uppercase`
- Page titles: `letter-spacing: -0.01em`
- Everything else: normal

### 2.4 Line-heights

- Body / paragraphs: 1.5 (`--line-height-readable`)
- Dense UI (tabs, chips, tight data): 1.35 (`--line-height-dense-readable`)
- Page titles: 1.2 (`--ui-page-title-line-height`)
- Tile headers: 1.35

### 2.5 Hierarchy rule

On any page you should be able to identify, in 2 seconds:
1. The page title (largest, top)
2. The primary tile (largest tile, most visual weight)
3. The primary action (primary button, top-right)

If the user can't, the hierarchy is wrong.

---

## 3. Spacing (baseline = 8px)

### 3.1 Scale tokens

| Token | Value | Use |
|---|---|---|
| `--space-0` | 0 | reset |
| `--space-1` | 4px | tight chip internals |
| `--space-2` | 8px | dense rows, input padding-y |
| `--space-3` | 12px | card content gaps, button padding-y |
| `--space-4` | 16px | default card padding, default stack |
| `--space-5` | 20px | section breaks within a tile |
| `--space-6` | 24px | page section breaks |
| `--space-8` | 32px | page hero separations |
| `--space-12` | 48px | page top/bottom padding on desktop |

**Banned:** `space-y-5` (20/16 ambiguity), `space-y-7`, `p-5`, `py-3.5`, arbitrary fractional Tailwind values. If a value isn't on the scale, add a reasoned token — don't drift.

### 3.2 Page layout constants

- Page content padding (desktop): `var(--density-page-content-px-lg)` × `var(--density-page-content-py)` = 16 × 20.
- Default vertical stack for a page body: `gap: var(--space-6)` (24px).
- Filter/control bar height: `var(--density-button-h-md)` (36px).
- Sidebar width: 260px default, 72px collapsed.

### 3.3 Density

Two modes via `[data-density="compact"]` on `<html>`. Comfortable is default. Compact reduces ~15%. User preference in /settings.

---

## 4. Border radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 4px | chips, pills (non-fully-rounded) |
| `--radius-md` | 8px | inputs, buttons, small cards |
| `--radius-lg` | 12px | modals, large cards, panels |
| `--radius-full` | 9999px | avatars, status pills, round buttons |

Ban `rounded-2xl` (16px), `rounded-3xl`, arbitrary. Mobile sheet-top gets `rounded-t-[12px]` (= `--radius-lg` doubled on top corners only).

---

## 5. Tile & Card

### 5.1 Tile header (required on every tile)

```tsx
<Card padding="none">
  <CardHeader>
    <CardTitle>
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      TILE NAME
    </CardTitle>
    {optionalTrailingActions}
  </CardHeader>
  <CardBody className="p-4">
    {/* content */}
  </CardBody>
</Card>
```

- Classes: `flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-primary`
- Padding: `px-3.5 py-2.5`
- Separator: `border-b border-border`
- Card's own padding: **none** — header controls all top spacing

### 5.2 Tile levels

- **L1 — Hero tile**: page-dominating; 4–8 data points; occupies ≥50% of page width on desktop; large type permitted.
- **L2 — Summary tile**: typical tile; 2–4 data points; standard size.
- **L3 — Meta tile**: small; 1 data point + label; used in tile strips across the top.

Hierarchy must be deliberate: a page with 6 L2 tiles and no L1 is a page without a star.

### 5.3 Card padding

- `padding="none"` — header controls all
- `padding="sm"` — `var(--density-card-p-sm)` (16px)
- `padding="md"` — `var(--density-card-p-md)` (20px)
- `padding="lg"` — `var(--density-card-p-lg)` (24px)

No inline `p-4`, `p-5`, `p-6` on cards.

---

## 6. Buttons

### 6.1 Variants

- **Primary** — `bg-primary text-white hover:bg-primary-hover`. Only one per section.
- **Secondary** — `bg-surface-secondary text-text-primary border border-border hover:bg-surface-tertiary`
- **Ghost** — no background, `text-text-primary hover:bg-surface-secondary`
- **Destructive** — `bg-error text-white hover:bg-error/90`
- **Link** — `text-primary hover:underline underline-offset-2`

### 6.2 Sizes

Use density tokens; do not hardcode heights.

- `sm` — `h-[var(--density-button-h-sm)]` (32px), `px-[var(--density-button-px-sm)]` (12px)
- `md` — 36px × 16px (default)
- `lg` — 44px × 20px

### 6.3 Icon + label gap

`var(--density-button-gap-md)` (8px). Icons are `h-4 w-4` for sm/md, `h-5 w-5` for lg. Icon color inherits from text.

### 6.4 Placement rules

- **Primary "Create" button: top-right of every page.** Muscle memory.
- Secondary actions to the left of primary.
- Destructive actions have a Confirm step.
- In modal footers: secondary-left, primary-right.

---

## 7. Overlay contract

### 7.1 Choose the right overlay

| Purpose | Component |
|---|---|
| Confirm a decision (yes/no) | `ConfirmDialog` |
| Simple single-intent input (≤2 fields, 2 buttons) | `Modal size="sm"` |
| Multi-field form or editing flow | `Drawer` (right-slide desktop, bottom-sheet mobile) |
| Rich preview (PDF, image, video) | `Modal size="lg"` or `xl` |
| Full-bleed experience (canvas, etc.) | `Modal size="3xl"` |

If an editor has ≥3 fields, it is a Drawer. No exceptions. `AddSetupDrawer` gets renamed to `AddSetupModal` because it's sm.

### 7.2 Chrome — identical on every overlay

- Backdrop: `bg-black/50 backdrop-blur-[2px]`
- Panel: `bg-surface rounded-[var(--radius-lg)] shadow-lg border border-border`
- Header: `text-lg font-semibold text-text-primary`, `px-[var(--density-drawer-header-px)] py-[var(--density-drawer-header-py)]`, `border-b border-border`
- Close: `X` button top-right, `h-8 w-8`, `text-text-tertiary hover:text-text-primary`
- Behaviors: Esc-to-close, click-outside-to-close, focus trap, body scroll lock on open
- Mobile: sheet-bottom with `rounded-t-[var(--radius-lg)]` and `max-h-[90vh]`

### 7.3 Z-index scale

Tokenize, do not arbitrary-number.

| Token | Value | Use |
|---|---|---|
| `--z-base` | 0 | default |
| `--z-sticky` | 10 | sticky table headers, sticky drawer headers |
| `--z-overlay` | 40 | backdrop |
| `--z-modal` | 50 | modal, drawer panels |
| `--z-popover` | 60 | dropdowns, popovers inside modals |
| `--z-tooltip` | 70 | tooltips |
| `--z-toast` | 80 | toasts (above everything) |
| `--z-lightbox` | 90 | fullscreen image/video |

A dropdown *inside* a modal uses `--z-popover` (= 60), above the modal panel (50). No more z-10 dropdowns hiding under modals.

### 7.4 Overlay shadows

Modals / drawers: `shadow-lg`. Never `shadow-xl` or `2xl`. The backdrop does the separation work.

### 7.5 Header treatment

Every overlay header:

```
[ Icon? ] Title                              [ X ]
Optional 1-line subtitle in text-secondary
```

Title is `text-lg font-semibold`. Subtitle is `text-sm text-text-secondary mt-0.5`. Close button stays top-right.

---

## 8. Forms

### 8.1 Input

- Classes: `rounded-[var(--density-control-radius)] border border-border bg-surface px-[var(--density-control-px)] py-[var(--density-control-py)] text-sm`
- Focus: `focus:border-primary focus:outline-none` — **never stack a ring on top of a border**. (Your `feedback_focus_rings` memory enforces this.)
- Error: `border-error`; message below in `text-xs text-error`.
- Disabled: `opacity-60 cursor-not-allowed`.
- Placeholder: `text-text-tertiary`.

### 8.2 Label

- `text-sm font-medium text-text-primary mb-1` above the field.
- Required: append a `*` in `text-error`.
- Optional: append `(optional)` in `text-xs text-text-tertiary`.

### 8.3 Form stack

- Vertical gap: `var(--density-form-stack-gap)` (6px) between label and field. Between fields: `var(--space-4)` (16px).

### 8.4 Select / Dropdown

- Native `<select>` styled identical to Input.
- Custom dropdown (search/filter) uses `<Popover>` primitive at `z-popover`.

### 8.5 Date picker

- Shared `DateRangePicker` / `DateChipPicker`. Never ship a new date picker.

---

## 9. List views

### 9.1 Structure

```
[ Page header: title + create-button top-right ]
[ Filter row: search (left) + filters + view toggle (right) ]
[ Content: grid | list | calendar ]
[ Empty state (if empty) ]
```

### 9.2 Default filter by persona (every list)

- Producer → "My current campaigns" / "PRs awaiting me" / "My tasks"
- Art Director → "Variants pending review" / "My assignments"
- Admin/HOP → "Approvals awaiting me" sorted by $
- Vendor → "My documents, most recent first"

### 9.3 Filter pills

Count badge on every filter: e.g. `Pending (12)`. Active filter uses `bg-primary-light text-primary-hover`.

### 9.4 Card kebab menu (every list item)

- Three-dot icon top-right of card
- Opens Popover with list-item-appropriate actions
- Includes at minimum: "Open" / "Flag" / "Archive" / "Duplicate" / "Copy link"
- Right-click on the card body opens the same menu

### 9.5 Empty state

Shared `<EmptyState>` component. Always includes: icon, title, 1-sentence explanation, primary CTA ("Create your first …"). No empty list without a next step.

### 9.6 Pagination

- Load-more button by default (not numbered pagination) for <1k items
- `<DataTable>` primitive for >1k with virtualization

---

## 10. Tables (for dense data)

- Header row: `bg-surface-secondary text-text-secondary text-xs font-semibold uppercase tracking-wider`
- Row: `border-b border-border hover:bg-surface-secondary`
- Row padding: 10px vertical, 14px horizontal (use density tokens)
- Numeric columns: `text-right tabular-nums` (Inter has tabular nums — use it)
- Sortable columns: caret icon in header, click to toggle
- Row-level kebab menu rightmost

---

## 11. Navigation

### 11.1 Sidebar — grouped, 5 zones

```
GREENROOM [logo]

  ▸ WORK
    · Dashboard
    · Campaigns
    · Product Requests
    · Calendar

  ▸ CREATE
    · Asset Studio
    · Post-Workflow

  ▸ RESOURCES
    · Products
    · Gear
    · Wardrobe
    · Props
    · Studio

  ▸ PEOPLE
    · Contacts

  ▸ FINANCE
    · Budget
    · Estimates & Invoices
```

- Group labels: `text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-2 px-3`
- Items: 36px height, 14px left padding, 8px gap icon/label, `text-sm font-medium`
- Active: `bg-sidebar-active text-text-inverse`, 3px primary indicator on left
- Role-filter items inside groups; hide empty groups

**Moved out of sidebar:**
- Settings → user menu (avatar top-right)
- Goals → user menu or dashboard widget
- Pre-production → campaign-scoped only
- `/campaigns/[id]/shots` → removed, shots live in Pre-Production

**Fixed:**
- No hardcoded department (`/brand-marketing/review/Bakery` → `/brand-marketing/review`)
- No duplicate Estimates & Invoices (role-filter the one link)

### 11.2 Top bar (right side)

- Global search / command palette trigger (Cmd-K) — single button with `Search` icon
- Notifications bell with count
- User menu (avatar + name → dropdown: profile, settings, goals, help, sign out)

### 11.3 Breadcrumbs

Only on ≥ 2nd-level pages. `text-xs text-text-tertiary`, chevrons, last crumb bold-primary text-color.

---

## 12. Dashboard

Dashboard is a **work queue**, not a brochure. Per role:

**Producer landing**
- Row 1 — L3 tile strip (5 counts): "PRs awaiting me", "Campaigns over budget", "Shoots this week", "Overdue tasks", "Flagged products"
- Row 2 — L1 hero: "Ship this week" — shoots + readiness checklist
- Row 3 — L2 tiles: "My campaigns", "Recent activity"

**Admin landing**
- Row 1 — Approvals Inbox (primary), sorted by $ risk, with bulk-approve-under-$X
- Row 2 — L2 tiles: "Budget pulse", "PR backlog", "Vendor onboarding"

**Art Director landing**
- Row 1 — Variants pending review (primary)
- Row 2 — L2: "Assigned shots", "Recent renders"

**Vendor landing**
- Three tiles: Submit estimate / Upload invoice / My status. No sidebar.

---

## 13. Command palette (Cmd-K)

Ships before Q3. Powered by fuzzy search across:
- Pages (static list)
- Recent campaigns, PRs, invoices, products (last 30 days)
- Pinned items (user-pinned from any detail page)
- Quick actions ("Create campaign", "New PR", "Reserve gear")

Shortcut surface: `⌘K` on Mac, `Ctrl K` on Windows/Linux. Indicator in top bar.

---

## 14. Motion

### 14.1 Durations

- Fast (hover, focus, color changes): 150ms
- Normal (modal open, toast slide): 200ms
- Slow (drawer slide, large panel): 300ms

### 14.2 Easing

Single curve: `cubic-bezier(0.16, 1, 0.3, 1)` — snappy, editorial.

### 14.3 Entry patterns

- Modal: `animate-in fade-in zoom-in-95 duration-200`
- Drawer: `animate-in slide-in-from-right duration-300`
- Mobile sheet: `slide-in-from-bottom`
- Toast: `slide-in-from-right`
- Collapsible: `slide-in-from-top-1 fade-in`

### 14.4 Reduced motion

`@media (prefers-reduced-motion: reduce)` globally disables non-essential animation (keep fade for context, kill slide/scale). Required for AA conformance.

### 14.5 Easter egg creatures

Keep. Move out of `globals.css` into `creatures.css`. Not part of design-system tokens.

---

## 15. Imagery

- Product images: square, 1:1, rounded-md, object-cover, background `bg-surface-secondary`
- Talent photos: square, `rounded-full` in avatar spots, rounded-md in cards
- Asset renders: native aspect, no forced crop
- Empty-image placeholder: Lucide icon centered, `text-text-tertiary`, `bg-surface-secondary`
- No hand-authored illustration SVGs (per user memory `feedback_no_hand_authored_art`). Photography or designer-commissioned assets only.

---

## 16. Accessibility

- All interactive elements reachable by keyboard
- Visible `:focus-visible` outline (2px primary, 2px offset, 4px radius) per globals.css
- Do not stack `focus:border-*` with `focus:ring-*` (per `feedback_focus_rings`)
- Color is never the only signal — status uses color + icon + text
- WCAG AA contrast minimum (4.5:1 body, 3:1 large text)
- `prefers-reduced-motion` respected
- Screen-reader-only text with `sr-only` on icon-only buttons

---

## 17. Writing

- Sentence case everywhere except page titles, tile headers (uppercase), and acronyms
- Active voice ("Approve" not "Approval")
- Short button labels: 1–2 words
- Error copy: what happened + what to do ("Couldn't save — check your connection and retry")
- No jargon creep. Glossary in `docs/design/GLOSSARY.md` (forthcoming).

---

## 18. Print pages

Invoices, POs, estimates render at US Letter, 100% scale, no reflow:

- Margin: 1" all sides
- Body: Inter, 11pt, line-height 1.5
- Headings: Inter, 14pt/18pt semibold
- Color: black on white only (logo the sole exception)
- No UI chrome: print CSS hides sidebar, toasts, buttons
- Tabular numerics for $ columns

---

## 19. Code-level enforcement

### 19.1 Lint rules

- ESLint rule: forbid raw Tailwind color classes on a list (e.g. `bg-amber-50`, `text-emerald-800`) outside `docs/design` and test fixtures.
- ESLint rule: forbid `text-[9px]`, `text-[11px]`, `text-[13px]`, `text-[15px]`.
- ESLint rule: forbid `space-y-5`, `space-y-7`, `p-5`, `py-3.5`, `gap-5`.
- ESLint rule: forbid `z-[100]`, `z-[60]` — must use z-index token class.

### 19.2 Shared components (must exist, must be used)

- `StatusPill`, `RoleBadge`, `BudgetDot`
- `PageHeader`, `PageTabs`, `FilterBar`
- `Modal`, `Drawer`, `ConfirmDialog`, `Popover`
- `Card`, `CardHeader`, `CardTitle`, `CardBody`
- `Input`, `Textarea`, `Select`, `DateChipPicker`, `DateRangePicker`
- `KebabMenu`, `EmptyState`, `LoadingSkeleton`
- `Avatar`, `UserAvatar`
- `DataTable`
- `CommandPalette`

Any new component requires a written exemption in `/docs/design/EXEMPTIONS.md` with a dated justification.

### 19.3 CSS file split

- `tokens.css` — tokens only (the `@theme inline` block + density roots)
- `primitives.css` — html/body/focus/scrollbar/selection/motion
- `ui.css` — `.ui-page-header`, `.ui-tab`, `.ui-tab-underline`, etc.
- `creatures.css` — Mutant Menagerie
- `globals.css` — imports the above; no rules of its own

### 19.4 PR checklist (in `.github/pull_request_template.md`)

- [ ] No raw Tailwind color for semantic state
- [ ] No text size outside the scale
- [ ] No spacing outside the scale
- [ ] All overlays honor the overlay contract
- [ ] All tiles use the tile header pattern
- [ ] `focus-visible` tested with keyboard
- [ ] Reduced-motion respected

---

## 20. Design-system governance

- **Owner**: one named maintainer. Changes to this doc need their review.
- **Councils**: on breaking changes (new token, removed variant), hold a mini-council of 3 (editorial + UX + user) and record decisions in `/docs/design/DECISIONS.md`.
- **Cadence**: full re-audit quarterly. Run the six-council exercise again.
- **Telemetry** (future): instrument click paths for the 10 top jobs. Any job > 3 clicks is a bug.

---

## Appendix A — Token cheat sheet

```css
/* Colors */
bg-surface text-text-primary border-border
bg-surface-secondary bg-surface-tertiary
text-primary text-text-secondary text-text-tertiary text-text-inverse
bg-primary hover:bg-primary-hover text-white
text-success text-warning text-error text-info

/* Spacing */
--space-1 4px   --space-2 8px    --space-3 12px
--space-4 16px  --space-5 20px   --space-6 24px
--space-8 32px  --space-12 48px

/* Radius */
--radius-sm 4px   --radius-md 8px   --radius-lg 12px   --radius-full 9999px

/* Shadow */
--shadow-xs --shadow-sm --shadow-md --shadow-lg

/* Z-index */
--z-sticky 10  --z-overlay 40  --z-modal 50  --z-popover 60
--z-tooltip 70 --z-toast 80    --z-lightbox 90

/* Motion */
--duration-fast 150ms  --duration-normal 200ms  --duration-slow 300ms
--ease-out cubic-bezier(0.16, 1, 0.3, 1)

/* Type */
--text-display 32 / --text-page clamp / --text-section 18
--text-tile-header 14 UPPER tracking-wider
--text-body 14 / --text-small 13.3 / --text-caption 12
```

*This file is the contract. When in doubt, read §0 again.*
