# Portal V2 — Design Fix Plan

*Prioritized, sequenced execution. Closes the gap between today (score 5.5) and pristine (9). Each step cites the standard it enforces (see DESIGN_STANDARDS.md) and the council that demanded it (see DESIGN_AUDIT.md §3–§8).*

---

## Sequencing principle

Three phases, ordered so the later work is cheaper because the earlier work is done:

1. **Foundations** — token hygiene, shared components, primitives. Before we fix pages, fix the vocabulary.
2. **Systemic UI fixes** — apply the new primitives across every page, modal, list. Touches most files; low-risk because each replacement is a direct substitution.
3. **IA & flow fixes** — restructure nav, dashboards, split overloaded pages, ship Cmd-K.

Do **not** interleave. A one-off fix on `/wardrobe` before StatusPill exists creates future rework.

---

## PHASE 1 — Foundations (est. 3–4 days focused)

### 1.1 Split `globals.css` into four files

**Files:** `portal-v2/app/globals.css`, new `portal-v2/app/styles/tokens.css`, `primitives.css`, `ui.css`, `creatures.css`.

**Change:** Move the `@theme inline` block + `:root` density vars → `tokens.css`. Move html/body/scrollbar/focus/selection/radio/transitions → `primitives.css`. Move `.ui-*` classes → `ui.css`. Move all creature keyframes/classes → `creatures.css`. `globals.css` reduces to an import list + `@import "tailwindcss";`.

**Why:** Editorial Council (Rams). Makes tokens readable; separates entertainment from contract. **Est. 2 h.**

### 1.2 Add missing tokens

In `tokens.css`, add:

```css
@theme inline {
  /* Typography scale */
  --text-display: 2rem;
  --text-page: clamp(1.5rem, 1.35rem + 0.3vw, 1.75rem);
  --text-section: 1.125rem;
  --text-tile-header: 0.875rem;
  --text-body: 0.875rem;
  --text-small: 0.833333rem;
  --text-caption: 0.75rem;

  /* Spacing scale */
  --space-0: 0; --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem;
  --space-4: 1rem; --space-5: 1.25rem; --space-6: 1.5rem;
  --space-8: 2rem; --space-12: 3rem;

  /* Radius scale */
  --radius-sm: 0.25rem; --radius-md: 0.5rem; --radius-lg: 0.75rem; --radius-full: 9999px;

  /* Z-index scale */
  --z-base: 0; --z-sticky: 10; --z-overlay: 40; --z-modal: 50;
  --z-popover: 60; --z-tooltip: 70; --z-toast: 80; --z-lightbox: 90;

  /* Status tints */
  --status-draft-fg: #6b7280; --status-draft-tint: rgba(107,114,128,0.08); --status-draft-border: rgba(107,114,128,0.20);
  --status-submitted-fg: #2563eb; --status-submitted-tint: rgba(37,99,235,0.08); --status-submitted-border: rgba(37,99,235,0.20);
  --status-pending-fg: #d97706; --status-pending-tint: rgba(217,119,6,0.08); --status-pending-border: rgba(217,119,6,0.20);
  --status-approved-fg: #059669; --status-approved-tint: rgba(5,150,105,0.08); --status-approved-border: rgba(5,150,105,0.20);
  --status-rejected-fg: #dc2626; --status-rejected-tint: rgba(220,38,38,0.08); --status-rejected-border: rgba(220,38,38,0.20);
  --status-info-fg: #2563eb; --status-info-tint: rgba(37,99,235,0.08); --status-info-border: rgba(37,99,235,0.20);
}
```

**Why:** All councils converged. **Est. 1 h.**

### 1.3 Build `StatusPill` component

**File:** `portal-v2/components/ui/status-pill.tsx` (new)

```tsx
type Variant = "draft" | "submitted" | "pending" | "approved" | "rejected" | "info";
export function StatusPill({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  return (
    <span
      data-variant={variant}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border"
      style={{
        color: `var(--status-${variant}-fg)`,
        backgroundColor: `var(--status-${variant}-tint)`,
        borderColor: `var(--status-${variant}-border)`,
      }}
    >
      {children}
    </span>
  );
}
```

