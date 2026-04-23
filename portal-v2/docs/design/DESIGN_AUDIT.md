# Portal V2 — Deep Design Audit

*Date: 2026-04-23. Method: full-app reconnaissance (38 pages, 25+ overlays, full CSS token pass) followed by six councils (3 expert + 3 user), three deliberation rounds each.*

---

## 0. Executive Verdict

Portal V2 has **strong bones and inconsistent skin.** The token system (Inter-only, Greenroom forest+sage palette, density variables, shadow scale, creature-animation Easter eggs) is better than 90% of internal tools. But *components don't use the tokens they were built for.* Hardcoded Tailwind colors, ad-hoc paddings, and three different implementations of the same filter bar have caused drift.

**Health snapshot (0–10):**

| Dimension | Score | Note |
|---|---|---|
| Token system (on paper) | 8 | Density vars, shadows, Inter enforced, status colors defined |
| Token system (as applied) | 5 | Components bypass tokens with hardcoded Tailwind |
| Typography cohesion | 6 | Inter-only is enforced; size scale has gaps (no 16px) |
| Color cohesion | 5 | Badge/Toast/PR status use raw Tailwind (amber-50/emerald-50/…) |
| Spacing rhythm | 5 | `space-y-5` vs `space-y-6` drift; density vars unused |
| Overlay discipline | 4 | Z-index chaos, five different backdrop opacities, drawer-named-modal |
| Click economy | 5 | Flag product = 4 clicks; Producer → campaign budget = 4 clicks |
| Information architecture | 5 | Wardrobe = 2,100 LOC + 4 tabs in one page; 2 duplicate sidebar items |
| Editorial polish | 7 | Design is already above enterprise baseline; a few rough rooms |
| **Overall** | **5.5** | *Pristine is a 9. We have real work.* |

---

## 1. Full Inventory

### 1.1 Pages (38)

**Core nav:** `/dashboard`, `/calendar`, `/campaigns`, `/campaigns/new`, `/campaigns/[id]`, `/campaigns/[id]/brief`, `/campaigns/[id]/edit`, `/campaigns/[id]/pre-production`, `/campaigns/[id]/shots` (redirect), `/campaigns/[id]/asset-studio`

**Asset Studio:** `/asset-studio` (7 tabs), `/asset-studio/templates/[id]/edit` (2,587 LOC), `/asset-studio/runs/new`, `/asset-studio/runs/[id]`

**Work management:** `/product-requests`, `/product-requests/new`, `/product-requests/[id]`, `/product-requests/calendar`, `/pre-production` (redirect), `/post-workflow`, `/vendor-workflow`

**Inventory:** `/products`, `/products/flags`, `/gear`, `/gear/products`, `/gear/scan`, `/gear/print`, `/wardrobe` (2,100 LOC), `/props`, `/studio`, `/vendors`

**People & money:** `/contacts`, `/goals`, `/budget`, `/estimates-invoices`

**Brand marketing:** `/brand-marketing`, `/brand-marketing/review/[dept]`

**Settings & auxiliary:** `/settings`, `/login`, `/invoices/[id]`, `/estimates/[id]`, `/po/[id]`, `/rbu/...`, `/laurai`

### 1.2 Overlays (25+)

**Base primitives:** `Modal` (6 sizes, Esc/X/backdrop close, focus trap, mobile sheet), `Drawer` (right-slide desktop, bottom-sheet mobile), `ConfirmDialog`.

**Feature overlays:** `NewCampaignModal`, `ShootDayModal`, `ShotListModal` (custom overlay, bypasses Modal), `ShotDetailModal`, `AddSetupDrawer` (named drawer, uses Modal), `ProductDrawer` (large, custom, z-stacking issues), `GearDetailModal`, `ReserveGearModal`, `AddGearModal`, `LogMaintenanceModal`, `SendPoModal` (custom overlay, no Esc), `PdfPreviewModal` (inline iframe styles), `ReserveRoomModal`, `MealFormModal`, `SpacePickerModal`, `AddPropModal`, `PropDetailModal`, `RaiseFlagDialog`, `FlagReviewModal`, `Toast`.

### 1.3 Tokens (as defined)

Colors: sidebar trio, primary trio, 3 surface, 2 border, 4 text, 4 status, plus 20+ Asset-Studio-scoped. Typography: Inter-only, `--text-xs` (13.33px), 14px body floor, responsive page-title clamp. Spacing: full density system (comfortable + compact) covering controls/cards/buttons/modals/drawers/tabs/subnav/schedule/shotlist. Shadows: xs / sm / md / lg, soft-editorial. Motion: fast/normal/slow + snappy ease. Z-index: *only three values in use* (z-10, z-50, z-[100]).

