# Storyteq-Parity Implementation Plan (Asset Studio)

Last updated: 2026-04-19
Owner: Portal V2 / Asset Studio

## 1. Goal

Evolve Asset Studio from template/render/review tooling into a Storyteq-like campaign rollout platform across:

- Adaptation Studio parity: dynamic templating, high-volume varianting, multi-format outputs.
- Content Portal parity: DAM, AI-assisted discovery, usage analytics.
- Collaboration Hub parity: briefs, review workflows, approvals, handoffs, auditability.
- Enterprise parity: SSO, secure integrations, operational SLAs.

Current operating assumption (from stakeholder input):

- External publishing is not active right now.
- We prioritize adaptation, DAM/search, collaboration, and governance first.
- Channel connector buildout is explicitly deferred to a later phase.

## 2. Current Baseline (Repo Truth)

Already strong:

- Template version snapshots + run pinning to template version.
- Variant approvals/rejections + audit log.
- Locale fan-out and CSV/per-product copy overrides.
- Size preset library (POP + digital), plus default social sizes.

Current bottlenecks:

- Manual downstream distribution (`zip` download workflow) remains acceptable short term.
- Image-only rendering formats in core output spec and renderer.
- Synchronous run rendering loop.
- No first-class DAM asset graph + semantic search.
- No full briefing/workflow/collaboration entities.
- No SSO/admin integration framework in module.

## 3. Architecture Direction

Use an evented pipeline while preserving current API behavior:

- Keep existing `/api/asset-studio/*` endpoints stable.
- Add new capabilities under additive endpoints and new tables.
- Introduce background workers for rendering and AI indexing first.
- Keep current run/variant model as source of truth; attach jobs/search/workflow indexes as sidecars.

## 4. Epics

## Epic A (Deferred): Delivery and Channel Publish Orchestrator

### Outcome
When enabled, variants can be pushed directly to configured destinations (DAM, ad channels, cloud storage) with retries, per-target status, and audit trail.

Status: Deferred until external publishing becomes an active business need.

### Schema changes

- `delivery_targets`
  - `id`, `name`, `target_type` (`meta_ads`, `google_ads`, `dv360`, `dam`, `s3`, `gdrive`, `manual_webhook`), `config_json`, `is_active`, `created_by`, timestamps.
- `run_deliveries`
  - `id`, `run_id`, `target_id`, `status` (`queued`, `sending`, `partial`, `sent`, `failed`, `cancelled`), `summary_json`, timestamps.
- `variant_deliveries`
  - `id`, `variant_id`, `run_delivery_id`, `external_asset_id`, `external_url`, `status`, `error_message`, `attempt_count`, timestamps.
- `connector_credentials`
  - `id`, `target_id`, `provider`, `secret_ref`, `scope_json`, `expires_at`, timestamps.

### API contracts

- `POST /api/asset-studio/runs/:id/deliveries`
  - request: `{ targetId: string, variantFilter?: { status?: string[], localeCodes?: string[] } }`
  - response: `{ deliveryId, status }`
- `GET /api/asset-studio/runs/:id/deliveries`
  - response: `[{ id, target, status, counts, createdAt, updatedAt }]`
- `GET /api/asset-studio/deliveries/:id`
  - response: `{ id, runId, target, status, variants: [{ variantId, status, externalUrl, errorMessage }] }`
- `POST /api/asset-studio/delivery-targets`
  - request: `{ name, targetType, config }`
- `PATCH /api/asset-studio/delivery-targets/:id`

### UI scope

- Replace placeholder channels tab with target config + send flow.
- Add delivery status panel on run detail.

## Epic B: Async Render Pipeline + Multi-format Output

### Outcome
Rendering scales beyond demo sizes and supports video/animation/print outputs.

### Schema changes

- Extend `template_output_specs.format` from `png|jpg|webp` to:
  - `png`, `jpg`, `webp`, `mp4`, `gif`, `html5`, `pdf`.
- Add `template_output_specs.output_options jsonb` for codec/quality/print controls.
- `render_jobs`
  - `id`, `run_id`, `priority`, `status`, `queued_at`, `started_at`, `completed_at`, `error_message`.
- `render_job_items`
  - `id`, `job_id`, `variant_id`, `status`, `attempts`, `worker_id`, `last_error`, timestamps.

### API contracts

- `POST /api/asset-studio/runs/:id/render` remains, but becomes enqueue semantics:
  - response: `{ runId, jobId, status: "queued" }`
- `GET /api/asset-studio/render-jobs/:id`
  - response: `{ id, runId, status, progress: { total, done, failed } }`
- `POST /api/asset-studio/templates/:id/output-specs` (existing)
  - support payload `format: "mp4"|"gif"|"html5"|"pdf", outputOptions: {...}`.

### Worker implementation

- Introduce queue-backed worker process (same repo, separate runtime entry).
- Keep current Sharp image renderer as `image` path.
- Add adapters for:
  - video/gif jobs via media renderer service.
  - html5 banner packaging.
  - pdf print render with bleed/trim/color profile metadata.

