# Asset Studio — Sprint 7 Plan: Deliverable-Driven Designer Queue

Written 2026-04-19. Follow-on to Sprint 6 + DAM + 078 creative reshape. Branch to cut: `feat/asset-studio-sprint7` off `main` (latest `8d3214a`). Target migration: **079**.

---

## TL;DR

The bones are built. The function is broken at one seam: **campaign deliverables are orphaned from Asset Studio**. A designer assigned to a campaign with 8 deliverables sees **zero tasks** in My Work and has to reconstruct dimensions, copy, and brand context from memory. This sprint closes that seam.

One migration, one new workflow definition, four scoped phases. Phase 1 alone unblocks the designer queue; Phases 2–4 pay the experience debt.

**Decision needed from Laura before we cut the branch:** see "Open questions" at the end.

---

## The real designer workflow (what we're building toward)

A designer's atomic unit of work is **one deliverable → one parameterized template**. They open Asset Studio, see a task tray scoped to them, grouped by campaign, with the deliverable's dimensions + copy + brand context attached. They click in, the template editor opens with canvas size, headline/CTA/disclaimer/legal, and brand tokens pre-loaded. They build the template, hand it off for review, and it disappears from their queue.

This matches Storyteq's Collaboration Hub → Adaptation Studio handoff and every best-in-class equivalent (Celtra, Bannerflow, GenStudio). What they all share: **the designer never hunts for their work.**

---

## The gap (in plain terms)

| Today | Target |
|---|---|
| Default landing for Designer = Overview (dashboard) | Default landing for Designer = My Work (task tray) |
| My Work queue shows only DAM assets | My Work queue shows deliverables + DAM assets, grouped by campaign |
| Deliverable has no link to a template | Each deliverable has a status and (when drafted) a linked template |
| "New template" opens a blank canvas | "Start templating" opens editor with canvas, copy, brand tokens pre-loaded from the deliverable |
| Designer has to find the campaign, read specs, guess canvas | Designer clicks one card, the spec travels with the task |
| Producer can't see template progress per deliverable | Producer sees "5 of 8 templates ready" on campaign detail |

---

## Phases (each independently shippable)

### Phase 1 — Deliverables flow into My Work

Smallest possible end-to-end win. After this, designers have a real queue.

**Migration 079** (`079_asset_studio_deliverable_templating.sql`):
- `ALTER TABLE campaign_deliverables ADD COLUMN assigned_designer_id uuid NULL REFERENCES users(id) ON DELETE SET NULL` — per-deliverable designer override. NULL means inherit campaign `primary_designer`.
- `ALTER TABLE asset_templates ADD COLUMN campaign_deliverable_id uuid NULL REFERENCES campaign_deliverables(id) ON DELETE SET NULL` — the FK from template back to the deliverable it was built for.
- Seed one `workflow_definitions` row for `entity_type = 'deliverable'`:
  - Stages: `needs_template → drafting → template_ready` (Designer self-approves — matches Storyteq; Art Director owns variant-versioning, not template gating)
  - Transitions (role-gated):
    - `needs_template → drafting` by Designer (start)
    - `drafting → template_ready` by Designer (publish the template)
    - `template_ready → drafting` by Designer (reopen for structural edits)
- Index on `campaign_deliverables.assigned_designer_id` for the My Work query.

**Service layer** (`lib/services/workflow.service.ts`):
- Extend `listMyWork` to `entity_type IN ('dam_asset', 'deliverable')`. Keep the existing role-filter logic — it works as-is for deliverable transitions.
- New helper `ensureDeliverableWorkflowInstance(deliverableId)` — idempotent; creates a `workflow_instances` row at `needs_template` if one doesn't exist.

