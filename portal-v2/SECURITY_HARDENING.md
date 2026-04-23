# Security Hardening Notes

This file tracks security work that is intentionally deferred so we can harden safely without breaking live workflows.

## Completed In This Pass

- Locked down dev-mode auth endpoints with production-safe server toggles:
  - `DEV_AUTH_ALLOW_PRODUCTION`
  - `RESET_ALLOW_PRODUCTION`
- Added object-level authorization for:
  - `/api/estimates/view/[id]`
  - `/api/invoices/view/[id]`
  - `/api/po/view/[id]`
  - `/api/campaign-vendors/[id]` read and vendor-owned transitions
  - `/api/files` delete path now validates campaign ownership/access
- Reduced public exposure:
  - `/api/demo/vendors` now only works when dev auth is enabled
  - Removed email/phone from demo vendor payload
- Enforced HTTPS-only URL scraping/proxying for:
  - `/api/document-proxy`
  - `/api/scrape-link`
  - `/api/job-classes/scrape`
- Dependency hardening:
  - Updated `next` / `eslint-config-next` to `16.2.4`
  - Removed unused `@ducanh2912/next-pwa`
  - Ran `npm audit fix` to clear remaining advisories

## Deferred For Safe Rollout

1. Move `campaign-assets` storage bucket from public to private.
   - Why deferred: existing document links rely on public URLs.
   - Hardening plan:
     - Add `storage_path` as canonical locator for each asset row.
     - Serve downloads through signed URLs (short TTL).
     - Backfill existing records and remove `publicUrl` dependency.

2. Tighten CSP to remove `'unsafe-inline'` and `'unsafe-eval'`.
   - Why deferred: can break existing scripts/styles if switched in one step.
   - Hardening plan:
     - Add CSP nonces/hashes and test all interactive pages.
     - Roll out with report-only mode first.

3. Replace in-memory rate limiting with distributed storage.
   - Why deferred: current limiter resets per instance and is not durable across scale.
   - Hardening plan:
     - Move counters to Redis or equivalent shared store.
     - Add per-user and per-endpoint buckets for sensitive routes.

4. Tighten first-login role provisioning from OAuth callback.
   - Why deferred: role bootstrap behavior is currently relied on operationally.
   - Hardening plan:
     - Default new users to non-privileged pending role.
     - Add explicit approval/group-mapping before elevated access.