## Epic C: Content Portal (DAM Core + Search)

### Outcome
Central asset library with metadata, versioning, semantic/discovery search, and usage tracking.

### Schema changes

- `assets`
  - `id`, `brand`, `asset_type`, `mime_type`, `storage_path`, `thumbnail_url`, `checksum`, `source`, `current_version_id`, timestamps.
- `asset_versions`
  - `id`, `asset_id`, `version`, `storage_path`, `metadata_json`, `created_by`, timestamps.
- `asset_tags`
  - `id`, `asset_id`, `tag`, `confidence`, `source` (`ai`, `manual`), timestamps.
- `asset_embeddings`
  - `asset_id`, `embedding vector`, `model`, `updated_at`.
- `asset_usage_events`
  - `id`, `asset_id`, `event_type` (`view`, `download`, `adapt`, `publish`), `context_json`, `user_id`, timestamps.
- `collections`
  - `id`, `name`, `type` (`guideline`, `playbook`, `folder`), `brand`, `metadata_json`.
- `collection_assets`
  - junction table.

### API contracts

- `GET /api/asset-studio/assets?query=&filters=`
  - response: paginated assets with metadata facets.
- `POST /api/asset-studio/assets/upload`
  - request: multipart + metadata.
- `POST /api/asset-studio/assets/:id/reindex`
- `GET /api/asset-studio/assets/:id/usage`
- `GET /api/asset-studio/analytics/assets`

### Search behavior

- Hybrid retrieval: metadata filter + vector similarity.
- Natural language query endpoint with typo tolerance and synonym expansion.

## Epic D: Collaboration Hub (Briefs, Reviews, Workflow)

### Outcome
Campaign rollout workstream in one place: intake brief -> review -> approval -> publish.

### Schema changes

- `campaign_briefs`
  - `id`, `campaign_id`, `title`, `status`, `due_date`, `template_id`, `fields_json`, `created_by`, timestamps.
- `brief_comments`
  - threaded comments, mentions, attachments.
- `review_threads`
  - `id`, `variant_id`, `status`, `created_by`, timestamps.
- `review_annotations`
  - `id`, `thread_id`, `shape`, `x_pct`, `y_pct`, `w_pct`, `h_pct`, `comment`, `created_by`, timestamps.
- `workflow_definitions`
  - stage configs and role gates.
- `workflow_instances`
  - `id`, `entity_type`, `entity_id`, `current_stage`, `status`, timestamps.
- `workflow_events`
  - immutable stage transitions.

### API contracts

- `POST /api/asset-studio/briefs`
- `PATCH /api/asset-studio/briefs/:id`
- `POST /api/asset-studio/reviews/threads`
- `POST /api/asset-studio/reviews/threads/:id/annotations`
- `POST /api/asset-studio/workflows/:entityType/:entityId/advance`

## Epic E: Brand Governance Rules Engine

### Outcome
Automated checks before approval/publish (dimensions, safe zones, text length, contrast, required elements).

### Schema changes

- `brand_rulesets`
  - `id`, `brand`, `version`, `is_active`, timestamps.
- `brand_rules`
  - `id`, `ruleset_id`, `rule_type`, `severity`, `config_json`.
- `variant_rule_results`
  - `id`, `variant_id`, `rule_id`, `status` (`pass`, `warn`, `fail`), `details_json`, timestamps.

### API contracts

- `POST /api/asset-studio/rulesets`
- `POST /api/asset-studio/variants/:id/validate`
- `GET /api/asset-studio/runs/:id/validation-summary`

## Epic F: Enterprise Admin (SSO + Connector Admin + Webhooks)

### Outcome
Enterprise onboarding and secure platform operations.

### Schema changes

- `org_identity_configs`
  - `id`, `org_id`, `provider`, `domain`, `sso_mode`, `config_json`, `enabled`.
- `integration_webhooks`
  - `id`, `org_id`, `event_type`, `target_url`, `secret_ref`, `is_active`.
- `integration_event_log`
  - delivery attempts and outcomes.

### API contracts

- `POST /api/admin/sso/config`
- `POST /api/admin/sso/test`
- `POST /api/admin/webhooks`
- `GET /api/admin/integrations/health`

## 5. Implementation Phases and Timeline

Assume 2-week sprints, one platform squad (4-6 engineers), shared design/QA.

### Phase 0 (Week 1)

- Hardening + design freeze.
- Write OpenAPI contracts for Epics B/C first.
- Define feature flags:
  - `assetStudio.renderQueue`
  - `assetStudio.damSearch`
  - `assetStudio.collabHub`

### Phase 1 (Weeks 2-4)

- Epic B foundation.
- DB migration set B (`render_jobs`, `render_job_items`, output spec options).
- Render queue + workers + job APIs.
- Preserve existing render endpoint contract while making it async.
- Add `pdf` output first (fastest path to print utility).

