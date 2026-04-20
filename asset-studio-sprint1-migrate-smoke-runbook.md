# Asset Studio — Sprint 1 Migrate + Smoke-Test Runbook

Companion to `asset-studio-sprint1-handoff.md`. This is the step-by-step to
get 068 + 069 applied, `designer@test.local` fully seeded, and run the
`template → run → 30 variants → approve` demo. Written on 2026-04-18
against `feat/asset-studio` @ `39890c5`.

---

## TL;DR — what's actually in the way

Before running anything, decide on three things:

1. **Target Supabase project.** Staging first, prod second. This runbook
   assumes you'll point the CLI / SQL editor at one project at a time. If
   you don't have a separate staging project, pick local dev Supabase
   first and flag `Decision A` below.
2. **Migration application path.** The repo has no CI migration job and
   no `supabase/config.toml`, so migrations aren't auto-applied. Two
   sane options:
   - **A)** Supabase CLI linked to the remote project: `supabase link`
     once, then `supabase db push`. Each file runs in its own
     transaction — safest.
   - **B)** Paste SQL directly into the Supabase Studio SQL editor.
     Works, but **do not paste 068 + 069 as one block**: 068 adds the
     `'Designer'` enum value, which Postgres won't allow to be used in
     the same transaction. Run 068 first, confirm it commits, then run
     069.
3. **Three code gaps you'll hit during the smoke test.** Fix ahead, or
   accept a partial demo:
   - `app/api/auth/dev-login/route.ts` — `TEST_USERS` dict has no
     `designer` entry. POSTing `{"role":"designer"}` will return
     `Invalid role`. Three-line patch to fit the existing pattern (see
     §3 below).
   - `app/(portal)/asset-studio/runs/[id]/page.tsx` line 88 —
     `canApprove` is `['Admin','Producer','Post Producer']`. **Designer
     cannot bulk-approve.** RLS in 068 allows it; only the UI gates it.
     If the demo is "designer runs the whole flow end-to-end", either
     add `'Designer'` to `canApprove` or plan to switch to Producer
     before the approve step.
   - **No zip export endpoint exists.** The handoff's "done line" of
     `…approve → download zip` can't actually complete today. Options:
     end the demo at "Approve all", or build a quick zip endpoint
     first (Phase 1 polish item).

Nothing below requires those fixes to be *done* — the runbook works
either way — but knowing them up-front lets you decide what the demo
ends at.

---

## 0. Pre-flight

All commands run from `portal-v2/` unless noted.

```bash
cd "/Users/laura/Portal V2 Fresh/portal-v2"

# Confirm you're on the right commit.
git status                       # should show feat/asset-studio, dirty with
                                 # the intentionally-untracked media/experiments
git log --oneline -1             # expect 39890c5

# Pre-PR sanity (matches RELEASE_PLAYBOOK.md § 3).
# NOTE: the handoff said `pnpm …` — this repo actually uses npm
# (package-lock.json, no pnpm lockfile). Use:
npm run lint
npm run test
npm run build                    # typecheck is part of next build
```

If `build` is clean, you've already validated that the new services /
routes / pages typecheck against the whole project. Don't skip it — this
is our typecheck substitute.

---

## 1. Apply migrations 068 + 069

Both migrations are **idempotent on re-run** (`IF NOT EXISTS`,
`ON CONFLICT DO NOTHING`). You can safely re-apply.

### Path A — Supabase CLI (recommended)

```bash
# One-time per project.
supabase link --project-ref <your-staging-project-ref>

# Dry-run: see what will be applied.
supabase db push --dry-run

# Apply.
supabase db push
```

Expected result:

- Enum value `'Designer'` added to `user_role` (068).
- Six new tables: `brand_tokens`, `templates`, `template_layers`,
  `template_output_specs`, `variant_runs`, `variants`.
- Three new storage buckets: `templates`, `variants`, `brand-assets`.
- One `brand_tokens` row seeded (`Publix`, version 1, active).
- A `NOTICE` fires in 069 if `designer@test.local` doesn't exist in
  `auth.users` yet — that's expected on first run (see §3).

### Path B — Supabase Studio SQL editor

1. Open the **068** file contents in the SQL editor → Run → wait for
   `Success`.
2. Open the **069** file contents in a fresh query tab → Run.

Do **not** paste both files into one query. Postgres will reject the
use of the freshly-added `'Designer'` enum value in the same transaction.

### Verification (either path)

```sql
-- Enum has Designer
SELECT unnest(enum_range(NULL::user_role));

-- Six tables + brand_tokens seed
SELECT count(*) FROM brand_tokens WHERE brand = 'Publix' AND is_active;
-- expect 1
SELECT count(*) FROM templates;                  -- 0 is fine
SELECT count(*) FROM variant_runs;               -- 0 is fine

-- Buckets
SELECT id FROM storage.buckets
WHERE id IN ('templates', 'variants', 'brand-assets');
-- expect 3 rows
```

