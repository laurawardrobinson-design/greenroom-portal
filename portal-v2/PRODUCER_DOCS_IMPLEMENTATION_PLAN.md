# Producer Docs — Implementation Plan

Shot List · One-Liner · Day-by-Day · DOOD · Call Sheet

Last updated: 2026-04-24
Owner: Portal V2 / Producer Workspace

---

## 1. Goal

Bring the four producer schedule artifacts (plus one new one) to industry-standard parity with StudioBinder / SetHero / Movie Magic, without breaking the Schedule-tab chrome or the existing design system. Keep drag-rearrange as a first-class producer workflow across all views.

The load-bearing finding from industry research: these are not five documents, they are **five views over one breakdown**. Shot List is the creative view, One-Liner is the time view, Day-by-Day is the shot-to-date assignment view, DOOD is the element/resource view, Call Sheet is the logistics view. Every mediocre tool stores them separately; pro tools derive at least three from one source of truth. Portal V2 already does this for Shot List + One-Liner + Day-by-Day. Call Sheet is currently orphaned (form state only). DOOD does not exist yet.

---

## 2. Current Baseline (Repo Truth)

All four current views live under `/campaigns/[id]/pre-production` in the Schedule tab.

**Shot List** — `components/pre-production/shot-list-clean-view.tsx`. Backed by `shot_list_setups`, `shot_list_shots`, `shot_deliverable_links`, `shot_product_links`, `shot_talent`. Drag-to-reorder within setup works. PDF export via `generateShotListPdf`.

**One-Liner** — `components/pre-production/one-liner-view.tsx`. Renders one shoot date at a time from `shot_list_shots`. Drag-to-reorder shots within the selected day works. PDF export via `generateOneLinerPdf`.

**Day-by-Day** — `components/pre-production/day-by-day-view.tsx`. Grid of date columns with shot cards. Drag shots between dates works. Drop to Unassigned works.

**Call Sheet** — `components/pre-production/call-sheet-builder.tsx`. **No database persistence — form state only.** PDF export via `generateCallSheetPdf`. Mailto link via `generateMailtoLink`. No versioning, no distribution tracking, no safety-required fields.

**DOOD (Day Out of Days)** — does not exist.

**PRDoc** — separate workflow at `/product-requests`. Tied to shoot dates but not surfaced on the Call Sheet today.

---

## 3. Architectural Decision

### 3.1 Five sub-tabs, not four

The Schedule tab becomes **Shot List · One-Liner · Day-by-Day · DOOD · Call Sheet**. DOOD is additive. Day-by-Day stays — it is load-bearing for the shot-to-date drag workflow and we do not replace it with the element grid.

### 3.2 One source of truth per ordering axis

- Shot order within a day: `shot_list_shots.sort_order_in_day`.
- Shot-to-date assignment: `shot_list_shots.shoot_date_id`.
- Setup order on the Shot List canvas: `shot_list_setups.sort_order`.

Whichever view the producer is in — Shot List, One-Liner, or Day-by-Day — drag-rearrange writes to the same columns. Reorder sticks everywhere.

### 3.3 Breakdown elements (for DOOD)

A new `breakdown_elements` table holds first-class entities that appear across days: talent, stylists, specialty crew, products, locations, equipment. `breakdown_element_days` is the element × shoot_date join with a status-code enum (SW, W, WF, H, T, R, released, shipped, arrived, confirmed, tentative). Phase A migration keeps `shot_talent` working via a view; Phase B deprecates it.

### 3.4 Call Sheet persistence and versioning

`call_sheets` is a per-campaign-per-shoot-date record. `call_sheet_versions` is an immutable snapshot on every publish. `call_sheet_distributions` tracks who received which version and whether they acknowledged. `call_sheet_attachments` holds releases / permits / COI / safety bulletin.

---

## 4. Functionality Matrix

| View | Drag today | Drag after plan |
|---|---|---|
| Shot List | Reorder shots within setup | Reorder shots within setup; **drag shot to a different setup**; **drag setup to reorder canvas**; **multi-select + bulk assign to shoot date**; drag disabled in On-Set density |
| One-Liner | Reorder shots within selected day | **Two-level drag**: drag **setup** to reorder running order within a day; drag **setup** to a different day (moves all nested shots); drag **shot** within its expanded setup |
| Day-by-Day | Drag shots between date columns; drag to Unassigned | Unchanged semantics; **add multi-select drag** (shift-click range, cmd-click individual); subtle drop animation |
| DOOD | — | **Click cell to cycle status code**; drag a code chip from one date to another to shift a single element's commitment; row-level drag out of scope (elements are unordered) |
| Call Sheet | — | No drag. Call sheet is the published artifact. Schedule block **reads** from One-Liner for that date. |