**Auto-create hook** — two triggers, both idempotent:
- On `campaign_assignments` insert where `assignment_role = 'primary_designer'`: for each deliverable on that campaign missing a workflow instance, create one.
- On `campaign_deliverables` insert where the campaign already has a `primary_designer`: create a workflow instance.
- Implementation: start with an application-level hook in the campaign-assignment + deliverable API routes (simpler, easier to test). Promote to a SQL trigger only if we see drift.

**API** — no new routes; existing `GET /api/asset-studio/workflows/my-work` returns the extended list.

**UI** (`components/asset-studio/my-work-tab.tsx`):
- Group items by campaign WF number.
- For `entity_type = 'deliverable'` items, render a card showing: channel + format (e.g. "Instagram Feed · 1080×1350"), quantity, stage chip, primary button "Start templating" (or "Resume", "Review", "Respond to feedback" depending on stage).
- Keep DAM asset cards as-is.

**Done when:** A Designer logged in as `designer@test.local` on a campaign with 3 deliverables sees all 3 in My Work, each with a "Start templating" button. Clicking advances the workflow to `drafting` and opens the template editor (Phase 2 wires the prefill).

---

### Phase 2 — Template editor prefilled from deliverable

The handoff that makes the queue feel intentional instead of decorative.

**Route** — extend `POST /api/asset-studio/templates` to accept an optional `deliverableId`. When present:
- Validate the caller can see the deliverable (campaign assignment or role = Producer/Creative Director).
- Pre-populate: `canvasWidth = deliverable.width`, `canvasHeight = deliverable.height`, `name = "{Campaign WF} — {channel} {format} ({width}×{height})"`, `campaignDeliverableId = deliverable.id`.
- Resolve copy: `coalesce(deliverable.headline_override, campaign.headline)`, same pattern for cta/disclaimer/legal.
- Pick brand tokens: use the campaign's brand if specified, else the org default.
- Auto-create four text layers (headline, CTA, disclaimer, legal) bound to the prefilled copy. Designer can delete or re-bind any of them.

**UI** — on each deliverable card in My Work, "Start templating" POSTs with `deliverableId` and redirects to `/asset-studio/templates/{id}/edit`.

**Template editor header** (`templates/[id]/edit/page.tsx`):
- When the template has `campaignDeliverableId`, render a breadcrumb: `[Campaign WF] › [Deliverable: Instagram Feed 1080×1350] › Template`.
- Add a "Back to My Work" button alongside the existing back-to-campaign arrow.

**Done when:** Clicking "Start templating" on an Instagram Feed 1080×1350 deliverable opens the editor with: a 1080×1350 canvas, four prefilled text layers with campaign copy, the campaign's brand tokens active, and a breadcrumb showing the deliverable context.

---

### Phase 3 — Status propagation back to campaign

Producer visibility without a second tool.

**Campaign detail page** (`app/(portal)/campaigns/[id]/page.tsx`):
- Add a "Deliverables" section (or enhance the existing `DeliverableCopyTile`) that shows, per deliverable: stage chip (needs template / drafting / in review / ready), assigned designer name + avatar, and "Open template" link if one exists.
- Header summary: "5 of 8 templates ready" with a progress bar.
- This is read-only; assignment changes happen in the existing creative team tile.

**API** — extend `GET /api/campaigns/[id]` response to include `deliverables[].templateStatus` and `deliverables[].templateId`. Single join against workflow_instances + asset_templates; no N+1.

**Done when:** A Producer on campaign detail sees which deliverables are done, in progress, or stuck, without opening Asset Studio.

---

### Phase 4 — Designer default landing = My Work

The one-line win that should have been there from the start.

**Route** — in `app/(portal)/asset-studio/page.tsx`, the default tab is role-aware:
- Designer → `my_work`
- Producer / Post Producer → `overview`
- Creative Director / Art Director → `variants` (approval queue) with fallback to `my_work`
- Admin → `overview`

**UI** — no other changes. The existing tabs stay; we're just changing the default landing.

**Done when:** `designer@test.local` logs in and clicks Asset Studio in the nav → lands on My Work with deliverable cards front-and-center.