Exit criteria:

- 500+ variant run completes without route timeout.
- Queue retries + partial-failure recovery verified.

### Phase 2 (Weeks 5-7)

- Epic C foundation.
- Asset registry, tagging pipeline v1, usage events.
- Search API with metadata + text retrieval.
- Portal browse/search page in Asset Studio.

Exit criteria:

- Users can find existing assets by metadata and keyword.
- Usage analytics dashboard for upload/download/adapt events.

### Phase 3 (Weeks 8-10)

- Epic D core collaboration.
- Brief entities, threaded comments, review annotations.
- Workflow engine v1 with 3-stage default flow.

Exit criteria:

- Campaign moves brief -> review -> approval with auditable transitions.

### Phase 4 (Weeks 11-13)

- Epic E plus selected Epic F (identity/admin foundations).
- Brand rules engine v1 (warn/fail gates).
- Enterprise SSO/admin plumbing + webhook event framework.

Exit criteria:

- Policy-based approval gates active.
- Org admin can configure identity + baseline integration webhooks.

### Phase 5 (Weeks 14-16, Optional)

- Epic A activation (only if publishing becomes active).
- Delivery target CRUD + run delivery orchestration + status UI.
- First connectors: `manual_webhook` + `s3`, then channel-specific connectors.

Exit criteria:

- Team can ship variants directly to configured destinations with auditable outcomes.

## 6. File-Level Execution Plan (This Repo)

Primary touchpoints:

- Routes:
  - `app/api/asset-studio/runs/*`
  - `app/api/asset-studio/variants/*`
  - `app/api/asset-studio/templates/*`
  - New route trees: `app/api/asset-studio/assets/*`, `app/api/asset-studio/briefs/*`, `app/api/asset-studio/reviews/*`, `app/api/asset-studio/workflows/*`.
  - Deferred route tree: `app/api/asset-studio/deliveries/*`.
- Services:
  - `lib/services/render.service.ts` (split into pipeline + worker adapters)
  - `lib/services/runs.service.ts`
  - `lib/services/variants.service.ts`
  - New services: `assets.service.ts`, `reviews.service.ts`, `workflows.service.ts`, `rules.service.ts`.
  - Deferred service: `deliveries.service.ts`.
- Types/validation:
  - `types/domain.ts`
  - `lib/validation/asset-studio.ts`
- UI:
  - `app/(portal)/asset-studio/runs/[id]/page.tsx`
  - `components/asset-studio/channels-tab.tsx`
  - New DAM/collab views under `app/(portal)/asset-studio/*`.
- Migrations:
  - add `074+` migration series for Epics A-F.
  - In no-publish mode, sequence as: B -> C -> D -> E/F -> A.

## 7. Testing Strategy

- Unit tests: services and rule evaluators.
- Contract tests: all new REST endpoints (request/response schema assertions).
- Worker integration tests: queue -> render end-to-end in test env.
- Load tests:
  - 5k variant synthetic batch.
- Deferred: parallel deliveries across 3 targets (when Epic A is activated).
- Data safety tests:
  - version pinning immutability.
  - audit log append-only behavior remains intact.

## 8. Risks and Mitigations

- Risk: queue complexity introduces operational burden.
  - Mitigation: start with one queue backend + strict retry policy + dead-letter queue.
- Risk: scope creep on DAM AI features.
  - Mitigation: phase C focuses on retrieval + tagging v1, defer advanced intelligence.
- Risk: migration impact on existing flows.
  - Mitigation: additive schema changes + feature flags + dual-write where needed.
- Risk: building connector surface area before go-live need.
  - Mitigation: keep Epic A deferred and design it as an optional module.

## 9. Recommended Start-Now Backlog (First 10 tickets)

1. Add OpenAPI spec skeleton for render-job, assets, briefs, and workflow endpoints.
2. Migration 074: `render_jobs`, `render_job_items`, indexes, RLS.
3. Refactor `POST /runs/:id/render` to enqueue job (preserve current client contract).
4. Worker bootstrap for image render jobs (reuse existing renderer function).
5. Add run/job progress polling on run detail page.
6. Extend output spec contract with `output_options` and add `pdf` format support.
7. Migration 075: DAM core tables (`assets`, `asset_versions`, `asset_tags`, `asset_usage_events`).
8. Implement asset upload/list/search service + routes.
9. Migration 076: collaboration tables (`campaign_briefs`, `review_threads`, `review_annotations`, `workflow_*`).
10. Add brief + review + workflow UI shell in Asset Studio.

## 10. Success Metrics

- Time-to-approve (run complete -> approved set finalized) reduced by >50%.
- Search success rate (asset found in first query) >75%.
- Throughput: >= 5,000 variants/run with <1% terminal failures excluding source-data errors.
- SLA: 99.5% monthly uptime for render and core Asset Studio APIs.
- Deferred metric (when Epic A is active): manual zip/download workflow usage drops below 10% of runs.