---

## 2. Inconsistencies Catalogued

### 2.1 Color drift

- **Product request status** (`/product-requests/page.tsx:139-150`) — hardcoded `bg-amber-50 text-amber-800`, `bg-emerald-50 text-emerald-800`, `bg-blue-50 text-blue-800`. Should use status tokens.
- **Role badges repeated 3×** — same purple/blue/teal/amber palette in `goals/page.tsx:65-69`, `contacts/page.tsx:52-56`, `settings/page.tsx:41-46`. No central map.
- **Badge component** — `bg-slate-100`, `bg-emerald-50`, `bg-red-50`, `bg-amber-50` hardcoded; bypasses `--color-*` tokens.
- **Toast component** — `emerald-200/800`, `red-200/800`, `blue-200/800`, `amber-200/800` hardcoded.
- **Login page** — `bg-white/10 border-white/20 text-white` for dev-auth; not design-system.
- **Asset Studio status tokens exist** (`--as-status-approved`, `--as-status-rejected`) but aren't used outside the AS module.

### 2.2 Typography drift

- **No 16px step** — jump is 14 → 18, forcing `text-[13px]`, `text-[15px]` workarounds.
- **Page titles** — some pages use `text-2xl font-bold` inline (campaigns, calendar, contacts), others delegate to `PageHeader` (budget, products). Not every page uses PageHeader.
- **Tile headers** — CLAUDE.md prescribes `text-sm font-semibold uppercase tracking-wider` with icon + `border-b`. Spot checks show this drifts on campaign-detail tiles, some use `text-base`, some omit the icon, some have a thicker bottom border.
- **Modal header typography ranges `text-sm` → `text-lg`** across SendPoModal / ShotListModal / Modal base / ProductDrawer.

### 2.3 Spacing drift

- **Top-level vertical stacking:** `space-y-5` (campaigns, asset-studio, vendors) vs `space-y-6` (contacts, budget, calendar). Pick one.
- **Filter row gaps:** `gap-3` (campaigns, contacts), `gap-2` (products), ad-hoc on others.
- **Card padding:** `p-4`, `p-5`, `p-6` hardcoded throughout inventory/product modals. Density vars `--density-card-p-*` largely ignored.
- **Form stack:** density vars define 6px comfortable / 4px compact — but most forms use `gap-4` / `space-y-4` inline.

### 2.4 Overlay drift

- **Backdrop opacity:** 40 / 50 / 60 / 80 across modals. Blur: 2px vs `sm`.
- **Close affordances:** Modal/Drawer have Esc+X+click-outside; ProductDrawer has only X; SendPoModal has no Esc; GearDetailModal's X floats absolute-top-right-outside-form.
- **Z-index within modals:** NewCampaignModal crew picker `z-10`, ShootDayModal `z-20`, ProductDrawer dropdowns `z-50` (same as modal container — collision risk), Lightbox `z-[60]`.
- **Header styling:** `text-sm`/`text-base`/`text-lg`, with or without icon, with or without subtitle.
- **Corner radius:** Modal `rounded-xl`, Drawer default (no top radius on desktop), mobile sheet `rounded-t-2xl`, various cards `rounded-lg`.
- **Shadow:** `shadow-lg` / `shadow-xl` / `shadow-2xl` / none across overlays.

### 2.5 Interaction drift

- **Search input** — three different treatments (`shadow-xs + rounded-xl`, `rounded-lg`, default) across campaigns/vendors/contacts.
- **View toggle grid/list** — three different implementations across campaigns, contacts, products.
- **Tab routing** — Asset Studio uses URL `?tab=`, others use local state or different URL schemes.
- **Focus state** — `focus:border-primary` in some inputs, global `:focus-visible` outline in others, double-ring in a few (already called out in your `feedback_focus_rings`).

### 2.6 Motion drift

- Creature library is 200+ lines of CSS for Easter eggs (delightful, but separate concern).
- No `@media (prefers-reduced-motion: reduce)` anywhere.
- Some transitions use `var(--duration-fast)`, others hardcode `duration-200` or `duration-300`.

### 2.7 Structural issues

- **Wardrobe** — 2,100 LOC, 4 tabs (Job Classes / Items / Backstock / Reservations). Four separate jobs in one page.
- **Asset Studio Templates Edit** — 2,587 LOC, 5+ nested modals.
- **Campaign detail** — 8+ independent modal `useState` toggles; no shared modal stack.
- **Gear** — inventory + maintenance + reservations + kits in one 1,244-LOC page.

### 2.8 Click-path pathologies

