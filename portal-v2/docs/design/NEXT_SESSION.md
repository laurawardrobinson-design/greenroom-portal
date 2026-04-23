# Next-session kickoff

*Read this first. Short, actionable, gets you from zero to shipping in 5 minutes.*

---

## Where we are

Three design commits landed: `47d0631` → `e7167f4` → `0824e4b`.

- **Design system scores** (0-10): tokens 9 / pills 9 / status colors 9 / role colors 9 / typography 7 / spacing 6 / IA 5 / click economy 6 / editorial polish 8. **Overall ~6.5** (started at 5.5; target 9).
- **What's in the app now:**
  - `StatusPill`, `RoleBadge`, `BudgetDot`, `KebabMenu` primitives — all shipped, all token-driven ([status-pill.tsx](../../components/ui/status-pill.tsx), [role-badge.tsx](../../components/ui/role-badge.tsx), [budget-dot.tsx](../../components/ui/budget-dot.tsx), [kebab-menu.tsx](../../components/ui/kebab-menu.tsx)).
  - Tokens in [globals.css](../../app/globals.css): spacing / radius / z-index / status tints / role tints — all live, driving real components.
  - `Badge` and `Toast` use tokens internally (call sites didn't need to change).
  - `lib/constants/statuses.ts` exports `campaignStatusVariant/Style`, `vendorStatusVariant/Style` helpers.
  - `pr-status-pill`, `approval-state-pill` wrap shared StatusPill.
  - `/product-requests` has persona-aware default filter + live count pills + StatusPill everywhere.
  - `/pre-production` is a direct-redirect hub (last-visited campaign via localStorage).
  - 80+ files had raw `text-{emerald,red,rose,amber,orange}-{600..900}` swept to semantic `text-{success,error,warning}`.

---

## The one recommended next chunk

**Ship: sidebar restructure + user menu.** ~3-4 hours. One-session scope. Hits every page simultaneously and sets up the future dashboard/Cmd-K work.

### Why this first

- Visible everywhere on day one.
- Clears out redundant items (Settings, Goals, duplicate Estimates & Invoices, hardcoded `/brand-marketing/review/Bakery`, redirect-only `/pre-production` already redirects OK via localStorage — safe to leave in nav or move to campaign-scope).
- Unblocks the dashboard redesign: a proper user menu is the place Settings/Goals/Sign-out live, so Dashboard can focus on work-queue content.
- Low-risk: mostly moves/renames; no data-layer changes.

### Concrete tasks

1. Refactor [components/layout/sidebar.tsx](../../components/layout/sidebar.tsx):
   - Group items into 5 zones (WORK / CREATE / RESOURCES / PEOPLE / FINANCE) per [DESIGN_STANDARDS.md §11.1](./DESIGN_STANDARDS.md).
   - Remove: Settings, Goals, duplicate Estimates & Invoices entry, Pre-Production sidebar item (keep via Campaign detail), Shot List shortcut (already redirects).
   - Fix `/brand-marketing/review/Bakery` → `/brand-marketing/review` and render a department picker inside that page.
2. Build `components/layout/user-menu.tsx`:
   - Avatar + name top-right of `AppShell`.
   - Dropdown items: Profile, Settings, Goals, Help, Sign out.
3. Wire the user menu into `AppShell` and remove the sidebar items it replaces.
4. Verify in browser on 3 roles (Producer, Admin, Vendor). Vendor should see a stripped nav (per DESIGN_STANDARDS.md §12 "Vendor landing") — note: full vendor shell is a separate phase 3.12 task; for this session just hide the groups they don't need.

### First commands

```bash
# orient
git log --oneline -5
open portal-v2/docs/design/DESIGN_STANDARDS.md    # §11 Navigation

# read before editing
portal-v2/components/layout/sidebar.tsx
portal-v2/components/layout/app-shell.tsx
portal-v2/hooks/use-current-user.ts   # role filtering reference
```

---

## Alternatives (if you want a different flavor)

Any of these is also one-session scope.

### A. Dashboard work-queue redesign (Producer first)
~3-4 hours. Replace empty dashboard with the pattern Laura demanded in User Council 1: L3 count strip + L1 "Ship this week" + L2 tiles. Start with Producer dashboard; clone for other roles later. Depends on nothing.

### B. Split `/wardrobe` (2,100 LOC → 2 pages)
~3-4 hours. Split into `/wardrobe/inventory` (Items + Backstock + Job Classes tab) and `/wardrobe/reservations`. Mechanical but touches the biggest single page in the app. Add 301 redirects from `?tab=` query params.

### C. Cmd-K palette
~3-4 hours. Install `cmdk`, build `components/layout/command-palette.tsx`, index static nav + recent entities. Pure addition, no regression risk.

### D. Unify `SearchInput` + `ViewToggle` primitives
~2 hours. Mechanical. Extract the two patterns from campaigns/products/vendors/contacts. Hits 5+ pages with one change.

### E. KebabMenu roll-out
~2-3 hours. Wire `KebabMenu` into product/PR/campaign/contact cards with actions (Open / Flag / Archive / Duplicate / Copy link). The primitive exists; just apply it.

### F. Phase 1 foundation cleanup
~2 hours. Split globals.css into 4 files (tokens / primitives / ui / creatures). Add ESLint rules (banned patterns). Add Tailwind config extends for autocomplete.

---

## Open questions (answer before picking a path)

1. **Which dashboard role should we redesign first?** Council said Producer. Confirm or override.
2. **Vendor shell scope:** in-session strip-down nav vs. full separate `(vendor)/layout.tsx` group? The full shell is larger.
3. **Cmd-K lib:** OK to add `cmdk` dep (tiny, ~3KB)?
4. **Pre-existing unrelated errors:** `pr-doc-drawer.tsx` has `DeptSection` / `Input` / `rowDrafts` ReferenceErrors in browser console since the session start — **these are pre-existing, not from design work**. They surface in stale HMR chunks. Likely from in-progress work before the design session. Worth a separate track; not a design-session blocker.

---

## Things to NOT touch this session

- The `pre-production/page.tsx` hub — already works, callers depend on the localStorage contract.
- `statuses.ts` helper names (`campaignStatusVariant`, `vendorStatusStyle`, etc.) — 10+ files import them.
- `StatusPill` variant names — locked in as public API.
- Pre-existing files from before this session: wardrobe, asset-studio, budget internals, brand-marketing rails, product-drawer, etc. Those had uncommitted work at session start and shouldn't be stealth-refactored.

---

## Verification checklist per session

Before committing:

- [ ] Run on preview server (it's always running at port 3000).
- [ ] Navigate 3+ representative pages: `/campaigns`, `/product-requests`, `/goals`, one of `/budget` or `/settings`.
- [ ] Check console for errors (ignore pre-existing `DeptSection`/`Input`/`rowDrafts` from `pr-doc-drawer.tsx`).
- [ ] Role-test: switch to Admin, then to Vendor if nav changed.
- [ ] Spot-check: one modal, one drawer, one StatusPill, one RoleBadge — do they look identical on all pages?
- [ ] If touching colors: no new `bg-{amber,emerald,red,rose,blue,orange}-*`, no new `text-{amber,emerald,red,rose}-{600..900}`. Use tokens.

---

## Token cheat sheet (fast reference)

```
Status variants:   draft | submitted | pending | approved | rejected | info
                   → <StatusPill variant="..."> renders a tinted pill with border
                   → var(--status-{variant}-{fg|tint|border}) for inline styles

Semantic tokens:   text-success | text-warning | text-error | text-info
                   bg-primary | bg-primary-light | bg-surface | bg-surface-secondary
                   border-border | border-border-light

Roles:             <RoleBadge role="Producer" /> — auto-pulls role-*-fg/tint

Budget:            <BudgetDot percent={spendPct} /> — green/amber/red thresholds

Actions menu:      <KebabMenu items={[{label,onClick,icon,variant}]} />

Spacing scale:     --space-1..12  (4 / 8 / 12 / 16 / 20 / 24 / 32 / 48)
Radius scale:      --radius-sm / -md / -lg / -full
Z-index:           --z-sticky / -overlay / -modal / -popover / -tooltip / -toast / -lightbox
```

See full contract: [DESIGN_STANDARDS.md](./DESIGN_STANDARDS.md).

---

## If you finish early

- Knock out Phase 2.7 (fix focus-state stacking; ~30 min grep + edit).
- Knock out Phase 2.8/2.9 (kill `space-y-5/7`, `p-5`, `py-3.5` drift; 30 min perl pass).
- Add `prefers-reduced-motion` block to globals.css (5 min, Phase 4.4).
- Remove `bg-{color}-50` decorative drift in 3–5 high-traffic files (use tokens or the new primitives).

Each of these is < 1 hour and moves the needle on the health score.
