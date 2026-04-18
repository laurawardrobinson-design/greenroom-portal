## Summary

- What changed?
- Why was this needed?

## Release Stage

- Stage A: Data/model changes
- Stage B: API/service changes
- Stage C: UI behavior
- Stage D: polish/cleanup

Mark current stage(s):

- [ ] A
- [ ] B
- [ ] C
- [ ] D

## Validation

- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] Manual smoke test completed for impacted flows

## Supabase Impact

- [ ] No DB/storage policy changes
- [ ] Migration added in `supabase/migrations/` (if needed)
- [ ] Migration tested in non-production environment
- [ ] Any edge-function/env changes documented

## Env / Flags Check

- [ ] Production does NOT enable `NEXT_PUBLIC_DEV_AUTH`
- [ ] Production does NOT enable `NEXT_PUBLIC_RESET_ENABLED`
- [ ] Required env vars documented for deploy

## Vercel Preview Checklist

- [ ] Preview deployment is healthy
- [ ] Login and role routing verified
- [ ] Changed API routes verified
- [ ] Upload/download flows verified (if touched)
- [ ] Approval/workflow transitions verified (if touched)

## Rollout / Rollback Notes

- Rollout plan:
- Rollback plan:

## Reference

Follow the full release process in [`RELEASE_PLAYBOOK.md`](../RELEASE_PLAYBOOK.md).