| Job | Current | Ideal |
|---|---|---|
| Flag a product | 4 clicks (Sidebar → Products → search → open drawer → Raise flag → reason → submit) | 2 (contextual menu on card → flag modal) |
| View campaign budget as Producer | 4 (Campaigns → card → detail → scroll to Budget section) | 2 (Budget chip in header, or "My campaigns with budget alerts" on dashboard) |
| Check wardrobe for shoot | 4 (Sidebar → Wardrobe → Reservations tab → filter/find) | 2 (from campaign detail: "Check wardrobe" → pre-filtered list) |
| Find talent contact | 4 (Sidebar → Contacts → Vendors tab → search → open) | 2 (unified search with role filter) |
| Approve asset variant | 4 (Sidebar → Asset Studio → Variants tab → card → Approve) | 2 (Dashboard inbox: "Awaiting approval" chip) |
| Approve incoming PR | 2 (list → drawer → submit) but no status filter — can be 4 if list is long | 2 (with "Awaiting your approval" default filter) |

---

## 3. Expert Council 1 — Editorial Design

*Members: **Massimo Vignelli** (grid, typography), **Dieter Rams** (less is more), **Paula Scher** (editorial systems), **Jony Ive** (cohesion, material honesty), **Chip Kidd** (typographic hierarchy)*

### Round 1 — Opening remarks

**Vignelli.** A design system is not a palette, it is a *grid and a typographic plan*. You have a typographic plan — Inter only, good — but the grid is invisible. `space-y-5` versus `space-y-6` is a grid sitting on the floor instead of on a module. Pick one baseline: 4px, 8px, 16px, 24px, 32px, 48px. *Everything else is wrong.*

**Rams.** Too much Easter-egg. 200 lines of raccoon and peacock keyframes in globals.css is charming on day one and noise on day two. Keep them — but put them in `creatures.css`. The design-system file should read like a contract, not a screenplay.

**Scher.** Editorial-grade means the user feels the intelligence of the page without needing to read it. Right now your product-request page shouts amber/emerald/blue without earning it. A status color should feel *authored*, not Tailwind-default. Darken them, give them serious ink weight.

**Ive.** The material is inconsistent. A tile on /campaigns has one header, on /contacts another, on /budget a third. The user doesn't know it but they *feel* it. Everything must feel cut from the same stone.

**Kidd.** Your headline hierarchy is thin. Page title 24–28px, tile header 14px uppercase — and then a giant empty zone where H2s should live. You need a *secondary title* level (16–18px, semibold, sentence case, no tracking) for sections inside a tile.

### Round 2 — Pushback & probe

**Scher (on Vignelli).** 8px is fine but I disagree with rigid. Editorial pages breathe. Use 4px for dense data, 8px for UI, 16px for prose, 24px/32px/48px for section breaks. *Ratios, not a single number.*

**Rams (on Kidd).** If we add an H2 level, we'll see it used on every label. I'd constrain it: H2 only appears when a tile is large enough to warrant internal subdivision. Most tiles won't need one.

**Ive (on the overlay chaos).** The backdrop opacity variance (40 / 50 / 60 / 80) is unacceptable. That's not a system. Pick 50, blur 2px, done. The shadow variance same. Modals = `shadow-lg`. No exceptions.

**Vignelli (on color).** The sage `#69A925` is beautiful but desaturate your *status* colors. `#d97706` warning orange is fine; the `bg-amber-50` background is a toy. Make the status pills use a single treatment: foreground-color ink on a 4% tint, with a 1px 12%-opacity border. Consistent, quiet, legible.

**Kidd (on click economy).** The editorial prescription and the UX prescription converge: *minimize field-of-view.* Every time a user's eye leaves what they're doing, you've lost them. Status filter defaulted to "Awaiting you" means they never see the grid of unrelated items — the page opens already reading their mind.

### Round 3 — Converged recommendations

1. **Baseline 4/8/16/24/32/48 spacing scale.** Codify in tokens: `--space-1` (4) through `--space-12` (48). Deprecate all `space-y-5`, `space-y-7` drift.
2. **Split globals.css into 4 files.** `tokens.css` (tokens only, 120 lines max), `primitives.css` (focus, scrollbar, selection, base type), `ui.css` (`.ui-page-header`, `.ui-tab`, etc.), `creatures.css` (Mutant Menagerie). Imported in order.
3. **Typographic hierarchy, final:** Display 32 / Page 24 / Section 18 semibold sentence-case / Tile header 14 uppercase tracking-wider / Body 14 / Small 13.33 / Caption 12 (min). *That's the only scale.*
4. **Status pills unified:** `bg-{color}/8 text-{color}-700 border border-{color}/20 rounded-full px-2.5 py-0.5 text-xs font-medium`. One component, `<StatusPill>`, with `variant: draft|submitted|approved|rejected|warning|error|info`.
5. **Overlay contract:** backdrop `bg-black/50 backdrop-blur-[2px]`, panel `shadow-lg rounded-xl`, header `text-lg font-semibold` + Esc + X + click-outside + focus trap. Mandatory.
6. **Editorial restraint:** kill `rounded-2xl`, `shadow-2xl`, `border-2` unless authored for one specific artifact. The app has one radius scale (4/8/12), one shadow scale (xs/sm/md/lg), one border width (1px).

