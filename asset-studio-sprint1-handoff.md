# Asset Studio — Sprint 1 Handoff

Drop this into the next chat as context. It's self-contained: where we are,
what shipped, what to do next, and the few quirks that bit us last time.

---

## TL;DR

Sprint 1 of `greenroom-asset-studio-plan.md` Section 12 is built and
committed locally on `feat/asset-studio`. The branch is **not pushed** and
migrations 068 + 069 are **not applied to Supabase** yet. Typecheck and
lint were clean at commit time. Next chat should confirm whether to
push + open a PR + apply migrations, or keep iterating locally.

---

## Current state

- **Branch:** `feat/asset-studio` (off `main`, no upstream set)
- **Head commit:** `39890c5` — "Asset Studio: Sprint 1 — templates, runs, variants, brand tokens"
- **Diff:** 42 files changed, +5,972 insertions
- **Remote:** `origin → git@github.com:laurawardrobinson-design/greenroom-portal.git`
- **Remaining untracked (intentionally not staged):** parent-dir media uploads
  (`shape_*.png`, `*.mp4`, `*.gif`), `node_modules/`, `portal-v2/Image creation/`,
  `portal-v2/assets/branding/` (AI logo experiments), `portal-v2/supabase/.temp/`,
  `greenroom-asset-studio-plan.md`, `storyteq-deep-dive.md`, and this handoff.

## Sprint 1 scope check against Section 12

| # | Task | Status |
|---|---|---|
| 1 | Migration adding Designer role + asset-studio tables + RLS + indexes | Done (068). Six tables: `brand_tokens`, `templates`, `template_layers`, `template_output_specs`, `variant_runs`, `variants`. Designer enum added via `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Designer'`. |
| 2 | Storage buckets (`templates`, `variants`, `brand-assets`) + RLS | Done (069) |
| 3 | Service layer skeletons (`templates`, `runs`, `variants`, plus `brand`, `render`, `asset-studio`) | Done. **Note:** no Zod schemas yet — Phase 0 wishlist mentioned them; Section 12 didn't require. Validation today is light (TS types + DB constraints). Worth adding before opening to outside contributors. |
| 4 | Sidebar entry + `/asset-studio` shell with 6 tabs | Done. Sidebar entry was added in prior commit `9e2a912` (with `Designer` already in `lib/auth/roles.ts` perms). Sprint 1 commit added the shell + Overview / Templates / Runs / Variants / Brand. Channels is a placeholder. |
| 5 | Template Builder MVP — text / image / logo layers, dynamic/lock toggles, 1080² + 1080×1350 + 1080×1920 output specs | Done |
| 6 | Run Builder MVP — pick template, campaign, products, output specs, optional copy overrides; queue + kick off | Done |
| 7 | Inline render via `sharp` into `variants` bucket | Done |
| 8 | Variant gallery + approve/reject + bulk approve; Run Detail with live polling while rendering | Done |
| 9 | Publix brand tokens v1 seed (`#69A925`, `#10442B`, Inter stack, `/greenroom-logo.png`) | Done (069) |
| 10 | Test user `designer@test.local` | Half done. 069 has a conditional insert into `public.users` that fires only if the matching `auth.users` row already exists. Someone still needs to create the auth row via Supabase admin API (same pattern as `admin@test.local` / `producer@test.local`), then re-run 069 or insert manually. |

### Phase 0 wishlist items deferred (not in Section 12 scope, but flag-worthy)

- **`variant_approvals` table** — Section 12 deferred this; current implementation tracks approval state inline on `variants.status`. Fine for single-stage approval; Phase 2 multi-stage will want the dedicated table.
- **`locales` + `template_layer_strings`** — Phase 2 work, not in this sprint.
- **Zod validation in services / API routes** — see task 3 note above.
- **Shared `app/(portal)/asset-studio/layout.tsx`** — Plan §7.10 suggests setting `data-area="asset-studio"` once on a shared layout. Today each page sets it individually (page.tsx, runs/new, runs/[id], templates/[id]/edit). Works fine, but a 5-line `layout.tsx` would DRY it up.

## File map (what landed in the commit)

```
portal-v2/
├─ app/
│  ├─ globals.css                                  # +--as-* CSS vars scoped via data-area
│  └─ (portal)/asset-studio/
│     ├─ page.tsx                                  # tabbed shell, ?tab= deep links
│     ├─ templates/[id]/edit/page.tsx              # Template Builder
│     ├─ runs/new/page.tsx                         # Run Builder
│     └─ runs/[id]/page.tsx                        # Run Detail (live poll while rendering)
│  └─ api/asset-studio/
│     ├─ summary/route.ts
│     ├─ brand-tokens/{route,[id]/route,[id]/activate/route}.ts
│     ├─ templates/{route,[id]/route,[id]/layers/…, [id]/output-specs/…}
│     ├─ runs/{route,[id]/route,[id]/render/route,[id]/refresh/route}.ts
│     └─ variants/{route,[id]/route,[id]/approve/route,[id]/reject/route}.ts
├─ components/
│  ├─ ui/page-tabs.tsx                             # icon prop widened to ElementType
│  └─ asset-studio/{overview,templates,runs,variants,brand,channels}-tab.tsx + lib.ts
├─ lib/services/{asset-studio,brand,render,runs,templates,variants}.service.ts
├─ supabase/migrations/
│  ├─ 068_asset_studio_core.sql                    # enum + tables + RLS + indexes
│  └─ 069_asset_studio_storage_and_seed.sql        # buckets + seed tokens
├─ types/domain.ts                                 # +BrandTokenSet, VariantRun, etc.
├─ package.json / package-lock.json                # +sharp
```

---