### 4.1 Cross-view drag coherence rule

All Shot List / One-Liner / Day-by-Day drags write to `shot_list_shots.sort_order_in_day` and `shot_list_shots.shoot_date_id`. The next view the producer opens reflects the change without a reload.

### 4.2 Multi-select behavior

- **Shot List:** shift-click selects a range within a setup; cmd-click adds/removes individual shots. Bulk bar appears at the bottom with "Assign to date…", "Move to setup…", "Duplicate", "Delete".
- **Day-by-Day:** shift-click selects a range within a date column; cmd-click adds/removes. Drag any selected card moves the whole group.
- **One-Liner:** single-select only (setups are the primary drag target; bulk operations live in Shot List).

### 4.3 State transitions — Shot List

Shot status cycles: `Planned → Shot → Hero → Approved`. Approve stamps `approved_by`, `approved_at`, and `approved_snapshot` (jsonb).

Staleness rule: an approval goes stale if any of **description, reference image, products, orientation** change after approval. Changing duration, sort order, notes, retouch notes does **not** invalidate. Stale shots show a `needs_reapproval` badge and a diff view.

On-Set density disables drag to prevent accidental reorders on a touch device. Status cycling remains one-tap.

---

## 5. Design System Impact

### 5.1 What reuses existing tokens and patterns

- Tab chrome and sub-tab pattern: unchanged.
- Page header / breadcrumb / actions slot: unchanged.
- Pill system: used for all new code chips (DOOD status codes, shot state).
- Setup 8-color palette (`SETUP_BADGE_COLORS`): reused on One-Liner and DOOD.
- Status tokens (success, warning, error, info): reused for Call Sheet version states and distribution states.
- Tile-header rule (text-sm font-semibold uppercase tracking-wider, icon + gap-2, border-b): applied to every new section header.
- shadcn primitives (Dialog, DropdownMenu, Table, Badge, Button): nothing new.
- Inter only. No `font-mono`, no serif, anywhere. Code chips for DOOD statuses (SW / W / WF / H) are Inter `font-semibold tracking-wide`, not mono.
- 10px text floor respected.

### 5.2 Net-new patterns (two)

**1. One-Liner day-bar** — `.ui-day-bar`
- 2px black rule above, uppercase `tracking-wider` day header below.
- Content: `DAY 3 / 8 — THU 5/12 — STUDIO A — EST WRAP 6:30P`.
- Inter font-semibold. `text-xs`.
- Separates days in the multi-day One-Liner roll-up.

**2. Call Sheet version watermark (print-only)** — `.ui-print-superseded`
- Diagonal `SUPERSEDED — see vN` watermark at `opacity-40`, muted gray.
- `@media print` only. Does not appear on screen.
- Appears on any call sheet version that is no longer current when printed.

### 5.3 Patterns explicitly rejected

- Mono font for DOOD codes. Use Inter semibold.
- New modal chrome for multi-select bulk actions. Use an existing bottom bar pattern or create one and document it as reusable.
- Second color palette for DOOD. Reuse status tokens + setup palette.

---

## 6. Implementation Waves

Waves sequenced so that the highest-liability gap ships first and the biggest migration ships last (isolated behind a view so it never blocks earlier waves).

### Wave 1 — Call Sheet persistence + distribution

**Status: IN PROGRESS (2026-04-24).** Core persistence + publish-versioning shipped; distribution / attachments / print-watermark / PRDoc-deliveries pending next session.

**Shipped:**
- Migration 094 — `call_sheets`, `call_sheet_versions`, `call_sheet_distributions`, `call_sheet_attachments` + triggers (auto-draft on shoot_date insert, re-date sync, cascade-delete drafts, backfill for existing shoot_dates).
- Service layer (`lib/services/call-sheet.service.ts`) — `getOrCreateDraftByShootDate`, `getCallSheet`, `updateDraft`, `publishVersion`, `listVersions`, `getVersion`, `contentToPdfData`, `formatCallTimeFromDb`.
- API routes — `/api/call-sheets/by-shoot-date`, `/api/call-sheets/[id]` (GET + PATCH), `/api/call-sheets/[id]/publish` (POST), `/api/call-sheets/[id]/versions`.
- React hook (`hooks/use-call-sheet-draft.ts`) — debounced autosave (800ms), publish, save-state machine (idle / dirty / saving / saved / error).
- Rewired `components/pre-production/call-sheet-builder.tsx` to read/write from DB.
- New CallSheet fields added in the UI: shooting call, breakfast, lunch time + venue, estimated wrap, company moves, walkie channels, sunrise / sunset / golden hour, urgent care, police non-emergency, on-set medic, allergen/food-safety bulletin, hospital required-field validation.
- Save-status pill (Saving / Saved / Unsaved / Save failed).
- Version stamp pill (V1, V2, …) in the toolbar after publish.
- Publish required-field validation (hospital name + address + phone + general call time). Error surfaces in UI.
- Call time format helper — Postgres `time` values auto-format to `5:00 AM` on seed.