---

## 4. Expert Council 2 — UX & Click Economy

*Members: **Don Norman** (affordances), **Steve Krug** ("don't make me think"), **Jakob Nielsen** (10 heuristics), **Luke Wroblewski** (mobile-first, one-thumb), **Edward Tufte** (data density, small multiples)*

### Round 1 — Opening remarks

**Krug.** The sidebar has 19 items. That's two too many. "Estimates & Invoices" appears twice. "Settings" is a user-menu job, not a top-level nav job. "Pre-Production" is a redirect — either a real page or not in the sidebar. Cut to 16.

**Norman.** The product flag affordance is invisible. A producer who wants to flag a bad product sees no signifier on the product card that flagging is possible. They have to *know*. That's the opposite of affordance — that's folklore.

**Nielsen.** Heuristic #1 — visibility of system status. Your PR list shows status pills *per row*, good. But the list doesn't show me *how many are awaiting me*. Put counts in the tab/filter pills. Every list view needs ambient counts.

**Wroblewski.** I pulled up /wardrobe on a simulated tablet. Four tabs, 2,100 lines, horizontal scroll required. No. This page is three pages pretending to be one.

**Tufte.** The Dashboard I looked at is almost content-free. Role-based routing is right, but the landing page for a Producer should be a *small-multiples* view: 6 campaigns × 4 status dimensions = 24 tiles, instantly scannable. Right now it's either empty or a single hero tile.

### Round 2 — Pushback & probe

**Norman (on Krug).** 16 items still too many for unaided recall. Group them: **WORK** (Dashboard, Campaigns, Product Requests, Shot List), **CREATE** (Asset Studio, Pre-Production, Post-Workflow), **RESOURCES** (Products, Gear, Wardrobe, Props, Studio), **PEOPLE** (Contacts, Goals), **FINANCE** (Budget, Estimates & Invoices). Five groups with dividers. *Miller's Law* — 5–7 groups of 2–3 items each.

**Nielsen (on the flag path).** Four clicks is not the real cost. The real cost is the *cognitive context-switch* of leaving the page they were on. The fix isn't "fewer clicks," it's "contextual action where you already are." A kebab menu on each product card with Flag / Move to campaign / Archive. Same clicks arguably, but zero context loss.

**Wroblewski (on overlay use).** Everything is a modal. Modals should be rare and terminal — confirmations, final decisions. Editing a shot, reserving gear, approving a variant — those are *flows*, not confirmations. Right drawer, not modal. Use the Drawer component, stop aliasing modals as drawers.

**Tufte (on dashboards).** Every page top should carry 3–5 ambient KPIs inline in the header: "12 PRs awaiting / 3 budgets at risk / 4 shoots this week." Not tiles in a dashboard — *inline microcopy in the page title row.* Sparkline where warranted.

**Krug (on the gotchas).** Two issues I'll flag: `/brand-marketing/review/Bakery` hardcoded — breaks for every non-Bakery BMM. `/pre-production` is a router-only page — flash and redirect is confusing. Fix or remove.

### Round 3 — Converged recommendations

1. **Sidebar grouped to 5 zones** (WORK / CREATE / RESOURCES / PEOPLE / FINANCE). Settings → user menu. Pre-Production → only under Campaign detail. Brand Marketing Review → `/brand-marketing/review` with dept picker on the page.
2. **Contextual kebab menus** on every list item (product, PR, gear, variant). Flag / Archive / Duplicate / Move. 2 clicks to any action. No more "drill in to drill out."
3. **Default filter smart by role.** PR list for Producer defaults to "Awaiting my approval." Variants tab for Art Director defaults to "Pending review." Budget tab for Admin defaults to "Needs decision." Count badges on every filter.
4. **Drawer for editing, Modal for confirming.** Codify: if the overlay contains more than a title + ≤2 fields + 2 buttons, it's a Drawer. Rename `AddSetupDrawer` to honest `AddSetupModal`.
5. **Inline KPIs in page-header subtitle row.** Producer dashboard title area shows live counts. Same pattern on /campaigns, /product-requests, /asset-studio. Three-to-five data points max.
6. **Split Wardrobe into `/wardrobe/inventory` and `/wardrobe/reservations`.** Same for Gear (consider `/gear/inventory` + `/gear/reservations` + `/gear/maintenance` under one sidebar item with a secondary tab).
7. **Remove redirect-only pages from sidebar** — `/pre-production`, duplicate Estimates & Invoices, `/campaigns/[id]/shots` (Art-Director-only shortcut can live under Campaigns).