## Suggested next moves (in priority order)

1. **Decide push/PR cadence.** Push `feat/asset-studio` and open a draft PR
   so CI has a chance to catch anything the local env missed. If GitHub
   Actions runs migrations against a preview DB, this is also the cleanest
   way to validate 068 + 069 end-to-end.
2. **Apply migrations to Supabase.** `supabase db push` (or whatever the
   team's normal migration workflow is). 068 adds an enum value + tables;
   069 creates storage buckets and seeds one brand token set. Both are
   idempotent on re-run (`IF NOT EXISTS`).
3. **Finish the `designer@test.local` seed.** Create the auth row via
   Supabase admin API (mirror `producer@test.local`), then re-run 069 so
   the conditional `public.users` insert fires.
4. **Smoke the demo flow on the real DB:**
   `template → run → 30 variants (10 products × 3 specs) → approve → download zip`.
   That's the contractual "done" line for Section 12.
5. **Tighten before moving on:**
   - Add Zod schemas in services + API routes (Phase 0 wishlist item).
   - DRY `data-area="asset-studio"` into a shared `layout.tsx` (§7.10).
6. **Then** pick between:
   - **Phase 1 polish** (Plan §9) — CSV mode Run Builder, audit log, email-to-producer channel, zip export endpoint, brand-console edits.
   - **Phase 2 start** (Plan §9) — HTML5 layout engine, locales (adds `locales` + `template_layer_strings`), multi-stage approvals (adds `variant_approvals`).
   - **Channels tab** (currently a placeholder) — at least stub Meta push.

Laura's decision from last session was "Phase 0 + Phase 1 MVP first; real
demo before committing to Phase 2." Sprint 1 = Phase 0 + a chunk of Phase 1.
A second sprint to finish Phase 1 is the logical next slice.

## Open questions to surface with Laura at session start

- Push branch + open PR now, or keep rebasing locally?
- Apply 068/069 to the prod Supabase, or only staging first?
- Is Storyteq's "variant set" concept worth mirroring before Phase 2, or
  deferred? (Affects whether we add a `variant_sets` table now.)
- Channel priorities if we jump ahead: Meta first, or Pinterest first?

---

## Validation commands (from `portal-v2/`)

```bash
pnpm typecheck
pnpm lint
pnpm dev                                    # then visit /asset-studio
# For migrations against local supabase:
supabase db reset                           # or `supabase db push` for additive
```

Last time we ran it: typecheck 0 errors, lint 0 errors / 0 warnings.

---

## Quirks that bit us last session (save future-you the debugging)

1. **Sandbox can't unlink inside `.git/`.** `git add` / `git commit` print
   a flurry of `warning: unable to unlink '.git/objects/…/tmp_obj_…'`. These
   are harmless — git's trying to clean its own temp objects and the
   sandbox blocks deletes under `.git/`. The commit still completes; the
   tmp objects get reaped later by `git gc` on Laura's host.

2. **Stale `.git/index.lock` recovery.** If a previous run crashed and the
   lock is still there, the sandbox can't remove it (same unlink rule).
   Ask Laura to run in her terminal:
   ```bash
   cd "/Users/laurarobinson/Portal V2 Fresh" && rm -f .git/index.lock
   ```
   We also observed a short-lived mount-cache drift where the sandbox saw
   the lock after Laura had removed it. A fresh `ls -la` in the sandbox
   usually refreshes it within a second or two.

3. **No git identity in the sandbox.** Commits need per-invocation env vars
   — do NOT `git config --global` anything. Pattern:
   ```bash
   GIT_AUTHOR_NAME="Laura Robinson" \
   GIT_AUTHOR_EMAIL="laurawardrobinson@gmail.com" \
   GIT_COMMITTER_NAME="Laura Robinson" \
   GIT_COMMITTER_EMAIL="laurawardrobinson@gmail.com" \
   git commit -m "…"
   ```

4. **Next.js 16 async params.** Any route handler or page under a
   `[param]` segment now receives `params: Promise<{…}>`. Client components
   unwrap with `use(params)`; server routes `await params`. The new pages
   already follow this — mimic them.

5. **SWR live polling pattern.** `useSWR(url, fetcher, { refreshInterval:
   (latest) => latest && (latest.status === "queued" || latest.status ===
   "rendering") ? 3000 : 0 })` — hooks must be unconditional, so guard with
   `run?.variants ?? []` rather than early-returning before the hook.

6. **PageTabs icon typing.** The shared component takes
   `icon: ElementType<{ className?: string }>` (not `ComponentType`) so
   lucide-react icons pass cleanly. If you add a new tabbed page and the
   typecheck complains about `ForwardRefExoticComponent` vs `ComponentType`,
   it's because that page is on an older copy — update it to the new type.

7. **Files to keep untracked forever.** `portal-v2/supabase/.temp/` and
   `portal-v2/Image creation/` are generated / scratch. Don't stage them.

---

## Quick-start for the next chat

Paste this at the top of the next session:

> Continuing Asset Studio work. We're on `feat/asset-studio` at `39890c5`
> with Sprint 1 committed locally (templates, runs, variants, brand tokens).
> Migrations 068 + 069 exist but aren't applied yet; branch isn't pushed.
> `designer@test.local` is half-seeded — `public.users` insert is in 069
> but waits on the `auth.users` row being created via Supabase admin API.
> Zod schemas, `variant_approvals`, `locales`, and a shared
> `app/(portal)/asset-studio/layout.tsx` were intentionally deferred. Read
> `asset-studio-sprint1-handoff.md` at the repo root for the full picture,
> then ask me what to prioritise — push + PR, migrate + smoke the demo,
> finish the seed user, or start Phase 1 polish.