**Semantic clarification (post-review):**
- `call_sheets.status` stays `'draft'` always while editable. Publish does NOT flip the row status — it creates an immutable `call_sheet_versions` row and updates `current_version_id`. This preserves the "sheet row is the always-editable draft" model and prevents orphan rows.

**Still open in Wave 1 (next session):**
- PRDoc "Deliveries Today" block on the preview (auto-pull from PR items for the shoot_date).
- Two-tier distribution (Full / Redacted) — email send + ack-token signed link endpoint. Blocked on email vendor decision (Resend / SendGrid / SES / mailto-only).
- Attachments (talent release, minor release, location permit, COI, safety bulletin) + 48h-out required-missing warning.
- Print-only superseded watermark CSS (`.ui-print-superseded`).

**Goal:** eliminate the ephemeral-form liability and meet industry-standard safety and versioning.

**Schema**
- `call_sheets` (id, campaign_id, shoot_date_id, created_by, timestamps).
- `call_sheet_versions` (id, call_sheet_id, v_number, published_by, published_at, payload jsonb, superseded_at).
- `call_sheet_distributions` (id, version_id, recipient_name, recipient_email, tier enum `full | redacted`, channel enum `email | in_portal`, sent_at, acked_at, ack_token).
- `call_sheet_attachments` (id, call_sheet_id, kind enum `talent_release | minor_release | location_permit | coi | safety_bulletin | other`, file_url, expires_at, required bool).

**Fields on the call sheet payload**
- Header: company, campaign, WF#, date, general call, version stamp.
- Safety (required): nearest ER with full address + phone, urgent-care alt, police non-emergency, on-set medic, campaign safety bulletin (inherits from campaign, editable per sheet).
- Environmental: weather (cached with `as of` timestamp, optional), sunrise / sunset / golden hour (if exterior shoot).
- Schedule: general call, shooting call, breakfast, lunch window, est wrap, company moves.
- Crew table: name, dept, role, call time, phone (tier-aware), email.
- Talent table: name, role, MU/wardrobe call, set call, pickup.
- Locations: address, map link, parking, load-in.
- **Deliveries Today**: auto-pulled from PRDoc items tied to this shoot date. Zero new data.

**Distribution**
- Two tiers: **Full** (crew + producer direct lines) and **Redacted** (talent, vendors, client — crew numbers route to production office).
- Email with explicit ack button (`I got this call sheet`). Tracking-pixel acks rejected as unreliable at corporate email firewalls.
- In-portal notification.
- Signed-link endpoint for external recipients (food stylist, freelance crew) so they do not need a portal login.
- SMS deferred to a later wave (requires short-code registration + vendor).

**Versioning**
- New version on every publish.
- Old versions watermarked `SUPERSEDED — see vN` on print via `.ui-print-superseded`.
- Signed link always resolves to current version.
- Top-right version stamp on every rendered call sheet: `v4 — Thu 6:42 AM`.

