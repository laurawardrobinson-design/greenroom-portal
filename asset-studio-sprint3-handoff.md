# Asset Studio — Sprint 3 Handoff

Drop this into the next chat as context. Companion to `asset-studio-sprint1-handoff.md` and `asset-studio-sprint2-handoff.md`. Written 2026-04-18 at the close of Sprint 3.

---

## TL;DR

Sprint 3 is the "Phase 1 polish" pass — the four things that turned Sprint 2's demo into something the production team can actually adopt. Branch `feat/asset-studio-sprint3` is cut off `main` (after the Sprint 2 PR #19 merged). One new migration (072) is **pending application** to prod Supabase `rlhwnvddsefstggwvgsw` — the code assumes it's been applied and will partially no-op until it is.

Decisions Laura locked in at session start:
- **Demo mode** — no permanent public URLs for approved variants (Meta push deferred to Phase 6).
- **Producer AND Art Director** on the approval gate (Art Director wasn't in the DB enum yet; 072 adds it).
- Ship all four polish items in one sprint (per-row CSV, audit log, run-complete notification, Zod).

---

## What shipped

### 1. Per-row CSV binding overrides (Storyteq Batch Creator parity)

Each row in a run can now carry its own copy overrides, not just the run-level global dict.

**Data shape** — `VariantRunBindings.copy_overrides_by_product?: Record<string /* campaign_product_id */, Record<string /* binding path */, string>>`. No migration required; `variant_runs.bindings` is already jsonb.

**Merge order in `createRun`** (runs.service.ts:219-249): variant `bindings.copy = { ...globalCopy, ...perProductCopy[cp.id] }`. Per-row wins over global.

**UI** (runs/new/page.tsx) — new Step 6 below the global copy overrides card. Appears when `dynamicTextBindings.length > 0 && selectedProducts.size > 0`. Collapsible "Edit N rows" button. Table has a sticky Product column (thumbnail + name + item code) and one editable input per dynamic binding path. Placeholder shows either the current global override (`(uses "X")`) or `(default)` so designers know what will be used if they leave the cell blank.

**Verified** in smoke with 4 products × 1 dynamic binding — payload shape confirmed correct, only non-empty rows sent up.

### 2. Audit log

New immutable append-only table `asset_studio_audit_log` (migration 072). Records:
- `approved` / `rejected` / `bulk_approved` / `bulk_rejected` (variants)
- `created` / `completed` / `failed` (runs — completion emitted by the refresh endpoint, actor = `system`)
- `published` (templates)
- (Stubs for `version_saved` / `version_restored` are mapped in the feed; wire-up is follow-on work)

**Service** — [lib/services/audit-log.service.ts](portal-v2/lib/services/audit-log.service.ts). `logAuditEvent` uses the admin client (bypasses RLS so background transitions can log) but respects the table's intent: human actions carry an `actor_id`, system actions pass `actor_role: "system"`. Failures are swallowed — the audit log must **never** block the primary action. Errors go to server logs.

**Reads** — `listAuditEventsForTarget(type, id)` for single-target views; `listAuditEventsForRun(runId, variantIds)` does a two-query union for the run feed and sorts client-side.

**API** — `GET /api/asset-studio/runs/[id]/audit-log` returns the union of run-level and variant-level events for a run, most recent first.

**UI** — `AuditLogFeed` component inline at the bottom of `runs/[id]/page.tsx`. Polls every 10s (cheap). Shows timestamp, actor name + role chip, action label (natural-language map at `AuditActionLabel`), and rejection reason when present. Auto-refreshes on approve/reject via `mutate()`.

**RLS** — 5 role helper pattern:
```sql
public.current_user_has_role(ARRAY['Admin','Producer','Post Producer','Designer','Art Director'])
```
SELECT open to all asset-studio roles; INSERT requires `actor_id = auth.uid()` (keeps the log honest). No UPDATE/DELETE policies — rows are immutable by omission.

### 3. Run-complete notification

`refreshRunCounts` in runs.service.ts now detects the first transition into a terminal state (`completed` / `failed`) and:
- Emits a run-level audit event (actor = system)
- Calls `createNotification` for the run's `created_by` user, type `"variant_run_complete"`

The notification includes the run name, variant counts, and campaign link. Reuses the existing notification infra from migration 016 — no new table needed. Transition detection is based on reading the prior status before the update, so the notification fires exactly once regardless of how many times `/refresh` is hit.

### 4. Zod schemas on write-heavy asset-studio routes

New file: [lib/validation/asset-studio.ts](portal-v2/lib/validation/asset-studio.ts). Exports `createRunSchema`, `bulkVariantActionSchema`, `rejectVariantSchema`, `updateTemplateSchema`, and a `parseBody` helper that returns a tagged union of `{ok, data}` / `{ok: false, error}` so per-route code stays short:

```ts
const parsed = parseBody(raw, createRunSchema);
if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });
const body = parsed.data;
```

Wired into: `POST /api/asset-studio/runs`, `POST /api/asset-studio/variants` (bulk), `POST /api/asset-studio/variants/[id]/reject`, `PATCH /api/asset-studio/templates/[id]`. Validation errors return the full zod `issues` array so the client can surface field-level messages later (not wired to UI yet; errors currently surface via existing toast fallback).

### 5. Art Director on the approval gate

**Drift fix**: `user_role` enum didn't include `"Art Director"` (migration 001) even though the TS `UserRole` type did. 072 adds it. After the migration lands, `artdirector@test.local` (already in the dev-login grid) will work as a real user.

**Permission updates** — `approveVariants: ["Admin","Producer","Post Producer","Art Director"]` in [lib/auth/roles.ts](portal-v2/lib/auth/roles.ts). Three API routes updated to match: `POST /api/asset-studio/variants` (bulk), `POST /api/asset-studio/variants/[id]/approve`, `POST /api/asset-studio/variants/[id]/reject`. UI gate on `runs/[id]/page.tsx` widened.

### 6. Designer read fix (bonus)

`/api/campaign-products` GET was missing `"Designer"` from its allow-list — Designer couldn't build a run because the product grid 403'd. Added. Preserves the handoff §10 intent: Designer reads, Producer-and-up writes.

---

## Pending: apply migration 072

Not yet applied to prod Supabase. Paste the contents of `portal-v2/supabase/migrations/072_asset_studio_sprint3.sql` into the Supabase SQL editor for project `rlhwnvddsefstggwvgsw`. Order doesn't matter vs. any other pending migrations — 072 only touches `user_role` and creates a new table.

Until it's applied:
- `AuditLogFeed` component will show "0 events" silently (the GET 500s, SWR shows no data; no user-facing error).
- Any `logAuditEvent` call just logs a server-side warning. Primary actions (approve, reject, create, etc.) continue to work.
- `artdirector@test.local` dev-login will fail at the DB-insert step (enum value doesn't exist). Other dev users work.

**Verification SQL** after apply:
```sql
-- Confirm the enum value landed
SELECT enum_range(NULL::user_role);
-- Expect: Admin, Producer, Studio, Vendor, Post Producer, Designer, Art Director

-- Confirm the audit table exists
SELECT COUNT(*) FROM public.asset_studio_audit_log;
-- Expect: 0

-- Confirm the RLS policies
SELECT policyname FROM pg_policies WHERE tablename = 'asset_studio_audit_log';
-- Expect: asset_studio_audit_select, asset_studio_audit_insert
```

---

## Files touched

```
portal-v2/
├─ supabase/migrations/
│  └─ 072_asset_studio_sprint3.sql                   # NEW — enum + audit log
├─ types/domain.ts                                   # +copy_overrides_by_product, +AuditLogEvent
├─ lib/
│  ├─ auth/roles.ts                                  # +Art Director in approveVariants
│  ├─ validation/asset-studio.ts                     # NEW — Zod schemas + parseBody
│  └─ services/
│     ├─ audit-log.service.ts                        # NEW
│     └─ runs.service.ts                             # per-row merge + terminal transition hook
├─ app/
│  ├─ (portal)/asset-studio/runs/
│  │  ├─ new/page.tsx                                # Step 6 UI + perProductCopy state
│  │  └─ [id]/page.tsx                               # AuditLogFeed + canApprove widened
│  └─ api/
│     ├─ campaign-products/route.ts                  # +Designer on GET
│     └─ asset-studio/
│        ├─ runs/
│        │  ├─ route.ts                              # Zod + audit on createRun
│        │  └─ [id]/audit-log/route.ts               # NEW
│        ├─ variants/
│        │  ├─ route.ts                              # Zod + audit on bulk
│        │  └─ [id]/
│        │     ├─ approve/route.ts                   # +Art Director + audit
│        │     └─ reject/route.ts                    # +Art Director + Zod + audit
│        └─ templates/[id]/route.ts                  # Zod + audit on publish
```

---

## Critical gotchas to keep in mind

1. **Audit log writes must be non-blocking.** `logAuditEvent` swallows errors and logs to server. Do NOT `await` it in a way that would let a DB hiccup roll back an approval. This is deliberate — the primary action is sacred.

2. **Art Director UI vs. RLS.** Migration 072 adds the enum value and updates the audit log policies. RLS for `variants` / `variant_runs` was set in 070 to allow `Designer`-and-up writes including `Art Director` implicitly (the helper takes a text[] you pass per policy, and 070's lists don't include AD). Approve/reject still go through the API-level `requireRole`, so the UI gate + API gate are aligned. If you move any variant writes to a place that depends on RLS alone, you'll need to update the policy role lists.

3. **Per-row override merge is one-level deep.** `{ ...globalCopy, ...rowCopy }` — shallow merge. If the copy dict ever goes nested (e.g., `{ "badge.color": { light: "#fff" } }`), this becomes wrong. It isn't today.

4. **The notification fires once-per-transition.** If someone manually bumps a variant back from approved to rendered after completion, the next refresh won't re-notify. This is correct for demo but not durable — for Phase 2 multi-stage approvals, move terminal detection into a proper state machine on `variant_runs`.

5. **Zod validation rejects unknown fields on `createRunSchema.bindings` via `.passthrough()`** — wait, actually it *accepts* them. `.passthrough()` keeps unknown keys so we don't have to update the schema every time we add a new binding field. If you want to lock that down later, switch to `.strict()`.

6. **Migration 072 order.** `ALTER TYPE ... ADD VALUE` can't be used in the same transaction as code that *reads* the new value. 072 only creates a table (no reads of `Art Director`), so it's safe to run as one transaction. If you add any default data that references the new role, split that into a second migration.

7. **Dev-login for Art Director.** `artdirector@test.local` already exists in the dev-login grid (login/page.tsx:13). Dev-login upserts the user — the upsert will *succeed* even without enum value (because Postgres validates on insert, not on the upsert target), but the `role` column coerce may fail. After 072, log in as Art Director to test the approval gate.

---

## Smoke verified

- `/asset-studio/runs/new` renders cleanly as Designer.
- Picked template (Publix Product Hero v1) → picked WF260401 Summer Grilling Hero → selected 4 products → Step 6 appeared with an "Edit 4 rows" button → expanded table showed 4 rows × 1 dynamic binding column (`product.name`) → typed override on row 1 → intercepted the submit payload:
  ```json
  {
    "bindings": {
      "campaign_product_ids": [ "b26c1fb6-…", "47fcced0-…", "3ec1159d-…", "…" ],
      "copy_overrides_by_product": {
        "b26c1fb6-…": { "product.name": "Grill Master Summer Sale" }
      },
      "output_spec_ids": [ "c893bab6-…", "1af22465-…", "5c4dbf06-…", "d0987c99-…" ]
    },
    …
  }
  ```
- Only the row with a non-empty cell made it into the payload (empty-cell filter works).
- TypeScript: `npx tsc --noEmit` clean.
- ESLint: only pre-existing warnings in unrelated files.

Not yet smoked (pending migration 072): the audit feed itself, and the run-complete notification. Both will be exercised end-to-end after apply.

---

## Where to go next — three options

### Option A — Phase 2 (HTML5 + locales + multi-stage approvals)
Same as Sprint 2's Option A, unchanged. 3-4 weeks at this pace. Multi-stage approvals is now the natural next step since the audit log and Art Director gate are in place.

### Option B — CSV import (narrow)
Per-row overrides are editable in the UI but can't be imported from a CSV. The ask will come within a week of real use. Rough scope: add a CSV upload that maps `campaign_product_id` / SKU / name to a row, with the dynamic binding paths as columns. Two to three days.

### Option C — Figma plugin bridge (Phase 5)
Same as Sprint 2's Option C. Biggest "designer adoption" move. ~2 weeks. Still the highest-leverage thing we could do.

My read: **Option B first, then A.** CSV import closes the loop on the Storyteq Batch Creator story. Then multi-stage approvals in Phase 2.

---

## Open questions to surface at session start

Carry over from Sprint 2 (still valid):
1. **Zip export lifecycle** — should approved variants ever get a permanent public URL, or stay zip-only? Laura deferred in Sprint 3 ("demo mode, no permanent public url"); revisit when Meta push is actually scoped.
2. **Brand tokens governance** — Publix seed is still a placeholder from `globals.css`. 30-minute conversation with a real Publix designer still owed.

New for Sprint 4:
3. **CSV import column names** — if we build Option B, what does Laura want to see in the header row? `sku`, `product_id`, `headline`, `price`, … ? Best answered by sending a sample file to one designer.
4. **Audit log retention** — immutable, but should old rows ever be pruned? Today: retained forever. Likely fine for demo; may need policy for prod.

---

## Quick-start for the next chat

Paste this at the top of the next session:

> Continuing Asset Studio. Sprint 1 + 2 + 3 done; Sprint 3 branch is `feat/asset-studio-sprint3`. Migration 072 is still pending apply to prod Supabase `rlhwnvddsefstggwvgsw` — paste `portal-v2/supabase/migrations/072_asset_studio_sprint3.sql` into the SQL editor to land it.
>
> Read `asset-studio-sprint3-handoff.md` at the repo root for the complete picture, then ask me what Sprint 4 should be — CSV import (narrow), Phase 2 (HTML5 + locales + multi-stage approvals), or Figma plugin bridge.
