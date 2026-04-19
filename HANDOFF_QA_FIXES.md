# Handoff: Portal V2 QA Fix Sprint

**For**: Fresh Claude session picking up the QA fixes from the 2026-04-19 review
**From**: Laura (Head of Production at Publix Creative Studio — not a developer; uses plain language)
**Status**: Full QA review completed 2026-04-19. Two trivial fixes applied inline. ~30 issues documented and prioritized. This handoff covers what to do next.

---

## TL;DR

Read [`QA_REVIEW_2026-04-19.md`](QA_REVIEW_2026-04-19.md) for the full bug list with file:line citations. Then work through the **CRITICAL** fixes first (5 of them), pausing after each one for Laura to review. After Critical, move to **Major** (10 items). Don't touch anything under `/asset-studio` — that's a separate sprint.

---

## Project context

- **App**: Greenroom — production management portal for the Publix creative studio. Photo/video campaign workflow, vendor PO lifecycle, gear management, budget tracking.
- **Repo root**: `/Users/laura/Portal V2 Fresh/`
- **App code**: `portal-v2/`
- **Stack**: Next.js 16 (Turbopack), React 19, Tailwind v4, Supabase (Postgres + Auth + Storage), SWR, Zod
- **Important**: This Next.js version has breaking changes from training data — read `node_modules/next/dist/docs/` before touching framework patterns. See `portal-v2/AGENTS.md`.
- **Style rules**: Tile headers are `text-sm font-semibold uppercase tracking-wider`, icon `h-4 w-4` with `gap-2`, `border-b border-border`. Min text size 10px (`text-[10px]`). See `portal-v2/CLAUDE.md`.
- **Greenroom logo**: `/greenroom-logo.png` — it's an image, never style as text.
- **Current branch**: `feat/asset-studio-sprint6` (asset studio work is in flight on this branch — leave it alone)
- **Supabase**: project `rlhwnvddsefstggwvgsw` (us-east-2)

## Working with Laura

- Laura is the Head of Production, not a developer. Use plain language.
- Make technical decisions for her. Don't ask "should I use X or Y" — pick the better option and tell her what you did.
- Don't add features beyond what's in the fix plan. Don't refactor surrounding code.
- The creative team will judge the visual quality harshly — every UI change must look polished, not enterprise-y.
- WF numbers are always `WF######` (no dash). Never write `WF-######`.

---

## What was done in the QA review (2026-04-19)

1. Spawned 5 parallel code-analysis agents covering: auth/dashboards, campaigns, inventory, vendors/estimates, API/security.
2. Browser-tested all 7 roles (HOP, Producer, Studio, Vendor, Art Director, Post Producer, Designer) on local dev server.
3. Verified API-level role isolation by hitting sensitive endpoints as each role.
4. Applied 2 safe inline fixes (verified in browser):
   - `components/dashboard/hop-dashboard.tsx:209` — Pending Approvals tile `href="/approvals"` → `href="/budget"` (the `/approvals` route is 404)
   - `app/(portal)/gear/products/page.tsx:70-71` — breadcrumb `Inventory → /inventory` → `Gear → /gear` (no `/inventory` page exists)

## What's verified working

- API-level role gating (Designer/Studio both got 403 on `/api/budget`, `/api/vendors`, `/api/users`, `/api/payment-batches`, `/api/rate-cards`)
- Vendor data isolation at API level (Marcus Thompson got 403 trying to fetch a non-assigned campaign)
- Sidebar role gating (Studio omits Pre-Prod/Estimates/Post/Asset Studio/Budget; Vendor reduced to 4 items; AD omits Gear/Goals/Studio Mgmt)
- Per-role dashboards render distinctly (HOP budget-overview, Producer My Work/Team, Studio bay status, Vendor assignments, AD creative progress, Post Producer drives + edit rooms)
- All major pages load without errors

---

## Fix plan — work through in this order

For each fix below: read the file first, make the change, run the verification step, mark complete in your todo list. Pause after each CRITICAL fix and wait for Laura to confirm before moving on.

### CRITICAL — block ship