**Why:** All councils, User Council 2 (Gretchen: "I want to trust the status pill"). **Est. 1 h.**

### 1.4 Build `RoleBadge` component

**File:** `portal-v2/components/ui/role-badge.tsx` (new). One `ROLE_STYLES` constant map (see standards §1.3). Used in `/goals`, `/contacts`, `/settings`.

**Est. 1 h.**

### 1.5 Build `BudgetDot` component

**File:** `portal-v2/components/ui/budget-dot.tsx` (new). Takes `percent` prop, renders a colored dot (green <80, amber 80–100, red >100) + optional amount tooltip.

**Est. 30 min.**

### 1.6 Build `KebabMenu` component

**File:** `portal-v2/components/ui/kebab-menu.tsx` (new). Wraps the existing Popover pattern. Accepts `items: { label, icon, onClick, variant? }[]`. Right-click on parent also opens.

**Why:** UX Council (Nielsen, Norman). Cuts clicks on dozens of flows. **Est. 2 h.**

### 1.7 Refactor `Modal` & `Drawer` to honor the overlay contract

**Files:** `components/ui/modal.tsx`, `components/ui/drawer.tsx`.

**Changes:**
- Drawer gains focus trap (currently only Modal has it)
- Backdrop standardized to `bg-black/50 backdrop-blur-[2px]` on both
- Shadow standardized to `shadow-lg` on both
- Radius standardized to `rounded-[var(--radius-lg)]` (drawer adds `rounded-t-[var(--radius-lg)]` on mobile sheet)
- Z-index classes switch to tokens (`z-modal`, or via inline `zIndex: 'var(--z-modal)'` if Tailwind doesn't yet know the tokens — update `tailwind.config` for z tokens)
- Drawer gains an optional footer slot that mirrors ModalFooter

**Est. 3 h.**

### 1.8 Add ESLint rules

**File:** `portal-v2/.eslintrc.cjs` (or existing config).

Forbid:
- `bg-(amber|emerald|red|blue|slate|purple|teal)-(50|100|200|700|800|900)` in `*.tsx` files outside `docs/`, `components/ui/status-pill.tsx`, `components/ui/role-badge.tsx`
- `text-(amber|emerald|red|blue|slate|purple|teal)-(700|800|900)` same
- `text-\[(9|11|13|15)px\]`
- `space-y-(5|7)`, `gap-(5|7)`, `p-5`, `py-3\.5`
- `z-\[(60|100)\]`

Warning-level for first commit; error-level after Phase 2 complete.

**Est. 1 h.**

### 1.9 Tailwind config extends

Register spacing scale, radius scale, z-index, color tokens as Tailwind utilities so components can use `bg-surface`, `rounded-lg`, `z-modal`, etc., natively.

**Est. 1 h.**

### Phase 1 exit criteria

- ✅ `tokens.css` / `primitives.css` / `ui.css` / `creatures.css` exist; `globals.css` is only imports
- ✅ `StatusPill`, `RoleBadge`, `BudgetDot`, `KebabMenu` shipped with Storybook-style demo page at `/laurai/design-system`
- ✅ `Modal` + `Drawer` both honor the contract
- ✅ Lint rules active (warning level)
- ✅ Design-system demo page visible on preview server, no console errors

---

## PHASE 2 — Systemic UI (est. 5–6 days focused)

### 2.1 Replace every hardcoded status color with `<StatusPill>`

**Files affected** (via grep — adjust list after Phase 1):
- `portal-v2/app/(portal)/product-requests/page.tsx` (lines 139–150)
- `portal-v2/components/product-requests/pr-status-pill.tsx` (migrate to new StatusPill internally)
- `portal-v2/components/ui/badge.tsx` (deprecate semantic-state variants; keep neutral)
- `portal-v2/components/ui/toast.tsx` (map emerald/red/blue/amber to success/error/info/warning tokens)
- Any `bg-amber-50`, `bg-emerald-50`, `bg-blue-50`, `bg-red-50` in feature components

**Method:** Grep each pattern, replace call sites to use `<StatusPill variant="...">`. Remove dead classes.

**Est. 1 day.**

### 2.2 Replace every role-color literal with `<RoleBadge>`

**Files:**
- `app/(portal)/goals/page.tsx:65-69`
- `app/(portal)/contacts/page.tsx:52-56`
- `app/(portal)/settings/page.tsx:41-46`

**Est. 2 h.**

### 2.3 Migrate non-standard overlays to base primitives

- `ShotListModal` → use `Modal size="2xl"` base, not custom overlay
- `SendPoModal` → use `Modal size="xl"` base (keep its custom step UI inside)
- `ProductDrawer` → rebuild on `Drawer` base; fix dropdown z-index to `--z-popover`
- `GearDetailModal` → rebuild on `Modal` base; X becomes the standard header close
- `AddSetupDrawer` → rename to `AddSetupModal` (it's actually a Modal)
- `PdfPreviewModal` → remove inline `style` objects; use Tailwind classes

**Est. 1.5 days.**

### 2.4 Audit every tile; enforce tile-header pattern

**Method:** Grep for `CardHeader` / `<Card` usage. For each tile not using `CardTitle` with the canonical classes, update to match standard §5.1.

**Scope:** Campaign detail page tiles (highest drift), dashboard tiles, budget page tiles.

**Est. 1 day.**

### 2.5 Unify search input styling

Replace `shadow-xs rounded-xl`, `rounded-lg`, and ad-hoc custom search inputs with a single `<SearchInput>` component (wraps `Input`, adds magnifying-glass icon left, clear-button right).

**Files:** `/campaigns`, `/products`, `/vendors`, `/contacts`, `/goals`.

**Est. 3 h.**

### 2.6 Unify view toggle (grid/list)

One `<ViewToggle mode={...} onChange={...}>` component. Replace three implementations.

**Est. 1 h.**

### 2.7 Fix focus-state stacking

Grep for `focus:border-*` + `focus:ring-*` stacked on the same element. Remove the ring — border is the focus state for form controls (per your `feedback_focus_rings` memory). Global `:focus-visible` outline stays for non-form elements.

**Est. 1.5 h.**

### 2.8 Kill `space-y-5`, `space-y-7`, `p-5`, `py-3.5`

Grep and replace with nearest scale values. Usually `space-y-5` → `space-y-6`, `p-5` → `p-4` or `p-6`.

**Est. 3 h.**

### 2.9 Normalize `space-y-5` page-stack drift

Pick one page-level vertical stack: `space-y-6`. Apply to every page-root container.

**Est. 30 min.**

### 2.10 Ensure PageHeader is used on every page

Every page's top section uses `<PageHeader title={...} actions={...} />`. No inline `text-2xl font-bold`.

**Est. 1.5 h.**

### Phase 2 exit criteria

- ✅ Zero ESLint errors on banned color / size / spacing rules
- ✅ All overlays render with identical backdrop, shadow, radius
- ✅ All tiles pass the tile-header visual snapshot
- ✅ Search & view-toggle one implementation each
- ✅ Preview server: spot-check 10 random pages; typography/color/overlay drift zero

---

## PHASE 3 — IA & Flow (est. 5–6 days focused)

### 3.1 Sidebar grouping (5 zones)

**File:** `portal-v2/components/layout/sidebar.tsx`

- Refactor nav items into `NavGroup` structure with 5 groups (WORK / CREATE / RESOURCES / PEOPLE / FINANCE)
- Remove: Settings, Goals, Pre-Production, `/campaigns/[id]/shots`, duplicate Estimates & Invoices
- Fix: `/brand-marketing/review/Bakery` → `/brand-marketing/review` (and update the page to render a dept picker)

**Est. 0.5 day.**

### 3.2 User menu in top bar

**File:** new `components/layout/user-menu.tsx`; integrate into `AppShell`.

Contains: profile, settings, goals, help, sign out. Avatar top-right.

**Est. 4 h.**

### 3.3 Dashboard redesign per role (work-queue)

**Files:** `app/(portal)/dashboard/page.tsx` + role-specific `components/dashboards/*.tsx`.

- Producer dashboard: L3 count strip + L1 "Ship this week" + L2 tiles
- Admin dashboard: Approvals Inbox (L1) + secondary tiles
- Art Director dashboard: Variants pending (L1) + assigned shots
- Vendor dashboard (in vendor shell): three tiles

**Est. 2 days.**

### 3.4 Default list filters per role

Every list page: compute default filter from `useCurrentUser().role`. PRs default to "Awaiting you." Variants default to "Pending." Budget defaults to "Needs decision."

**Files:** `/product-requests/page.tsx`, `/asset-studio` variants tab, `/budget/page.tsx`, `/campaigns/page.tsx`.

**Est. 1 day.**

### 3.5 Add KebabMenu to all list items

**Files:** `components/products/*`, `components/product-requests/*`, `components/campaigns/*`, `components/inventory/*`, `components/wardrobe/*`.

Each card gains a KebabMenu with contextual actions. Right-click on card body also opens.

**Est. 1 day.**

### 3.6 Inline KPI strip in page headers

Add `<PageHeaderKPIs counts={[...]} />` slot below `<PageHeader>` on Dashboard, Campaigns, PRs, Asset Studio, Budget. 3–5 live counts each.

**Est. 0.5 day.**

### 3.7 Split overloaded pages

**Wardrobe:** split into `/wardrobe/inventory` (Items + Backstock + Job Classes tab) and `/wardrobe/reservations` (Reservations tab, campaign-linked).

**Gear:** keep `/gear` but split internally into Inventory / Reservations / Maintenance / Kits secondary tabs backed by `?tab=` param. Fix `/gear/products` link from `/gear` (surface in secondary nav).

**Campaign detail:** extract modal state into `useCampaignDetailModals` hook; keep pages, reduce cognitive load.

**Asset Studio Templates Edit (2,587 LOC):** split the page into Editor (canvas), Settings (output specs), Preview (render queue) — separate files under `asset-studio/templates/[id]/(parts)`.

**Est. 2 days.** *Highest risk — schedule with care.*

### 3.8 Ship Cmd-K command palette

**File:** new `components/layout/command-palette.tsx` + integration into `AppShell`.

- Indexes static nav, recent entities (from `recent-documents` API), pinned items
- Fuzzy search with `fuse.js` or `cmdk`
- Global shortcut `⌘K` / `Ctrl+K`

**Est. 1.5 days.**

### 3.9 Mobile-primary flags for specific pages

- `/gear/scan`, `/wardrobe/checkout` flow, `/campaigns/[id]/pre-production` runsheet → mobile-first QA
- Sticky bottom CTA bar on these pages
- Offline tolerance (queue actions, sync on reconnect) — if feasible in scope; else backlog

**Est. 1 day.**

### 3.10 Remove redirect-only pages

- Delete `/app/(portal)/pre-production/page.tsx`
- Delete `/app/(portal)/campaigns/[id]/shots/page.tsx`

**Est. 30 min.**

### 3.11 Undo on destructive actions

Toast primitive gains an `action` slot. `deleteX()` utilities surface a 5-second Undo toast.

**Files:** any delete/flag/archive call sites.

**Est. 1 day.**

### 3.12 Vendor shell

**File:** new `app/(vendor)/layout.tsx` group.

- No sidebar; top bar only (logo + user menu)
- Three tabs: Submit Estimate / Upload Invoice / My Status
- Route `vendor` role to this shell; `Producer`+ roles stay in portal shell.

**Est. 1 day.**

### Phase 3 exit criteria

- ✅ Sidebar is 5 groups; 14–16 items; no duplicates
- ✅ Dashboard is a work queue per role (visual regression test)
- ✅ Cmd-K opens with `⌘K` and finds campaigns/PRs/pages
- ✅ Wardrobe split; Asset Studio Templates split; Campaign Detail decluttered
- ✅ Vendor sees vendor shell
- ✅ Click-path tests: Flag product ≤ 2 clicks; Producer sees budget ≤ 2 clicks

---

## PHASE 4 — Polish & governance (est. 2–3 days)

### 4.1 Print-quality document pages

`(docs)/invoices/[id]`, `(docs)/estimates/[id]`, `(docs)/po/[id]`: audit against standards §18. US Letter, 1" margins, Inter 11pt, black/white, logo the only color.

**Est. 0.5 day.**

### 4.2 Production auth UI

Replace dev-auth styling on `/login` with production SSO UI. Drop `bg-white/10` overlay pattern.

**Est. 0.5 day.**

### 4.3 Empty states unified

Every list uses `<EmptyState>`. Every empty state has a CTA.

**Est. 0.5 day.**

### 4.4 `prefers-reduced-motion`

Add global `@media (prefers-reduced-motion: reduce)` block in `primitives.css` that disables slide/scale animations; keeps fade.

**Est. 1 h.**

### 4.5 Visual regression tests

Add Playwright snapshots of 10 key pages + top 5 modals. Gate CI on diff.

**Est. 1 day.**

### 4.6 Publish `docs/design/GLOSSARY.md` and `docs/design/LIST_VIEWS.md`

Glossary: Product, Product Request, Item, Campaign, Shoot, Setup, Variant, Render, Flag — precise definitions.

List views: per page, primary sort axis + allowed filters (from IA Council).

**Est. 0.5 day.**

### 4.7 Design-system demo page

`/laurai/design-system` renders every primitive + overlay + status pill + role badge + page header pattern. Becomes the QA surface.

**Est. 0.5 day.**

### Phase 4 exit criteria

- ✅ Print pages look like documents
- ✅ Login page looks production-grade
- ✅ CI fails on visual regression
- ✅ Glossary and list-view registry published

---

## Estimated total

| Phase | Focused days |
|---|---|
| 1 — Foundations | 3–4 |
| 2 — Systemic UI | 5–6 |
| 3 — IA & Flow | 5–6 |
| 4 — Polish & governance | 2–3 |
| **Total** | **15–19 days** |

Parallelizable. With the existing team (Laura + Gretchen + eng support), a realistic calendar is 4–5 weeks of steady work, or 2–3 weeks full-time.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| StatusPill migration breaks some pills visually during transition | Ship StatusPill behind a feature flag; migrate page-by-page; compare visually before flipping default |
| Sidebar restructure confuses existing users | Ship with a one-time "What's new" toast pointing at the 5 groups; keep old routes active via redirects for 2 weeks |
| Splitting Wardrobe breaks bookmarks | Add redirects from `/wardrobe?tab=reservations` → `/wardrobe/reservations` |
| ESLint rules generate noise in legacy code | Warning level during Phase 2; error level after Phase 2; `// eslint-disable-next-line` allowed only with comment explaining why |
| Dashboard redesign is visible to leadership | Ship behind role flag; test with Laura first, then enable for all Producers, then full org |
| Cmd-K adds bundle size | Use `cmdk` (tiny); lazy-load the palette on first keypress |

---

## The one-page summary

**Today:** Strong tokens, drifting application. 5.5/10.

**Goal:** Pristine editorial-grade. 9/10.

**Path:** Fix the vocabulary (Phase 1) → make every page speak it (Phase 2) → rearrange the building (Phase 3) → polish the doors (Phase 4).

**Guardrails:** ESLint rules, shared components, design-system demo page, quarterly re-audit.

**Delivery:** Four phases, fifteen to nineteen focused days, no interleaving, no regressions on pages already touched.

*"Make it look like one person designed it on one good day." — closing line, Expert Council 1, Round 3.*
