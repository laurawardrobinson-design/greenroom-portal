# Asset Studio — Sprint 2 Handoff

Drop this into the next chat as context. Companion to `asset-studio-sprint1-handoff.md`. Written 2026-04-18 at the close of Sprint 2.

---

## TL;DR

Sprint 1 (Phase 0 + chunk of Phase 1) and Sprint 2 (rest of Phase 1 minus video/HTML5) are both shipped and live. Branch `feat/asset-studio` is pushed, PR [#19](https://github.com/laurawardrobinson-design/greenroom-portal/pull/19) is ready-for-review. Migrations 068 + 069 + 070 + 071 are applied to prod Supabase `rlhwnvddsefstggwvgsw`.

The demo flow works end-to-end: Designer signs in → builds or edits a template with drag / upload / color picker / live preview → publishes (auto-snapshots v1) → creates a run via grid OR paste-list → renders mixed PNG/JPG/WEBP → bulk approves → downloads a zip.

Next chat should decide whether Sprint 3 is Phase 2 (HTML5 + locales + multi-stage approvals) or a smaller polish sprint (per-row CSV binding overrides + audit log + email-to-producer + Zod).

---

## What shipped (cumulative)

### Migrations (all applied to prod Supabase)

| # | What it does | Gotchas |
|---|---|---|
| 068 | Designer enum value; `brand_tokens`, `templates`, `template_layers`, `template_output_specs`, `variant_runs`, `variants` tables; indexes; initial RLS | RLS was wrong on arrival (used `auth.jwt() ->> 'role'` which is NULL in this app). 070 fixes. |
| 069 | 3 storage buckets (`templates`, `variants`, `brand-assets`); Publix brand-tokens v1 seed; conditional `designer@test.local` profile | Linter will flag "destructive operations" + "designer_id missing RLS" — both false positives. Run without RLS. |
| 070 | RLS hotfix: `public.current_user_has_role(text[])` SECURITY DEFINER helper + rewrites every role-gated policy on 6 tables + 3 storage policies; `NOTIFY pgrst, 'reload schema'` | The role column is the `user_role` enum — the helper casts with `role::text = ANY(allowed)`. Don't skip the cast. |
| 071 | `template_versions` immutable snapshots; `templates.current_version_id`; `variant_runs.template_version_id`; helper RLS | `getTemplate` has a fallback second query for the rare window where PostgREST hasn't refreshed its FK graph. |

### Features shipped

**Template editor (`/asset-studio/templates/[id]/edit`):**
- Layer tree (text / image / logo / shape) with dynamic/lock toggles
- **Drag-to-reposition** layers in the canvas (pointer-events, optimistic overrides, PATCH on release)
- Numeric X/Y/W/H inputs
- **Upload button** on image/logo static-source (writes to `brand-assets`, shows thumbnail)
- **Color picker** (type=color) + hex text input for text layers
- Font size / weight / align controls
- Fit control (`cover` / `contain` / `fill`) for image/logo
- **Live preview** modal — renders single variant with real campaign-product data; per-spec switcher
- **Version history** dropdown — Save as new + Restore (auto-snaps current state first so it's reversible)
- **Fullscreen** mode (Escape or ⌘. to toggle, hides sidebar/topbar/padding)
- Responsive canvas (aspect-ratio based, fits any column width)

**Run Builder (`/asset-studio/runs/new`):**
- Template picker (published-only by default; falls through to all templates if a draft is pre-selected via `?templateId=`)
- Campaign picker
- Products step with **Grid / Paste list** toggle — paste-list accepts SKU / item_code / name / UUID, flags unmatched rows
- Output-spec picker (multi-select)
- Copy overrides for dynamic text bindings (global; per-variant is deferred)
- Summary sidebar with live variant-count math
- "Create & render now" or "Create as queued"

**Run detail (`/asset-studio/runs/[id]`):**
- SWR-polled status while rendering
- Filter by status (all / pending review / approved / rejected / failed)
- Bulk-approve (Producer / Admin / Post Producer)
- **Download zip** button — auto-selects approved count, falls back to rendered
- Per-variant approve/reject with reason

**APIs added:**
- `GET /api/asset-studio/runs/[id]/zip?status=approved|rendered|all` — streaming zip (archiver)
- `POST /api/asset-studio/uploads` — multipart upload to `brand-assets` / `templates` buckets (10 MB cap, mime allowlist)
- `POST /api/asset-studio/templates/[id]/preview` — on-demand single-variant render
- `GET /api/asset-studio/templates/[id]/versions` — version history
- `POST /api/asset-studio/templates/[id]/versions` — "Save as new version"
- `POST /api/asset-studio/templates/[id]/versions/[versionId]/restore`
- `POST /api/asset-studio/seed-product-images` — one-shot product library seeder

**Seeded content in prod:**
- `brand-assets/products/<sku>.jpg` — 17 Publix product-on-white shots, stable URLs we own. Seeder: `portal-v2/scripts/seed-product-images.mjs` (service-role, ~6s for all 17).

**Render pipeline:**
- Sharp-based, routes output format per spec (PNG default, JPG quality 90, WEBP quality 92)
- Fetches remote image URLs for image/logo layers, resizes per `fit`
- Composites SVG-generated text layers
- Uploads to `variants/<runId>/<variantId>.<ext>` with correct content-type

**Test users:**
- Dev login page now has a **Designer** button
- `designer@test.local` / `testpass123456` / "Daniel" — seeded end-to-end
- Switch to Producer for bulk-approve (Designer UI gate is intentional; RLS allows Designer)

---

## Verification facts (from the Sprint 2 smoke)

- Template `Publix Product Hero v1` (`5fc1b64c-e037-42be-8be9-04491c650334`) has 4 layers + 4 output specs (3 PNG + 1 JPG). `current_version_id = 7c7f09bd-c627-49ed-bf49-9af30057e9bc`.
- Run `31008661-a41c-472f-a999-b1e0b8d34448` (3 products × 4 specs = 12 variants): all rendered in ~5 s, 9 PNG + 3 JPG, all approved, 8.4 MB zip.
- Earlier Sprint 1 run `0ae9fd4c-c8ae-4011-900d-aee5583f761d` (10 × 3 = 30) also approved and downloadable.
- Summer Grilling Hero campaign (`a1b2c3d4-1111-4aaa-bbbb-000000000001`, WF260401) has 10 products linked.

---

## Critical gotchas for the next sprint

1. **RLS helper, every time.** When adding any new role-gated table in a migration, use `public.current_user_has_role(ARRAY['Admin','Producer','Designer',...])` in WITH CHECK / USING. Do NOT write `auth.jwt() ->> 'role'`. See 070 for the helper; it's `STABLE SECURITY DEFINER` and casts the `user_role` enum to text.

2. **Remember `NOTIFY pgrst, 'reload schema'`** at the end of any schema-changing migration so PostgREST's FK graph stays fresh. Without it, `getX()` joins that traverse new tables can 404 for up to ~30s after the migration lands.

3. **Enum casts.** `public.users.role` is the `user_role` enum. Helpers that compare it to a `text[]` must cast (`role::text = ANY(...)`). Postgres won't auto-coerce.

4. **Templates are mutable by design; versions are immutable.** Edits to `templates` / `template_layers` / `template_output_specs` rows happen in place (the editor PATCHes live). A snapshot is only frozen on publish. So `variants.bindings` and any other per-render provenance should point to `variant_runs.template_version_id`, not `templates.*`. The mutate-template-then-read-variant trap has bitten plenty of Storyteq-adjacent tools.

5. **Designer role access surface.** Designer can read everything Asset-Studio, write templates/layers/specs/brand-tokens, and create runs. Designer **cannot** write campaign-products (`/api/campaign-products` POST is Producer-and-up) and is UI-gated out of bulk-approval (§10 of plan; RLS allows, UI hides).

6. **Dev server memory.** Next 16 with Turbopack and our editor surface is heavy. Cap with `NODE_OPTIONS='--max-old-space-size=2048' npm run dev` if you're on a 16 GB Mac and compile times spike past 30 s.

7. **Sandbox can't kill `.git/index.lock`.** If a commit hangs and leaves a stale lock, the sandbox can't delete it — Laura runs `rm -f .git/index.lock` in her own terminal. Also: git identity must be per-invocation env vars; no global `git config`.

---

## Where to go next — three options

### Option A — Phase 2 (ambitious, 3-4 weeks at this pace)
1. **HTML5 layout engine** for banner-style templates + Puppeteer render worker (separate service, not inline sharp).
2. **Locales**: `locales` table + `template_layer_strings`, per-variant translation layer. Start with `en-US` / `es-US`.
3. **Multi-stage approvals**: `variant_approvals` table. Designer → Art Director → Producer gate. Feature flag per template.
4. **Brand token version migration banner** — warn when a template uses a deprecated brand version.

### Option B — Phase 1 polish (smaller, 1-2 weeks)
1. **Per-row CSV binding overrides** — backend change so each row can carry its own `copy.*` overrides, not just a global dict. This is the real Storyteq Batch Creator pattern.
2. **Audit log** for approvals — simple `asset_studio_audit_log` table + API + a feed on the run detail page.
3. **Email-to-producer** on run complete — uses the existing notification system, sends a link to the zip.
4. **Zod schemas** for services + API routes — defensive validation that Phase 0 wishlist flagged.
5. **Shared `(portal)/asset-studio/layout.tsx`** to DRY the `data-area` attribute (currently set on every page).

### Option C — Storyteq "wow" push (higher leverage, but narrower)
1. **Figma plugin bridge** (Phase 5) — one-way export from Figma selection into a new template. This is the single biggest "designer adoption" move per the plan. Roughly 2 weeks.
2. **AI smart-crop** (Phase 4) — on upload, use sharp + saliency to pick a crop per output spec rather than just `cover`/`contain`. Big UX win on retail shelf photos.
3. **Meta Ads Manager push** (Phase 6) — replace "download zip" with "push to Meta creative library." Requires Meta API creds + OAuth.

My read: **Option B first, then A.** Phase 1 polish is what makes this shippable as a daily tool. Multi-stage approvals (A) + per-row CSV (B) are the two features most likely to be asked for at first contact with the production team.

---

## Open questions to surface at session start

1. Does Laura want Phase 2 ambition (HTML5/locales/multi-stage) or Phase 1 polish first?
2. Is the `designer@test.local` user staying in prod, or are we cutting it from production-only Supabase? (Currently in.)
3. Should we add `Art Director` to the UI approval gate, or keep it Producer-only?
4. **Zip export lifecycle:** should approved variants also get a permanent public URL, or stay inside the zip download flow? Meta push (Phase 6) will want URLs.
5. **Brand tokens:** the Publix seed is still a placeholder pulled from `globals.css`. A 30-minute conversation with a real Publix designer is blocking proper brand governance. Still owed.

---

## File map — what's in the branch

```
portal-v2/
├─ app/
│  ├─ (auth)/login/page.tsx                        # +Designer button
│  └─ (portal)/asset-studio/
│     ├─ page.tsx                                  # shell (Sprint 1)
│     ├─ templates/[id]/edit/page.tsx              # editor — all Sprint 2 features live here
│     ├─ runs/new/page.tsx                         # grid/paste-list toggle
│     └─ runs/[id]/page.tsx                        # live poll + bulk approve + zip CTA
│  └─ api/asset-studio/
│     ├─ summary/
│     ├─ brand-tokens/...
│     ├─ templates/
│     │  ├─ route.ts
│     │  └─ [id]/
│     │     ├─ route.ts                            # PATCH snapshots on publish
│     │     ├─ layers/...
│     │     ├─ output-specs/...
│     │     ├─ preview/route.ts                    # NEW: on-demand single-variant render
│     │     └─ versions/
│     │        ├─ route.ts                         # GET + POST "save as new"
│     │        └─ [versionId]/restore/route.ts     # POST restore
│     ├─ uploads/route.ts                          # NEW: multipart upload endpoint
│     ├─ seed-product-images/route.ts              # NEW: one-shot seeder
│     ├─ runs/
│     │  ├─ route.ts                               # createRun pins template_version_id
│     │  └─ [id]/
│     │     ├─ route.ts
│     │     ├─ render/route.ts
│     │     ├─ refresh/route.ts
│     │     └─ zip/route.ts                        # streaming archiver zip
│     └─ variants/...
├─ components/asset-studio/                        # tab surfaces (Sprint 1)
├─ lib/services/
│  ├─ templates.service.ts                         # +snapshotTemplateVersion, listTemplateVersions, restoreTemplateVersion
│  ├─ render.service.ts                            # +renderTemplatePreview, format routing (PNG/JPG/WEBP)
│  ├─ runs.service.ts                              # binds run to current_version_id
│  ├─ brand.service.ts
│  └─ variants.service.ts
├─ scripts/
│  └─ seed-product-images.mjs                      # NEW: Node seeder (service-role)
├─ supabase/migrations/
│  ├─ 068_asset_studio_core.sql
│  ├─ 069_asset_studio_storage_and_seed.sql
│  ├─ 070_asset_studio_rls_fix.sql                 # RLS via public.users
│  └─ 071_asset_studio_template_versions.sql
└─ types/domain.ts                                 # +TemplateVersion, +TemplateVersionSnapshot, currentVersionId, templateVersionId
```

---

## Quick-start for the next chat

Paste this at the top of the next session:

> Continuing Asset Studio. Sprint 1 + Sprint 2 are done and on `feat/asset-studio` (PR #19). Migrations 068/069/070/071 applied to prod Supabase `rlhwnvddsefstggwvgsw`. 17 product-on-white shots seeded at `brand-assets/products/`. Demo flow verified end-to-end: template → run → mixed-format variants → approve → zip.
>
> Read `asset-studio-sprint2-handoff.md` at the repo root for the complete picture, then ask me what Sprint 3 should be — Phase 2 ambition (HTML5 + locales + multi-stage approvals), Phase 1 polish (per-row CSV + audit log + email-to-producer + Zod), or Phase 5 Figma bridge.