**UI**
- Left form / right preview stays. Preview is now backed by the persisted record.
- Dept filter on the preview (collapse crew table to a single dept — Priya's ask).
- 48h-out required-missing attachment warning.

**Done when**
- Call sheet state survives a browser refresh.
- Publish creates an immutable version row.
- Email ack recorded for any recipient who clicked the link.
- External signed link resolves without portal login.
- PRDoc items for the date auto-appear in Deliveries Today block.

### Wave 2 — Shot List state, density, drag upgrades

**Goal:** make shot state expressive enough for the creative director and robust enough for on-set use. Upgrade drag to support cross-setup and bulk.

**Schema additions to `shot_list_shots`**
- `variant_type` enum (`hero_still | motion | social_vertical | other`).
- `orientation` enum (`horizontal | vertical | square | custom`).
- `retouch_level` enum (`comp | light | heavy`).
- `hero_sku` text (nullable).
- `is_hero` bool default false.
- `approved_by` uuid (nullable, references users).
- `approved_at` timestamp (nullable).
- `approved_snapshot` jsonb (nullable) — full shot record at approve-time.
- `needs_reapproval` bool — computed column or denormalized on update trigger.

**New table**
- `user_campaign_preferences` (user_id, campaign_id, shot_list_density enum `detailed | on_set`, …reserved for future prefs). Manual toggle in v1; auto-detect deferred.

**UI**
- **Density toggle pill** in Shot List header: `Detailed` / `On Set`. Persisted per user per campaign.
- **Detailed** (today's view): spreadsheet layout, all columns.
- **On Set**: fat rows, big thumbnail, one-tap state cycle, filtered to today, drag disabled.
- Shot state cycle button: Planned → Shot → Hero → Approved.
- Approve button stamps snapshot. Diff view on stale approvals.
- New inline columns (all in Detailed): variant type, orientation (tiny icon), retouch level, hero SKU.
- Inline reference thumbnail visual elevation.
- **Cross-setup drag**: dragging a shot onto a different setup updates its `setup_id`.
- **Setup reorder**: drag handle on each setup header; updates `shot_list_setups.sort_order`.
- **Multi-select**: shift-click range, cmd-click individual. Bulk bar appears at the bottom with Assign-to-date / Move-to-setup / Duplicate / Delete.

**Done when**
- Every shot can be approved with a frozen snapshot.
- Staleness diff renders correctly after an approved shot's description changes.
- Density toggle survives reload.
- Cross-setup drag and multi-select bulk work across Detailed density. On Set disables drag but keeps one-tap state.

### Wave 3 — One-Liner day-bars, two-level drag, roll-up

**Goal:** make the One-Liner actually a one-liner — a frozen distribution-ready printable that collapses shot detail to running-order setups, with day-bars between shoot days. Preserve drag at both levels.

**UI**
- Multi-day rendering. No date picker at the top — scroll the whole shoot.
- **Day-bar** (`.ui-day-bar`) separates each shoot day. Content: day number of total, weekday/date, location, estimated wrap.
- Each row = one setup. Fields: setup #, setup name, hero SKU, stylist owner, est duration, INT/EXT or "Tabletop", location.
- Setups are expandable — click chevron to show nested shots.
- Two-level drag:
  - Drag a setup within a day to reorder running order.
  - Drag a setup across a day-bar to reassign to another day. All nested shots follow.
  - Drag an individual shot inside its expanded setup to reorder (writes `sort_order_in_day`).
- Version stamp top-right (date stamp is fine; not a published-version doc like call sheet).
- Auto-attach rendered One-Liner as page 2 of the published Call Sheet PDF.

**Schema**
- `shot_list_setups.sort_order_in_day` (new) — decouples setup running-order from canvas order.
- Or: reuse `sort_order` if one setup = one day. Decide during build; likely new column to keep Shot List canvas independent.

**Done when**
- One-Liner renders all days of a campaign with day-bars.
- Dragging a setup across a day-bar moves every nested shot to the new `shoot_date_id`.
- Published Call Sheet PDF includes a current One-Liner page.

### Wave 4 — DOOD (new sub-tab) + Day-by-Day polish

**Goal:** give producers the element/resource view they currently hand-build in a spreadsheet. Keep Day-by-Day's shot-drag workflow intact.

**Schema**
- `breakdown_elements` (id, campaign_id, element_type enum `talent | stylist | specialty_crew | product | location | equipment | crew`, name, reference_id nullable, notes, created_at, updated_at).
- `breakdown_element_days` (id, element_id, shoot_date_id, status_code enum `SW | W | WF | SWF | H | T | R | released | shipped | arrived | confirmed | tentative`, source_shot_id nullable, notes, updated_at).
- Phase A migration: `shot_talent` becomes a view joining `breakdown_elements` filtered to `element_type = 'talent'` with shot-specific fields. Shot List keeps reading from the view.
- Phase B (later wave): deprecate `shot_talent` raw reads once the app fully reads from the view.

**UI — DOOD**
- New sub-tab under Schedule: **DOOD**.
- Rows grouped by `element_type`, collapsible:
  - Talent (expanded by default)
  - Stylists (expanded)
  - Specialty Crew (expanded)
  - Products (collapsed by default — CPG shoots carry hundreds of SKUs; show "View N products")
  - Locations (collapsed)
  - Equipment (collapsed)
  - Crew (collapsed)
- Columns = shoot dates.
- Cell = pill-system code chip (SW / W / WF / H / T / R / released / shipped / arrived / confirmed / tentative).
- Click cell → cycle status.
- Drag a code chip between dates → shift that element's commitment day.
- Per-row totals: days-committed (W + H + T + SW + WF count), confirmed count.
- Conflict flag (element has two W codes on same date, or talent has H during another campaign's W).
- Click a cell → opens the source shot/setup that pulled this element onto this day.
- Cost rollup deferred (requires rate table).

**UI — Day-by-Day polish**
- Unchanged drag semantics. Kept as-is.
- Add multi-select (shift-click range within column, cmd-click individual, drag group).
- Subtle drop animation on successful reassign.

**Done when**
- DOOD renders with grouped element rows and code chip cells.
- Clicking a cell cycles status.
- Drag chip between dates updates `breakdown_element_days`.
- Conflict flags render when the same element has overlapping W codes.
- Day-by-Day multi-select works.
- `shot_talent` view returns the same rows as the old `shot_talent` table for every existing campaign (migration correctness check).

---

## 7. Schema Summary

### New tables
- `call_sheets`
- `call_sheet_versions`
- `call_sheet_distributions`
- `call_sheet_attachments`
- `breakdown_elements`
- `breakdown_element_days`
- `user_campaign_preferences`

### Extensions
- `shot_list_shots`: variant_type, orientation, retouch_level, hero_sku, is_hero, approved_by, approved_at, approved_snapshot, needs_reapproval.
- `shot_list_setups`: sort_order_in_day (decision deferred to build time).

### Views
- `shot_talent` becomes a view backed by `breakdown_elements` (Phase A).

### No breaking changes
Every existing record keeps working. All additions are additive. Old PDFs continue to generate correctly.

---

## 8. Deferred / Cut

**Deferred (named, not forgotten)**
- SMS distribution (requires short-code registration, vendor contract, legal sign-off).
- Auto-detect On-Set density by time-to-call (v1.1 polish, needs usage data to tune).
- Cost rollup on DOOD (requires crew/stylist/talent rate table that does not exist yet).
- Phase B `shot_talent` deprecation (follow-up wave after Wave 4 lands).

**Cut from scope entirely**
- Three-tier distribution. Kept to two (Full, Redacted).
- Per-shot crew assignment. Crew stays at shoot level.
- Tracking-pixel read receipts. Explicit ack button only.
- Mono font anywhere. Inter only, no exceptions.

---

## 9. Risks and Ownership

**Highest risk: Wave 4 (element migration).** Mitigated by Phase A view. Waves 1–3 ship without touching element data; Wave 4 isolates the refactor behind a view so Shot List never breaks.

**Medium risk: Call Sheet version semantics.** External signed links must always resolve to current. Acceptance test: publish v2, external recipient of v1 email clicks their link, lands on v2 with a clear "latest version" indicator.

**Medium risk: Approval snapshot schema drift.** Documented as point-in-time. Diff view tolerates missing fields on old snapshots.

**Low risk: Design system fit.** Two net-new patterns only (day-bar, print watermark). Both documented as shared styles. Everything else reuses existing tokens.

**Ownership**
- One producer-facing engineer per wave.
- Design review at the end of each wave (Alex-equivalent — whoever owns the token system).
- Laura (Producer) signs off on real-shoot UX: Wave 2 On-Set density on a tablet on a real shoot day; Wave 4 DOOD against a live campaign's element list.

---

## 10. Acceptance Checklist (cross-wave)

- [ ] Call sheet survives browser refresh.
- [ ] Publish creates immutable version row.
- [ ] External signed link resolves without login.
- [ ] Email ack recorded when recipient clicks.
- [ ] PRDoc items for the date appear in Call Sheet Deliveries Today.
- [ ] Shot approval stamps frozen snapshot; staleness diff renders on edit.
- [ ] Density toggle persists per user per campaign.
- [ ] Cross-setup shot drag writes `setup_id`.
- [ ] Multi-select bulk assign-to-date works in Shot List and Day-by-Day.
- [ ] One-Liner renders multi-day with day-bars.
- [ ] Dragging a setup across a day-bar re-parents all nested shots.
- [ ] Published Call Sheet PDF includes current One-Liner as page 2.
- [ ] DOOD renders grouped element rows with code chip cells.
- [ ] `shot_talent` view returns identical rows to the legacy table for every campaign.
- [ ] Inter only. No `font-mono`. No serif. `text-[10px]` floor respected across every new surface.