---

## 5. Expert Council 3 — Information Architecture & Data Visualization

*Members: **Richard Saul Wurman** (LATCH), **Abby Covert** (Sensemaking), **Karen McGrane** (content strategy), **Alan Cooper** (personas, goal-directed), **Peter Morville** (findability)*

### Round 1 — Opening remarks

**Wurman.** Organization is the whole game. LATCH: Location / Alphabet / Time / Category / Hierarchy. Your PR list is grouped by shoot date — Time. Good. Your Products list is alphabetical-ish — weak, since SKU and name both matter. Your Contacts is grouped by Team/Vendor — Category. Your Campaigns list mixes time and status — hybrid, and it confuses. Pick one primary axis per view; offer others as filters.

**Covert.** Nouns are unclear. "Product Request" vs "Product" vs "Item" vs "Campaign Product" — a newcomer needs a glossary. Name things precisely. "Product" = inventory item. "Product Request" = a doc requesting items for a shoot. Don't use the same word for both across pages.

**McGrane.** Mobile-parity is missing. Your Modal mobile-sheets out, Drawer mobile-sheets out — but the pages themselves were designed desktop-first with four-tab layouts that break. Consider: which pages are ever used on tablet in the field? /gear/scan, /wardrobe checkout, /campaigns/[id]/shots. Those should be mobile-first. Others desktop-primary.

**Cooper.** Personas. Laura is a Producer — she is *the primary persona*. Her goal: "Ship this shoot clean." Every screen should serve that goal first. A Vendor is a *secondary persona* — they need exactly 3 things (submit estimate, upload invoice, see status). Giving them the same nav as a Producer is a cruelty.

**Morville.** Search is undersold. Global command palette (Cmd-K) does not exist. On an app with 38 pages + thousands of products + thousands of PRs + hundreds of campaigns, navigation should be index-backed. Building a palette is a weekend and it changes the app's character.

### Round 2 — Pushback & probe

**Wurman (on Cooper).** Role-aware defaults are right, but role-aware *navigation* has failure modes. A new hire doesn't yet know what role maps to what. Add a "Switch role" in dev; make sure a Producer can see what an Art Director sees when asked.

**Covert (on glossary).** Publish a one-page glossary in docs. Make the UI respect it. Don't call it "Item" one place and "Product" another.

**Cooper (on overload pages).** Wardrobe at 2,100 LOC is a tell. That's not a design problem, it's an IA problem. The page is holding four different mental models. Four mental models = four pages. Or one page with a truly dominant primary and three drawer-accessed secondaries.

**McGrane (on content length).** Tile headers are uppercase, excellent. But *tile content* has no rules. Some tiles show 2 lines, some 12. Define: Level 1 tile (hero, 4–8 data points), Level 2 tile (summary, 2–4 data points), Level 3 tile (meta, 1 data point). Pages should show a deliberate mix.

**Morville (on findability).** Dead pages — `/pre-production`, `/campaigns/[id]/shots`, `/laurai`. Kill or index. A redirect-only route is a findability lie.

### Round 3 — Converged recommendations

1. **LATCH per page.** Document each list page's primary sort axis. Offer 2 secondary filters max. Publish in `/docs/design/LIST_VIEWS.md`.
2. **Glossary in docs/design/GLOSSARY.md.** One word = one meaning. App copy enforced in code review.
3. **Command palette (Cmd-K).** Fuzzy-search pages, recent docs, pinned items. Ship before Q3.
4. **Persona-first landing pages.** Producer dashboard is a *work queue*, not a hero image. Vendor's first screen is three cards: "Submit estimate / Upload invoice / Your status." Art Director lands on pending variants.
5. **Kill redirect-only pages.** `/pre-production` becomes either a real hub or removed. `/campaigns/[id]/shots` becomes real or removed.
6. **Mobile-primary flags on specific pages.** Flag `/gear/scan`, `/wardrobe` (checkout flow), `/campaigns/[id]/pre-production` (shoot-day runsheet) as mobile-tested. Non-flagged pages are desktop-primary.

---

## 6. User Council 1 — Laura (Producer)

*Simulated based on user memory: Producer at Fortune 100 grocery; reports to Gretchen (HOP/Admin); not a developer; values plain language; design must impress the creative team; WF numbers format "WF######" no dash.*

### Round 1 — What's in her way on a typical Tuesday

