# Greenroom — Production Portal V2: Full Context Prompt

Paste this into a new Claude Code chat to carry forward all project knowledge.

---

## What Is Greenroom

Greenroom is a web app (PWA) for managing photo/video production campaigns at a Fortune 100 grocery company's internal creative studio. It replaces Outlook calendars, email chains, and Word docs with a single portal for campaign management, vendor PO lifecycle, gear inventory, and budget tracking.

**Location**: `/Users/laura/Portal V2 Fresh/portal-v2/`
**Supabase project**: `rlhwnvddsefstggwvgsw` (us-east-2)
**Dev server**: `npm run dev` via `.claude/launch.json`

**Tech stack**: Next.js 15 (App Router), React 19, Tailwind v4 (CSS variables), Supabase (Postgres + Auth + Storage), SWR, Zod

---

## The User — Laura

Laura is a **Producer** in the production department. She reports to Gretchen (the HOP — Head of Production, Admin role). The team has ~6 Producers, ~10 Studio members (photographers, coordinators, PAs, Studio Manager), plus external vendors from an approved roster.

**Not a developer.** Don't ask about technical architecture. Make smart default decisions and explain tradeoffs in one sentence. Ask product/workflow questions, not implementation questions.

**Key frustration**: The V1 attempt failed because it was too buggy and the architecture was fragile. This build must be robust and reliable.

**Brand is always Publix.** Brand is never stored, tracked, filtered, or displayed. It was intentionally removed from the entire codebase.

**WF# format**: Always `WF` followed by 6 digits, no dashes. Example: `WF302001`, not `WF-12345`.

---

## Design Standards

The creative team includes designers with strong opinions. The UI MUST look premium and editorial — like it came from a boutique agency, not an internal IT project.

- No default Bootstrap/Material look
- Generous whitespace, careful typography hierarchy, subtle shadows (think Linear/Apple)
- Restrained color use, smooth transitions
- Empty/error/loading states all must look designed
- Branding: Greenroom logo is an IMAGE (`/greenroom-logo.png`), not styled text. Color: `#10442B` sidebar, `#69A925` primary

---

## 5 User Roles & Their Journeys

### 1. Admin (HOP — Gretchen)
- Full visibility across all campaigns, budgets, vendors, gear
- Manages budget pools (total pool → per-campaign allocations, leftover returns)
- Final approval on invoices and budget overage requests
- User management in Settings
- Sees budget-first view: committed/spent aggregation, spending analysis charts
- Approvals dashboard: pending budget requests + invoice approvals