#### C-1. Designer dashboard renders empty
- **File**: `portal-v2/app/(portal)/dashboard/page.tsx` around line 31
- **Problem**: Switch statement on `user.role` has no `case "Designer"`; falls through to default loading skeleton that never resolves
- **Fix (fast path)**: Add `case "Designer": return <ProducerDashboard user={user} />;` (or whichever existing dashboard makes the most sense for designers — they're closest to Art Director in workflow)
- **Fix (proper path)**: Build a `DesignerDashboard` component that surfaces template builds, recent variants, approval queue from asset-studio. Defer to a separate sprint if scope is too large.
- **Verify**: Login as Designer (clear cookies → `/login` → click "Designer"). Dashboard should render content, not blank.

#### C-2. PO digital signature stores literal `"captured-server-side"` instead of real client IP
- **File**: `portal-v2/components/vendors/po-signature.tsx:57`
- **Problem**: The IP field on every signed PO is the literal string `"captured-server-side"`. Defeats the legal-evidence purpose — every signature in the DB has the same bogus value.
- **Fix**: Move IP capture to the server. In whichever API route receives the signature payload, read `request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown"` and store it on the signature record server-side. Stop trusting the client to send IP.
- **Verify**: Sign a PO as a vendor (login as Vendor → pick Sarah Chen → find a PO awaiting signature → sign it). Check the DB row for the signature: `ip_address` should be a real IP (or "127.0.0.1" / "::1" in dev), not "captured-server-side".

#### C-3. Silent failures in campaign mutation handlers
- **Files**:
  - `portal-v2/app/(portal)/campaigns/[id]/page.tsx` around line 186 — `handleUpdate`, `handleDelete`, `handleStatusChange`
  - `portal-v2/components/campaigns/campaign-row.tsx:80-86` — `patchCampaign` inline edit
- **Problem**: `fetch()` result not `.ok`-checked before `mutate()` / redirect runs. A 500 silently looks successful; user thinks edit saved but data is unchanged.
- **Fix**: Wrap each in try/catch. Pattern:
  ```ts
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error((await res.text().catch(() => res.statusText)) || "Update failed");
    await mutate();
    toast.success("Saved");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Update failed");
  }
  ```
  Use whatever toast helper the rest of the app uses (grep for `toast.error` to find the import).
- **Verify**: With dev tools open, throttle a request to fail (or temporarily kill the API by editing the route to throw). Edit a campaign field — should see a red error toast, not a fake success.

#### C-4. Budget POST/PATCH missing Zod validation (mass-assignment risk)
- **File**: `portal-v2/app/api/budget/route.ts:35-54`
- **Problem**: `createBudgetPool()` and `updateBudgetPool()` receive raw `await req.json()`. The service whitelists internally, but any future refactor lets attacker-controlled fields (`id`, `created_at`) reach DB.
- **Fix**: Mirror the pattern in `portal-v2/app/api/campaigns/route.ts`. Add:
  ```ts
  const createBudgetPoolSchema = z.object({
    name: z.string().min(1),
    total: z.number().nonnegative(),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    endDate:   z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  });
  const updateBudgetPoolSchema = createBudgetPoolSchema.partial();
  ```
  Use `.parse(body)` then pass the validated object to the service.
- **Verify**: Send a POST with extra junk fields → should still 200 but DB row shouldn't have them. Send a POST with missing `name` → should 400 with Zod error.

#### C-5. `/approvals` page deep-link
- **Status**: Partially fixed — HOP tile now links to `/budget`. But it should land on the Approvals tab, not Pools tab.
- **File**: `portal-v2/app/(portal)/budget/page.tsx`
- **Fix**: Add `useSearchParams` to read `?tab=approvals` and set the active tab on mount. Then change the HOP dashboard tile to `href="/budget?tab=approvals"`.
- **Verify**: From HOP dashboard, click the Pending Approvals tile — Approvals tab should be active when the page loads.

---

### MAJOR — fix before broader rollout

#### M-1. Studio sees Budget tile on campaign detail
- **File**: `portal-v2/app/(portal)/campaigns/[id]/page.tsx`
- **Problem**: Studio role sees full Budget breakdown ($35K total / $16.5K remaining / etc.) — per spec they should not see financials.
- **Fix**: Find where `BudgetSidebarTile` is rendered. Wrap in role check: `(userRole === "Admin" || userRole === "Producer" || userRole === "Post Producer") && <BudgetSidebarTile ... />`
- **Verify**: Login as Studio → open Spring Produce Hero campaign → no Budget tile.

#### M-2. Art Director sees Vendors section + statuses on campaign detail
- **File**: same as M-1
- **Problem**: AD sees vendor names + estimate statuses — per spec they should see creative content but no financials/vendors.
- **Fix**: Wrap VendorsTile / Vendors section in same role check as M-1 (omit Art Director).
- **Verify**: Login as Art Director → open campaign → no Vendors section.

#### M-3. Vendor InventoryTile has empty noop handlers
- **File**: `portal-v2/app/(portal)/campaigns/[id]/page.tsx` around line 467-469
- **Problem**: When vendor views campaign, props pass `onAddProduct={() => {}}` etc. If buttons render, they silently do nothing.
- **Fix**: Pass `canEdit={false}` (whatever the prop is) so the Add buttons don't render for vendors. Or remove the props entirely if `canEdit` already gates rendering.
- **Verify**: Login as Vendor → open an assigned campaign → no Add Product / Add Props / Add Gear buttons.

#### M-4. Crew bookings tile returns null on empty state
- **File**: `portal-v2/components/campaigns/tiles/crew-bookings-tile.tsx:113-115`
- **Problem**: When campaign has no bookings, the entire tile vanishes from the campaign detail. No "Book crew" CTA visible.
- **Fix**: Replace `return null` with empty state matching other tiles' pattern. Look at how `people-tile` or `vendors-tile` handle empty state for consistency.
- **Verify**: Find a campaign with no crew bookings → tile should render with "No bookings yet — Book crew" or similar.

#### M-5. Rate card delete has no confirmation
- **File**: `portal-v2/components/settings/rate-card-management.tsx:71-80`
- **Problem**: Single click deletes the rate card. Easy to nuke a $700/day Producer rate by accident.
- **Fix**: Add a confirm dialog. Match the pattern of other destructive confirms in the app — grep for `confirm` or `AlertDialog` to find the style. Message: `"Delete {role} rate card? This cannot be undone."`
- **Verify**: Settings → Rate Cards → click delete → should get a confirm modal, not instant deletion.

#### M-6. Invoice upload has no server-side file validation
- **File**: `portal-v2/app/api/invoices/route.ts:35-56`
- **Problem**: Client `accept=".pdf,.png,.jpg"` is a hint only. Server takes anything — including a 500 MB MP4 or a `.exe`.
- **Fix**: After parsing the file, validate:
  ```ts
  const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg"]);
  const MAX_BYTES = 10 * 1024 * 1024;
  if (!ALLOWED.has(file.type)) return new Response(JSON.stringify({ error: "PDF / PNG / JPG only" }), { status: 400 });
  if (file.size > MAX_BYTES)   return new Response(JSON.stringify({ error: "Max 10 MB" }), { status: 400 });
  ```
- **Verify**: As Vendor, try uploading a `.txt` file or a >10 MB file via the invoice endpoint — should 400.

#### M-7. CSV import returns silent zero on all-invalid rows
- **File**: `portal-v2/app/api/campaigns/import/route.ts:29-50`
- **Fix**: After filtering valid rows: `if (validRows.length === 0) return new Response(JSON.stringify({ error: "No valid rows in CSV" }), { status: 400 });`
- **Verify**: Upload a CSV where every row fails validation → should 400 with a useful message.

#### M-8. SWR fetchers across tiles don't validate `Array.isArray()`
- **Files**: `portal-v2/components/campaigns/tiles/people-tile.tsx:22-28` and similar
- **Approach**: Grep for `useSWR` across `components/campaigns/tiles/` and audit each one. If the data is expected to be an array, default to `[]` and validate `Array.isArray(data)` before `.filter()` / `.map()`.
- **Pattern**: `const items = Array.isArray(rawData) ? rawData : [];`
- **Verify**: No tile-level errors when an API briefly returns null/error.

#### M-9. No CSRF protection on mutating routes
- **Defer until**: Verify Supabase auth cookie has `SameSite=Lax` or `Strict`. If it does, this is defense-in-depth — lower priority.
- **If proceeding**: Add CSRF token check in `proxy.ts` for all POST/PATCH/DELETE outside `/api/auth/*`. Token issued on session start.

#### M-10. Wardrobe routes use manual validation instead of Zod
- **File**: `portal-v2/app/api/wardrobe/reservations/route.ts:22-39` and other wardrobe API routes
- **Fix**: Replace manual `if (!body.foo) return 400` with Zod schemas. Mirror the pattern from `app/api/campaigns/route.ts` or `app/api/gear/route.ts`.

---

### MINOR — polish (work in batches)

| # | File | Change |
|---|---|---|
| MN-1 | `app/(auth)/login/page.tsx:249` | Remove or dynamically render the "APRIL 14, 2026" date — it's stale (today's 2026-04-19) |
| MN-2 | `app/(portal)/food/page.tsx` | Page heading says "Food" but sidebar says "Products" — pick one (recommend "Products") |
| MN-3 | `app/(portal)/vendors/page.tsx:90` | Vendor cards have hover affordance but no click handler — either remove hover, or build the vendor detail page |
| MN-4 | `components/layout/sidebar.tsx` NAV_ITEMS | Add `/goals` to Art Director's role whitelist (their dashboard CTA links to it but nav doesn't show it) |
| MN-5 | Settings User Management | Role chip selector is missing "Designer" — add it |
| MN-6 | NotificationBell component | Click doesn't visibly open the popover — investigate |
| MN-7 | `components/layout/sidebar.tsx:32 + 179` | `SidebarPendingBadge` imported and `showPendingBadge` computed but never rendered — either render it or delete the dead code |
| MN-8 | `app/(portal)/studio/page.tsx:36-40` | SWR fetcher missing `.ok` check |
| MN-9 | `app/(portal)/wardrobe/page.tsx:1295` | `handleDeleteNote` lacks loading state |
| MN-10 | `app/(portal)/calendar/page.tsx:35-36` | SWR fetcher missing `.ok` check |
| MN-11 | `lib/services/notifications.service.ts:85-150` | `notifyCampaignProducers` missing dedup |
| MN-12 | `components/campaigns/vendor-lifecycle-modal.tsx:344-346` | Optimistic state update before server confirms — race risk |
| MN-13 | `app/(auth)/login/page.tsx:48` | `fetchDemoVendors` only `console.error`s on failure — show user-facing error |
| MN-14 | `app/(portal)/pre-production/page.tsx:33-40` | Empty state vs skeleton conditional is muddled — simplify |