*Laura narrating:* "Tuesday I wake up and the thing I need is: **what's breaking this week?** I don't want to scroll. I want Dashboard to tell me: *three PRs are waiting on me, one campaign is over budget, there's a shoot Thursday and wardrobe isn't confirmed*. Right now Dashboard is a polite empty page. I end up opening four tabs."

"When I click into Campaigns, I find the campaign I'm running, and then I have to open the detail page to see budget. Why? I already know the campaign name. Show me the money next to the name."

"When a brand marketing manager sends me a new product request, I have to hunt for it in the list. Amber / green / blue pills are cute but I can't read them fast. The ones waiting for me should be on top, full stop."

"The flag-a-product flow… four clicks for something I do five times a day? No. That's a right-click affair."

### Round 2 — On beauty and the creative team

*Laura:* "The creative team opens this app in front of clients sometimes. If it looks enterprise, I get grief. I want them to see something that feels like a well-lit studio. Forest green sidebar is correct. The login page's white-on-transparent buttons look like a SaaS from 2019 — fix that."

"Fonts: Inter everywhere, please. I caught monospace on a PO number once. That's the 'weird font' and it makes the whole app look cheap."

"Spacing: stop making me scroll to find the same kind of button on different pages. The New Campaign button is at the top-right on one page and top-left on another."

### Round 3 — What she would demand if she could

1. **Dashboard = work queue.** Numbered cards: "3 PRs awaiting approval," "1 campaign over budget," "2 shoots this week needing wardrobe." Each card links directly.
2. **Campaign list shows budget state inline.** Green dot / amber / red next to each campaign name; hover = amount.
3. **PR list defaults to "Awaiting me" + chronological.** Filter pill shows count.
4. **Right-click on any card for actions.** Flag / Archive / Duplicate / Open in new tab. No more drill-in-drill-out.
5. **"Ship this shoot" view on campaign detail.** One panel: wardrobe ✓, gear ✓, PR ✓, budget ✓, crew ✓. Red dot on anything not ready. Click to resolve.
6. **No monospace. Anywhere. Period.**
7. **The "Create" button is always top-right.** Every page. Muscle memory.
8. **Keyboard shortcut to create.** `c` on campaigns creates one. `n` on PRs opens new. Power-user candy.

---

## 7. User Council 2 — Gretchen (HOP / Admin)

*Simulated: Head of Production, oversight role, runs budget approvals, wants to see ledger-like rigor, demands defensible numbers, limited patience for broken UI.*

### Round 1 — What she cares about

*Gretchen:* "Budget has to be correct and *auditable*. I need a page where I see every pending approval, sorted by dollar risk, with an audit trail showing who approved what when. Right now Budget has four tabs and I can't tell at a glance which is *waiting on me*."

"Vendors need to see less. They get confused. Hide the sidebar, give them three buttons on a clean page, done."

"I want to trust the status pill. Amber/green/blue isn't trustworthy if each page styles them differently. They should be identical on every screen."

### Round 2 — On the creative-team test

*Gretchen:* "When Laura or the Art Director demos this app to the CMO, we need it to look *assembled*. If I see `bg-amber-50 text-amber-800` in one place and `rounded-lg bg-yellow-100` in another, I lose trust. That's not a design critique, that's a governance issue."

"Print pages for invoices and POs need to look like *documents* — not screenshots of the web app. White background, serif is okay for legal, but you said Inter only; fine, then Inter with wider leading on the print pages so it reads like a letter."

"Search everywhere. Cmd-K. If I can jump to any campaign, PR, invoice in one keystroke, I don't need a sidebar at all."

### Round 3 — What she demands

1. **Approvals Inbox on Dashboard for Admin role.** Sorted by $ risk, with "approve all under $X" bulk action.
2. **Audit log visible on every document** — invoice, PO, estimate. Who saw it, who changed what, timestamps.
3. **Vendor shell is lean.** No sidebar, top bar with 3 tabs (Submit / Invoice / Status). Same brand, different mode.
4. **Print pages are document-quality.** Inter, 11pt body, 1.5 leading, 1" margins, black on white, no color except the logo. Fits a US-Letter page at 100% without reflow.
5. **Unified status pill everywhere.** Same colors, same shape, same copy (Approved / Rejected / Pending / Submitted / Draft).
6. **Cmd-K.** Yes.
7. **Color coding of $ states.** Green <80%, amber 80–100%, red >100%. Everywhere. Same everywhere.

---

## 8. User Council 3 — Creative Team + Vendors

*Members: **Art Director Maya** (visual, wants Asset Studio to feel like a design tool), **Photographer Rick** (shoot-day, mobile, outdoors), **Stylist Dana** (wardrobe, mobile-first), **Vendor Paul** (submits invoices, wants to be gone in 30 seconds)*