### 2. Producer (Laura and ~5 others)
The primary power user. Full campaign lifecycle:
- **Create campaign**: Single field (WF# + name), status starts at Planning
- **Campaign statuses**: Planning → In Production → Post → Complete (+ Cancelled, which can reactivate to Planning)
- **Manage shoots**: Create inline (no modal), set type (Photo/Video/Hybrid/Other — editable after creation), pick dates via calendar chips, set per-date call time + location
- **Assign crew**: Typeahead search, assign role per shoot. "Different crew per day" toggle. Bulk copy crew from Day 1 to subsequent days. Inline role editing on crew chips
- **Assign vendors**: From approved roster, triggers 10-step PO lifecycle
- **Shot list**: Create setups → add shots → link deliverables to shots. Flag shots as "Needs Retouching"
- **Link products**: From Product Directory for on-set reference (R&P guides, shooting notes)
- **Budget**: View committed/spent/remaining. Request overages (modal shows projected total + over-budget callout). See per-vendor cost breakdown
- **Files**: Upload with category (Fun Docs: Shot List, Concept Deck, Reference, Product Info; Boring Docs: Contract, Estimate, PO, Invoice, Insurance, Legal). File validation: 100MB limit, type allowlist (images, PDF, Office, video, zip)
- **Call sheet**: Auto-generated from campaign data. Copy to clipboard or draft email (mailto: for Outlook)
- **On-set mode**: Select shoot day → shows crew list + call time + location in header, shot progress bar, larger touch targets
- **Status changes**: Confirmation dialog for Complete and Cancelled transitions
- **Delete**: Shoot delete has confirmation. Campaign delete is Admin-only

### 3. Art Director
- Sees creative content: shot list, products, deliverables, setups
- Does NOT see financials, vendors, or budget
- Can edit shot list (add setups, add shots, flag retouching)
- Can complete shots (mark done)
- Has own dashboard (not yet built)

### 4. Studio (Photographers, Coordinators, PAs, Studio Manager)
- Dashboard: upcoming shoots, gear checked out, overdue returns, reservations
- Can complete shots on-set
- Gear management: check in/out with condition tracking, QR codes, reservations, kits, maintenance logs
- See campaign details but can't edit financials

### 5. Vendor (External, e.g., Fresh Focus Photography)
- Dashboard: active assignments, action needed queue, completed jobs
- **Self-service PO lifecycle**:
  1. Receives invitation
  2. Submits itemized estimate (line items with categories, auto-calc)
  3. Estimate reviewed/approved by Producer
  4. PO uploaded
  5. Signs PO digitally (drawn signature canvas with IP + timestamp + legal text)
  6. Marks shoot complete
  7. Submits invoice (PDF → AI parsing Edge Function → line-item comparison vs estimate → flag discrepancies)
  8. Producer pre-approves invoice
  9. HOP final approves
  10. Marked as Paid
- Restricted campaign view: sees shot list, products, call sheet for assigned campaigns only
- Cannot see other vendors' data, financials, or unassigned campaigns
- Can be removed from campaign at any pre-"Shoot Complete" status (with confirmation if past Invited)

---

## Vendor PO Lifecycle (State Machine)

```
Invited → Estimate Submitted → Estimate Approved → PO Uploaded → PO Signed → Shoot Complete → Invoice Submitted → Invoice Pre-Approved → Invoice Approved → Paid
Any step can → Rejected (which can return to → Invited)
```

Database-enforced via trigger function. Status transitions defined in `lib/constants/statuses.ts`.

---

## Campaign Command Center (Detail Page)

Single-page layout with collapsible sections (not tabs). Side-by-side grid layout for desktop efficiency:

```
[Header: ← WF302001 / Campaign Name □ / ... / ● In Production]
[Stats bar: Budget | Committed | Assets Due | ... | Call Sheet | On-Set]

[Shoots (3/5 width)]  [Notifications (2/5 width)]
[Shot List — full width]
[Products (1/2)]       [Gear (1/2)]
[Files (1/2)]          [Budget (1/2)]
[Vendors — full width]
[Call Sheet — full width]
```

Key UI patterns:
- `CollapsibleSection` with localStorage-persisted expand/collapse state
- Status dropdown pill (top-right of header) with confirmation for Complete/Cancelled
- Attention system: computed urgent/warning/info items shown in Notifications tile
- Editable shoot names (click to edit inline)
- Date chips with per-date detail rows (call time + location)
- Crew chips with inline role editing (click role text → dropdown)

---

## Database Schema (28 tables, all RLS-enabled)

Core: `users`, `campaigns`, `vendors`, `budget_pools`, `budget_requests`
Shoots: `shoots`, `shoot_dates`, `shoot_crew`
Shot List: `shot_list_setups`, `shot_list_shots`, `shot_deliverable_links`
Products: `products`, `campaign_products`, `campaign_gear`
Deliverables: `campaign_deliverables`
Vendors: `campaign_vendors`, `vendor_estimate_items`, `vendor_invoices`, `vendor_invoice_items`
Files: `campaign_assets`
Gear: `gear_items`, `gear_checkouts`, `gear_reservations`, `gear_kits`, `gear_kit_items`, `gear_maintenance`
Fun: `menagerie_collections`

Migrations in `supabase/migrations/001–012`.

---

## Architecture Patterns

- **Service layer**: `lib/services/*.service.ts` — all DB queries go through services, never direct in API routes
- **Admin client**: `createAdminClient()` for server-side operations (bypasses RLS)
- **Auth guards**: `requireRole(["Admin", "Producer"])` at top of API routes
- **Zod validation**: `lib/validation/*.schema.ts` for request validation
- **SWR hooks**: `hooks/use-campaigns.ts` etc. for client-side data fetching + mutation
- **State machines**: Campaign status and vendor PO lifecycle enforced in DB triggers + validation layer

---

## Key Files

- `app/(portal)/campaigns/[id]/page.tsx` — Campaign detail page (command center, ~1700 lines with inline components)
- `components/campaigns/shoots-section.tsx` — Shoot management (inline creation, dates, crew, bulk copy)
- `components/campaigns/status-dropdown.tsx` — Status pill with confirmation
- `components/campaigns/vendor-assignment-panel.tsx` — Vendor assignment + PO lifecycle
- `components/campaigns/campaign-card.tsx` — Campaign list card (premium design)
- `lib/constants/statuses.ts` — All status definitions, transitions, colors
- `lib/services/campaigns.service.ts` — Campaign CRUD + enrichment
- `types/domain.ts` — All TypeScript types

---

## Test Users

| Email | Password | Name | Role |
|-------|----------|------|------|
| admin@test.local | testpass123456 | Gretchen | Admin (HOP) |
| producer@test.local | testpass123456 | Laura | Producer |
| studio@test.local | testpass123456 | Studio | Studio |
| vendor@test.local | testpass123456 | Sam | Vendor (Fresh Focus Photography) |

---

## What's Done vs. Remaining

**Done**: All 5 role journeys functional, full campaign lifecycle, vendor PO lifecycle, gear management, budget tracking, shot list, product directory, call sheet, on-set mode, file uploads with validation, attention system, menagerie easter eggs, mobile responsive, PWA manifest.

**Remaining polish**:
- Google OAuth credentials (needs client ID/secret)
- ANTHROPIC_API_KEY for real AI invoice parsing on Edge Function
- Art Director dev login button + dashboard page
- Crew availability cross-campaign checking (complex, future)
- End-to-end testing with real team
- PWA icon generation (need 192px + 512px PNGs)
- QR scanner camera integration (needs HTTPS)

---

## Communication Style

- Plain language only — no jargon
- Make technical decisions, don't ask Laura to choose
- Ask product/workflow questions when clarification needed
- Design must be editorial-grade — premium, polished, intentional
- The Greenroom logo is an image file, never styled text
- When building UI: boxes next to boxes for efficiency, tighter spacing, no wasted whitespace