### TRIVIAL

- T-1: `app/(auth)/login/page.tsx:135-136` — "Placeholder - Single Sign On" disabled button looks unfinished. Hide until SSO is real.
- T-2: "Add person" button on PEOPLE tile (Producer view) — verify it actually opens a modal
- T-3: "Reset Naming" button on shot list — needs a tooltip/confirm explaining what it resets

---

## How to test as each role

Dev login at `http://localhost:3000/login`. Click any role button — it logs you in instantly with a seeded test account. To switch roles, clear cookies first:

```js
// Run in browser dev tools console:
document.cookie.split(';').forEach(c => {
  const eq = c.indexOf('=');
  const name = eq > -1 ? c.substring(0, eq).trim() : c.trim();
  document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
});
window.location.href = '/login';
```

Test users (per `~/.claude/projects/-Users-laura-Portal-V2-Fresh/memory/project_build_status.md`):
- `admin@test.local` / `testpass123456` → Gretchen (HOP / Admin)
- `producer@test.local` / `testpass123456` → Laura (Producer)
- `studio@test.local` / `testpass123456` → Astasia (Studio)
- `vendor@test.local` / `testpass123456` → Marcus (Vendor — Lightbox Studios). Also can pick Sarah Chen / Elizabeth Ross / etc. via vendor picker.
- Art Director, Post Producer, Designer dev-login buttons are visible on the login page