### Round 1

**Maya.** "Asset Studio should feel like Figma-adjacent. It does, cosmetically, but the Variants tab is where I live and it hides behind a default that lands me on 'My Work.' Make Variants my default. Also the scoped `--as-*` tokens are gorgeous — *why don't the status pills in my variants page use them?*"

**Rick.** "Shoot day. I'm on an iPad, outdoors, the page breaks. /campaigns/[id]/pre-production needs to be one-thumb usable. Big checkboxes. No tiny tabs. A runsheet view."

**Dana.** "Wardrobe checkout on mobile. Right now I tap a card, a drawer opens, and the bottom sheet has text at 12px I can't read. Bigger hit targets."

**Paul.** "I log in. I see… a sidebar? I just want to upload a file. Give me a plain page: drop zone, my invoices list below it, status next to each. Nothing else."

### Round 2

**Maya.** "In Asset Studio, z-indexes conflict in the template editor. I had a dropdown hide behind a toolbar. That's a tell that the modal layering isn't thought through."

**Rick.** "For mobile: sticky CTA bar at the bottom. Always-visible `Mark ready`. No swipe-hunt."

**Dana.** "Checkout flow needs an `undo` — I scanned the wrong item once and had to delete-and-re-add. 2 clicks to undo max."

**Paul.** "Password reset made me sign in twice. The dev-auth UI is fine for you but do not ship it to me. Production auth, SSO, done."

### Round 3

1. **Variants tab is Art Director default, Maya's request.** Already done for AD role per audit — verify + extend to Creative Directors.
2. **Asset Studio's `--as-status-*` tokens are promoted to global status system.** One system, one truth.
3. **Pre-production mobile view.** Shoot-day runsheet: big checkboxes, big type, sticky bottom CTA, offline-tolerant.
4. **Wardrobe mobile bottom-sheet.** Text floor 14px, hit target 44×44, bigger images, one-hand reach.
5. **Undo on all destructive actions.** 5-second toast with Undo.
6. **Vendor experience is a different shell.** No sidebar; simple tabs; giant dropzone; branded but minimal. Production auth, SSO path.

---

## 9. Convergence — what all 6 councils agreed on

Across every council, five points appeared more than once:

1. **Tokens exist; components must use them.** Badge/Toast/PR-status/Role-badges all need to stop hardcoding colors.
2. **Status pill must be one component, one visual treatment, everywhere.**
3. **Default filters by role.** Every list lands on "what's waiting on me."
4. **Context menus on cards.** Kebab or right-click for Flag / Archive / Duplicate. Cuts 2 clicks off dozens of flows.
5. **Split overloaded pages.** Wardrobe, Asset Studio Templates, Gear, Campaign Detail — each is doing too much.

And six that appeared in multiple councils:

6. **Cmd-K command palette.** Ship it.
7. **Dashboard = work queue, not hero.** Counts, alerts, links.
8. **Sidebar grouped (5 zones) and trimmed (kill duplicates, move Settings to user menu, fix hardcoded BMM route).**
9. **Overlay contract enforced.** One backdrop, one shadow, one radius, Esc/X/click-outside all mandatory.
10. **Spacing scale enforced.** 4/8/12/16/24/32/48. Kill `space-y-5`, `space-y-7`.
11. **Mobile-primary only where the job demands it** (scan/checkout/runsheet) — the rest is desktop-first, honestly.

---

## 10. Per-page rapid-fire audit

