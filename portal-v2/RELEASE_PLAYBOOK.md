# Greenroom Release Playbook

This guide is the default path for making updates safely, validating them, and pushing them live to Vercel when you're happy.

## 1) Start Every Update on a Branch

1. Sync `main`.
2. Create a focused branch (examples: `feature/campaign-filters`, `fix/invoice-upload`).
3. Keep each branch scoped to one release objective.

Recommended pattern:

```bash
git checkout main
git pull
git checkout -b feature/<short-topic>
```

## 2) Build in Small Stages

Use incremental stages so each checkpoint is testable:

1. Stage A: Data/model changes (if needed)
2. Stage B: API/service changes
3. Stage C: UI behavior
4. Stage D: polish + cleanup

For each stage:

1. Implement
2. Run locally
3. Smoke test relevant flows
4. Commit with a clear message

## 3) Local Development Workflow

Run the app:

```bash
npm run dev
```

Minimum pre-PR checks:

```bash
npm run lint
npm run test
npm run build
```

## 4) Supabase Change Workflow

If your update changes data model, policies, or storage rules:

1. Add a new migration under `supabase/migrations/` (never edit old applied migrations).
2. Keep schema + policy updates in migrations so environments stay reproducible.
3. Validate impacted flows locally against your Supabase project.

Important env vars used by this app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Edge function note:

- `supabase/functions/parse-invoice/index.ts` also depends on `ANTHROPIC_API_KEY` (plus Supabase service credentials in function env).

## 5) PR + Vercel Preview (Default Release Gate)

1. Push your branch.
2. Open a PR to `main`.
3. Wait for Vercel Preview deployment.
4. Validate in preview before merge.

Preview checklist:

1. Login + role routing
2. Core dashboard load
3. Any changed API routes
4. File upload/download flows (if touched)
5. Any changed approval/workflow state transitions

## 6) Production Safety Flags

Before merge/deploy, confirm dev-only toggles are off in production:

- `NEXT_PUBLIC_DEV_AUTH` should be unset/false
- `NEXT_PUBLIC_RESET_ENABLED` should be unset/false

## 7) Merge and Release

When preview looks good:

1. Merge PR to `main`
2. Let Vercel deploy production
3. Run immediate post-deploy smoke tests

Post-deploy checks:

1. App loads and auth works
2. `/api/health` returns healthy
3. One representative user flow for the area you changed

## 8) Rollback / Recovery Plan

If release issues are found:

1. Revert the PR commit(s) on `main` for fast code rollback.
2. For DB issues, ship a forward-fix migration (do not rewrite migration history).
3. Redeploy and re-run smoke checks.

## 9) Suggested Commit/PR Discipline

1. Small commits with intent-focused messages.
2. PR description includes:
   - What changed
   - Why
   - How tested
   - Any migration/env requirements
3. Keep unrelated refactors out of release branches.