---

## Role / permission notes

- Designer owns all template transitions end-to-end: start (`needs_template → drafting`), publish (`drafting → template_ready`), reopen (`template_ready → drafting`). This matches Storyteq — the designer is the template's author and its publisher.
- Art Director's role is unchanged by Sprint 7 — they remain versioning owners on variants, not template gate-keepers.
- Creative Director retains sole variant-approval authority. Templates publish without CD review; CD queue stays focused on final rendered creative.
- RLS on `campaign_deliverables` + `workflow_instances` + `asset_templates` already uses the `current_user_has_role` helper; no new policies needed, but verify the ALTER TABLE columns inherit correctly.

---

## Verification plan

1. **Local smoke**: create a new campaign, add 3 deliverables of different sizes, assign `designer@test.local` as primary_designer. Log in as designer → My Work shows 3 deliverable cards. Click "Start templating" on the first → template editor opens with correct canvas + copy + brand. Publish the template → card moves to `template_ready` and leaves the queue. Change the campaign headline → reopen the campaign's variant run → new variants render with the new headline automatically (template does NOT reopen; copy flows through bindings — Storyteq parity).
2. **Phase-1 verification** can ship before Phase 2 wires prefill; card shows "Start templating" and opens the Templates tab with deliverableId in the URL as a TODO marker until Phase 2 lands.
3. **RLS check**: Designer on Campaign A cannot see Campaign B's deliverables in My Work. Verify via two test users.
4. **Idempotency check**: reassigning the same designer twice does not create duplicate workflow instances. Renaming a deliverable does not reset its stage.
5. **Browser check** (preview_*): load `/asset-studio` as designer, snapshot the card list, click through one templating flow end-to-end. Screenshot for Laura.

---

## Out of scope (deferred)

- Multi-designer per deliverable. One assigned designer per deliverable; viewers still get read access via campaign.
- Template duplication from a prior deliverable. Future "clone template" is easy once FK exists but not part of this sprint.
- Deliverable-level due dates. Campaign due date is used for sort order; per-deliverable dates are a later refinement.
- Notifications on stage change. Reuses the existing notification infra; wire-up can land in Sprint 8 if we want per-stage pings.
- CSV/bulk deliverable import. Out of scope — assumes deliverables are created via the existing campaign UI.

---

## Decisions locked (2026-04-19)

1. **Storyteq model confirmed.** One deliverable = one template + N rendered variants downstream. A deliverable row "Instagram Feed 1080×1350, quantity 5" produces one template and 5 variants at render time.
2. **Designer self-approves.** No Art Director review step on templates. Stages: `needs_template → drafting → template_ready`. AD stays on variant-versioning.
3. **Copy changes flow through bindings (Storyteq parity).** When a campaign headline/CTA/disclaimer/legal changes, the template does **not** reopen. The template's text layers are bound to campaign fields; re-rendering the variant run pulls the latest copy automatically. Templates only reopen for *structural* changes (layout, dimensions, layer tree) — designer-initiated.
4. **All four phases ship as Sprint 7.** Tight but tractable, and Phases 3–4 are small once the workflow wiring is in.

Directive from Laura: *"Basically get this up and going like Storyteq, but using our assets from the DAM and campaign system."* Plan is anchored on that — lift the Storyteq model (Collaboration Hub → Adaptation Studio handoff, parameterized templates with bound copy, variant generation from templates + data) and bind it to greenroom's native campaigns, deliverables, DAM assets, and brand tokens.

---

## Companion docs

- Sprint 1: `asset-studio-sprint1-handoff.md`
- Sprint 2: `asset-studio-sprint2-handoff.md`
- Sprint 3: `asset-studio-sprint3-handoff.md`
- Creative reshape: `greenroom-asset-studio-plan.md` (078 applied)
- Storyteq brief: `storyteq-deep-dive.md`