| Page | Worst issue | Quick fix |
|---|---|---|
| `/dashboard` | Empty/underused by role | Work-queue redesign per council |
| `/calendar` | Split 2/3 vs 1/3 unusual; event styling uneven | Standardize layout with grid tokens |
| `/campaigns` | Budget state not visible inline | Status dot + amount next to name |
| `/campaigns/[id]` | 8+ modal useStates; tile header drift | Shared modal manager; tile header audit |
| `/campaigns/[id]/pre-production` | Desktop-only; 1,537 LOC; too many modals | Mobile runsheet view; split flows |
| `/campaigns/[id]/shots` | Redirect-only page | Remove from sidebar |
| `/asset-studio` | 7 tabs; tab names unclear ("Mechanicals") | Group to 3 top tabs; rename |
| `/asset-studio/templates/[id]/edit` | 2,587 LOC; z-index conflicts | Split into editor + settings + preview |
| `/product-requests` | Hardcoded status colors; no default filter | StatusPill component; default to "Awaiting me" |
| `/product-requests/[id]` | Drawer-based edit is right; depts not collapsible | Collapsible per department, remember state |
| `/products` | Search styling inconsistent; flag flow buried | Unified search; kebab menu on card |
| `/products/flags` | Orphan page, unclear to users | Link from product drawer + dashboard |
| `/contacts` | Two tabs split talent findability; hardcoded role colors | Unified search; role filter; central palette |
| `/calendar` | None critical | Standardize sidebar width |
| `/vendors` | Thin page | Fold into `/contacts` vendor tab |
| `/budget` | 4 tabs; Producer can't see own campaign budgets | Move campaign budget to campaign detail; Admin inbox |
| `/goals` | Off-flow; rarely used | Move to user menu or dashboard widget |
| `/settings` | Top-level nav item | Move to user menu |
| `/studio` | Modal-only booking path | Add "Reserve" CTA button |
| `/gear` | 1,244 LOC multi-job | Split inventory/reservations/maintenance |
| `/gear/scan` | Good on paper, mobile-untested | Mobile QA pass |
| `/gear/print` | Works | Ensure print CSS |
| `/wardrobe` | 2,100 LOC, 4 concerns | Split into 2 pages minimum |
| `/props` | Thin | Match gear conventions |
| `/pre-production` | Redirect-only | Remove |
| `/post-workflow` | Moderate complexity | Audit tile headers |
| `/vendor-workflow` | Vendor shell needs separation | Separate vendor-mode shell |
| `/brand-marketing` | Landing OK | Ensure dept picker |
| `/brand-marketing/review/[dept]` | Hardcoded Bakery in sidebar | Remove dept from sidebar link |
| `/estimates-invoices` | Duplicate sidebar entry | Consolidate |
| `/login` | Dev-auth UI shipped | Production auth UI for prod |
| `/invoices/[id]`, `/estimates/[id]`, `/po/[id]` | Print quality variable | Document-grade print CSS |
| `/rbu` | External context | Verify scope per feedback memory |
| `/laurai` | Dev route | Remove from prod or gate |

---

## 11. Overlay audit — component by component

| Overlay | Esc | X | Click-outside | Focus trap | Mobile | Header style | Shadow | Action |
|---|---|---|---|---|---|---|---|---|
| Modal (base) | ✓ | ✓ | ✓ | ✓ | sheet | text-lg semibold | lg | Keep, canonicalize |
| Drawer (base) | ✓ | ✓ | ✓ | — | sheet | text-lg semibold | lg | Add focus trap |
| ConfirmDialog | ✓ | ✓ | ✓ | ✓ | sheet | text-lg | lg | Keep |
| NewCampaignModal | ✓ | ✓ | ✓ | ✓ | — | per Modal | lg | Crew-picker z-index |
| ShootDayModal | ✓ | ✓ | ✓ | ✓ | — | per Modal | lg | Crew/space picker z-index |
| ShotListModal | ✓ | ✓ | ✓ | — | — | text-base | 2xl | Migrate to Modal base |
| ShotDetailModal | ✓ | ✓ | ✓ | ✓ | — | per Modal | lg | Auto-expand textarea review |
| AddSetupDrawer | ✓ | ✓ | ✓ | ✓ | — | per Modal | lg | **Rename to Modal** |
| ProductDrawer | ✗ | ✓(sm) | ✗ | — | — | inline edit | — | Rebuild on Drawer base; dropdown z-index |
| GearDetailModal | ✗ | ✓(abs) | ✗ | — | — | sm | — | Rebuild on Modal base |
| ReserveGearModal | ✓ | ✓ | ✓ | ✓ | — | default | lg | Consolidate dropdown layers |
| SendPoModal | ✗ | ✓ | ✓ | — | — | text-sm | xl | Migrate to Modal; Esc support |
| PdfPreviewModal | ✓ | ✓ | ✓ | — | — | text-base | — | Inline styles → classes |
| RaiseFlagDialog | ✓ | ✓ | ✓ | ✓ | sheet | per Modal | lg | Keep |
| Toast | — | ✓ | — | — | — | — | md | Unify color tokens |
| Everything else | varies | varies | varies | varies | varies | varies | varies | Canonicalize |

---

## 12. Cohesion score after fixes (projected)

If the FIX_PLAN.md is executed in full:

| Dimension | Before | After |
|---|---|---|
| Token system (applied) | 5 | 9 |
| Typography cohesion | 6 | 9 |
| Color cohesion | 5 | 9 |
| Spacing rhythm | 5 | 9 |
| Overlay discipline | 4 | 9 |
| Click economy | 5 | 8 |
| IA | 5 | 8 |
| Editorial polish | 7 | 9 |
| **Overall** | **5.5** | **8.8** |

Nine is pristine. We don't chase 10 — 10 is theoretical. 9 is editorial-grade and the creative team will open this app proud.