---

## 2. Environment variables

For local dev + smoke test you need (from `.env.local.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**For the dev-login flow in §3, also set:**

```env
NEXT_PUBLIC_DEV_AUTH=true
```

This flag is explicitly gated in `dev-login/route.ts` (lines 26–28) and
`RELEASE_PLAYBOOK.md § 6` says to leave it unset in production. Setting
it locally is fine; remember to keep it unset on Vercel.

---

## 3. Seed `designer@test.local` fully

Migration 069 only inserts the `public.users` profile row if the
`auth.users` row already exists. So you need to create the auth user
first. Three options, pick one:

### Option 1 — Patch dev-login + POST (recommended, mirrors existing users)

The 3-line patch, in `app/api/auth/dev-login/route.ts`:

```diff
   postproducer: { email: "postproducer@test.local", name: "Jessica", role: "Post Producer" },
+  designer:     { email: "designer@test.local",     name: "Design Lead", role: "Designer" },
 };
```

Then, with `npm run dev` running and `NEXT_PUBLIC_DEV_AUTH=true`:

```bash
curl -X POST http://localhost:3000/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"role":"designer"}'
# → {"success":true,"role":"Designer",...}
```

The route creates the auth user, upserts `public.users` with
`role = 'Designer'`, and signs in. Re-hitting the endpoint is a no-op
(idempotent via `upsert` on `id`).

Re-run 069 if you want the conditional insert's fields
(`favorite_publix_product`, `onboarding_completed`) applied — though the
dev-login upsert already covers `role = 'Designer'` and `active = true`,
which are the only two that matter for login + RLS.

### Option 2 — One-off Node script (no app server needed)

```js
// scripts/seed-designer.mjs  (don't commit — or gitignore scripts/seed-*.mjs)
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await admin.auth.admin.createUser({
  email: "designer@test.local",
  password: "testpass123456",
  email_confirm: true,
  user_metadata: { full_name: "Design Lead" },
});
if (error && !error.message.includes("already")) throw error;
console.log("auth.users id:", data?.user?.id);
```

Run it:

```bash
node --env-file=.env.local scripts/seed-designer.mjs
```

Then **re-run 069** so the conditional `public.users` insert fires.

### Option 3 — Supabase Studio UI

Authentication → Users → "Add user" → `designer@test.local` /
`testpass123456` / auto-confirm. Then re-run 069.

### Verify the seed

```sql
SELECT id, email FROM auth.users WHERE email = 'designer@test.local';
SELECT id, email, role, active
  FROM public.users WHERE email = 'designer@test.local';
-- both should return 1 row; public.users.role should equal 'Designer'
```

---

## 4. Seed demo data: 1 campaign with 10 products

Nothing pre-seeds this (`supabase/seed.sql` only seeds notifications for
existing campaigns). Two options:

### Option A — Use an existing campaign

```sql
-- Find a campaign that already has ≥10 products.
SELECT c.id, c.name, count(cp.id) AS product_count
FROM campaigns c
LEFT JOIN campaign_products cp ON cp.campaign_id = c.id
GROUP BY c.id, c.name
HAVING count(cp.id) >= 10
ORDER BY count(cp.id) DESC;
```

If you get at least one hit, use it and skip to §5.

### Option B — Link 10 products into a chosen campaign

```sql
-- Pick or create a campaign:
SELECT id, name FROM campaigns ORDER BY created_at DESC LIMIT 5;
-- (copy a campaign_id)

-- Pick 10 products:
SELECT id, name FROM products LIMIT 10;
-- (copy 10 product_ids)

INSERT INTO campaign_products (campaign_id, product_id)
VALUES
  ('<campaign_id>', '<product_id_1>'),
  ('<campaign_id>', '<product_id_2>'),
  -- …repeat through 10