## Dev server

```bash
# Use the preview tools, not raw bash:
preview_start name="portal-v2-dev"
```

Config in `.claude/launch.json`. Server runs on `http://localhost:3000` with Turbopack. Already in `autoPort` mode.

## Verification workflow

After each fix, before marking done:
1. `preview_start` (reuses existing server)
2. Reload affected page (`window.location.reload()` or navigate away + back)
3. `preview_console_logs level=error` — no new errors
4. `preview_network filter=failed` — no new 4xx/5xx
5. Reproduce the bug from the QA review and confirm it's fixed
6. Test once with the role mentioned in the bug, once with a different role to make sure you didn't break that view

For UI changes: take a `preview_screenshot` to share with Laura.

## Don't touch

- **`/asset-studio` (anywhere)** — separate sprint, work-in-progress on this branch. Hands off:
  - `app/(portal)/asset-studio/`
  - `app/api/asset-studio/`
  - `components/asset-studio/`
  - `lib/services/templates.service.ts`, `runs.service.ts`, `variants.service.ts`, `render.service.ts`, `render-jobs.service.ts`, `run-csv.service.ts`
  - `lib/validation/asset-studio.ts`
  - `types/domain.ts` (only the asset-studio additions)
- **Migrations 068-074** — already applied to prod Supabase
- **Auth/SSO infrastructure** — out of scope per Laura
- **DAM placeholder** — placeholder is fine
- **Anything that requires changing CLAUDE.md / AGENTS.md** — ask first

## When done

Update [`QA_REVIEW_2026-04-19.md`](QA_REVIEW_2026-04-19.md) — mark items fixed in-line (don't delete, just add `✅ Fixed YYYY-MM-DD` after the bug). Then commit with a message that lists which fix IDs landed (e.g., "QA fixes C-1, C-2, C-3, M-1, M-2"). Don't push or open a PR until Laura asks.

## Memory

Auto-memory at `~/.claude/projects/-Users-laura-Portal-V2-Fresh/memory/`. Read `MEMORY.md` index first. Especially relevant:
- `feedback_design.md` — design must impress the creative team (no enterprise look)
- `feedback_communication.md` — plain language, decide for her
- `feedback_wfnumber_format.md` — `WF######` no dash
- `feedback_tile_headers.md` — uppercase, text-sm, icon + gap-2, border-b
- `feedback_preview_verification.md` — verify in browser when changes are observable

Save new memory if you discover guidance worth keeping. Don't save things derivable from code.