ON CONFLICT DO NOTHING;
```

If there aren't 10 products in the target Supabase, seed them via the
normal Products UI or the existing Products admin API, then come back
and link them here.

---

## 5. Run the smoke test

Log in first. With `NEXT_PUBLIC_DEV_AUTH=true`:

- As Designer: `curl -X POST localhost:3000/api/auth/dev-login -H "Content-Type: application/json" -d '{"role":"designer"}'`
- As Producer (for the approve step): same curl with `"role":"producer"`.

Or use the email/password forms (`designer@test.local` /
`testpass123456`).

### 5a. Build a template

1. Navigate to `/asset-studio` → Templates tab → "New template".
2. In the editor (`/asset-studio/templates/[id]/edit`):
   - Name it (e.g. "Publix Product Hero v1").
   - Add at least one layer. For a dynamic product image, add an
     `image` layer with `is_dynamic = true` and
     `data_binding = 'product.image_url'`.
   - Output specs are auto-seeded on create
     (`ensureDefaultOutputSpecs()` in `templates.service.ts`), so
     1080², 1080×1350, 1080×1920 should already be present.
3. Set status → **Published** (PATCH
   `/api/asset-studio/templates/[id]` body `{status:"published"}`).
   The Run Builder only lists published templates.

### 5b. Create and render a run

1. `/asset-studio/runs/new`.
2. Pick your published template.
3. Pick the campaign from §4.
4. Select all 10 products.
5. Confirm all 3 output specs are selected → variant count badge
   should read **30**.
6. (Optional) copy overrides for dynamic text layers.
7. Click **"Create & render now"**.

Under the hood this POSTs to `/api/asset-studio/runs` then
fire-and-forgets `/api/asset-studio/runs/{id}/render` (route has
`maxDuration=300` in `runs/[id]/render/route.ts`). `sharp` runs
server-side; 30 renders on a modern Mac should finish in ≲60s.

### 5c. Watch the Run Detail page

`/asset-studio/runs/[id]` polls every 3s (via SWR `refreshInterval` on
lines 40–45) while `status ∈ {queued, rendering}`. You'll see
`completed / total` climb. Done states: `completed | failed | cancelled`.

### 5d. Approve

**Switch to a Producer or Admin session** (Designer UI hides the bulk
approve button — see §0 decision 3). Then:

1. Filter the gallery to the "Rendered" tab.
2. "Select all" → "Approve selected".

Behind the scenes: POST `/api/asset-studio/variants` with
`{ ids: [...], action: 'approve' }`. Approvals are stamped inline on
the `variants` row (`approved_by`, `approved_at`). No
`variant_approvals` table is used (Phase 2 work).

### 5e. Zip download — NOT WIRED

No `/api/asset-studio/runs/[id]/zip` (or similar) route exists. Options:

- Declare the smoke-test passing at "all 30 approved". Document it.
- Grab each `variant.asset_url` manually from the `variants` bucket —
  ugly but technically ends at "files on disk".
- Build a zip endpoint now. Rough sketch: a `route.ts` that streams
  a `archiver` (or `jszip`) bundle of all `variants.asset_url` for a
  run where `status = 'approved'`. ~40 lines; safe Phase 1 work.

---

## 6. After the smoke test — what you have proved

If §5a–§5d complete cleanly:

- 068 + 069 applied to staging (or wherever you pointed).
- `designer@test.local` seeded end-to-end.
- Template → run → 30 variants → approve round-trip works against the
  real DB + storage.
- Sharp render pipeline is happy in the target env.

If you want to promote to prod:

1. Re-run `supabase db push` (or the SQL-editor path) against prod.
2. Decide whether you want `designer@test.local` in prod. Probably not
   — the seed is useful for dev/staging but production should have
   real Designer users. The migration's conditional insert is
   harmless on prod because the `auth.users` row won't exist; it just
   fires the `NOTICE` and moves on.
3. Leave `NEXT_PUBLIC_DEV_AUTH` unset on Vercel
   (RELEASE_PLAYBOOK § 6).

---

## 7. Rollback

If something goes sideways and you want to unwind the tables (prod):
there is no down-migration. Per RELEASE_PLAYBOOK § 8, the rule is
"ship a forward-fix migration, do not rewrite migration history". If
you genuinely need to rip it out:

```sql
-- Dangerous; only on staging or a throw-away project.
DROP TABLE IF EXISTS variants            CASCADE;
DROP TABLE IF EXISTS variant_runs        CASCADE;
DROP TABLE IF EXISTS template_output_specs CASCADE;
DROP TABLE IF EXISTS template_layers     CASCADE;
DROP TABLE IF EXISTS templates           CASCADE;
DROP TABLE IF EXISTS brand_tokens        CASCADE;
DELETE FROM storage.buckets
  WHERE id IN ('templates', 'variants', 'brand-assets');
-- Note: you cannot remove a value from a Postgres enum without
-- recreating the enum. Just leave 'Designer' in user_role — harmless.
```

---

## 8. Questions to close out before the next session

Adopted from the handoff's "Open questions":

1. Staging-only now, or apply to prod this week?
2. Do we want `designer@test.local` in prod, or leave it staging-only?
3. Build the zip endpoint as a hotfix (unblocks the "done line"), or
   accept the demo ending at "Approve all" and roll the zip into
   Phase 1 polish?
4. Add `'Designer'` to `canApprove` in the Run Detail page, or keep
   approval a Producer-only UI action? (RLS in 068 allows it; the
   split is a deliberate UX choice.)

My read: #3 yes build the hotfix (small, unblocks the contractual
done-line), #4 no keep the split (matches the Producer-does-approval
pattern elsewhere in the portal). But those are your calls.
