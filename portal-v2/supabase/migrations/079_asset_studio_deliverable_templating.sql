-- ============================================================
-- 079: Asset Studio — deliverable-driven designer queue (Sprint 7, Phase 1)
--
-- Closes the one seam that made designers "aimlessly click around to
-- find what they are supposed to version":
--
--   1. Deliverables become first-class templating tasks via the
--      existing workflow_instances engine (entity_type = 'deliverable').
--   2. Templates get a back-link to the deliverable they were built for.
--   3. Deliverables get an optional per-deliverable designer override;
--      NULL falls back to the campaign's primary_designer.
--
-- Storyteq parity: designer self-approves templates. Art Director stays
-- on variant-versioning; Creative Director stays on variant approval.
-- Stages: needs_template → drafting → template_ready.
--
-- Non-breaking: all additions are nullable or defaulted. No data loss.
-- Application-level hooks (in campaign-assignments + deliverables API
-- routes) create workflow_instances when a designer is assigned or a
-- deliverable is added to a campaign that already has a designer.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Template ↔ deliverable FK
--    Template can be the parameterized master for one deliverable.
-- ------------------------------------------------------------

ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS campaign_deliverable_id uuid
    REFERENCES public.campaign_deliverables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_templates_campaign_deliverable
  ON public.templates (campaign_deliverable_id)
  WHERE campaign_deliverable_id IS NOT NULL;

COMMENT ON COLUMN public.templates.campaign_deliverable_id IS
  'Optional back-link to the deliverable this template was built for. NULL for standalone templates.';

-- ------------------------------------------------------------
-- 2) Per-deliverable designer assignment
--    NULL = inherit from campaign.primary_designer (via
--    campaign_assignments). Explicit value overrides.
-- ------------------------------------------------------------

ALTER TABLE public.campaign_deliverables
  ADD COLUMN IF NOT EXISTS assigned_designer_id uuid
    REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_deliverables_assigned_designer
  ON public.campaign_deliverables (assigned_designer_id)
  WHERE assigned_designer_id IS NOT NULL;

COMMENT ON COLUMN public.campaign_deliverables.assigned_designer_id IS
  'Optional per-deliverable designer. NULL inherits campaign.primary_designer via campaign_assignments.';

-- ------------------------------------------------------------
-- 3) Deliverable templating workflow definition
--    Seeded as the default (is_active=true) for entity_type='deliverable'.
-- ------------------------------------------------------------

INSERT INTO public.workflow_definitions (
  key,
  entity_type,
  name,
  version,
  description,
  initial_stage,
  stages,
  transitions,
  is_active,
  metadata
)
SELECT
  'deliverable_templating_v1',
  'deliverable',
  'Deliverable templating',
  1,
  'Designer builds a parameterized template for a campaign deliverable. Designer self-approves; copy flows through bindings at render time (Storyteq parity).',
  'needs_template',
  '[
    {"key":"needs_template","label":"Needs template","queueRoles":["Designer","Admin"]},
    {"key":"drafting","label":"Drafting","queueRoles":["Designer","Admin"]},
    {"key":"template_ready","label":"Template ready","queueRoles":[]}
  ]'::jsonb,
  '[
    {
      "action":"start_drafting",
      "label":"Start templating",
      "kind":"advance",
      "from":"needs_template",
      "to":"drafting",
      "roles":["Designer","Admin"]
    },
    {
      "action":"publish_template",
      "label":"Publish template",
      "kind":"advance",
      "from":"drafting",
      "to":"template_ready",
      "roles":["Designer","Admin"]
    },
    {
      "action":"reopen_template",
      "label":"Reopen to edit",
      "kind":"return",
      "from":"template_ready",
      "to":"drafting",
      "roles":["Designer","Admin"]
    }
  ]'::jsonb,
  true,
  '{"system":"asset_studio","seeded_by":"079_asset_studio_deliverable_templating"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.workflow_definitions
  WHERE key = 'deliverable_templating_v1'
    AND version = 1
);

-- ------------------------------------------------------------
-- 4) Backfill: for every existing campaign_deliverable whose campaign
--    already has a primary_designer, create a workflow_instance in
--    'needs_template'. Idempotent via the (entity_type, entity_id)
--    unique constraint on workflow_instances.
-- ------------------------------------------------------------

WITH def AS (
  SELECT id
  FROM public.workflow_definitions
  WHERE key = 'deliverable_templating_v1'
    AND is_active = true
  ORDER BY version DESC
  LIMIT 1
),
candidates AS (
  SELECT
    d.id          AS deliverable_id,
    d.campaign_id AS campaign_id,
    (SELECT id FROM def) AS definition_id
  FROM public.campaign_deliverables d
  WHERE EXISTS (
    SELECT 1
    FROM public.campaign_assignments ca
    WHERE ca.campaign_id = d.campaign_id
      AND ca.assignment_role = 'primary_designer'
  )
)
INSERT INTO public.workflow_instances (
  definition_id,
  entity_type,
  entity_id,
  campaign_id,
  current_stage,
  status,
  metadata,
  last_event_at
)
SELECT
  c.definition_id,
  'deliverable',
  c.deliverable_id,
  c.campaign_id,
  'needs_template',
  'active',
  '{"created_from":"079_backfill"}'::jsonb,
  now()
FROM candidates c
ON CONFLICT (entity_type, entity_id) DO NOTHING;

-- Log a workflow_events row for each newly-created instance so the
-- audit trail is complete from t=0.
INSERT INTO public.workflow_events (
  instance_id,
  definition_id,
  entity_type,
  entity_id,
  from_stage,
  to_stage,
  action,
  actor_id,
  actor_role,
  reason,
  metadata
)
SELECT
  wi.id,
  wi.definition_id,
  wi.entity_type,
  wi.entity_id,
  NULL,
  wi.current_stage,
  'created',
  NULL,
  NULL,
  'Backfilled by migration 079',
  '{"source":"079_backfill"}'::jsonb
FROM public.workflow_instances wi
WHERE wi.entity_type = 'deliverable'
  AND (wi.metadata ->> 'created_from') = '079_backfill'
  AND NOT EXISTS (
    SELECT 1 FROM public.workflow_events we
    WHERE we.instance_id = wi.id
      AND we.action = 'created'
  );

-- ------------------------------------------------------------
-- 5) RLS — deliverables already inherit campaign visibility rules
--    from 006_rls_policies + 078. The new columns are additive and
--    read via the same policies (no new policy needed).
--    workflow_instances + workflow_events RLS from 077 already scopes
--    by current_user_has_role; 'deliverable' entity_type fits in.
-- ------------------------------------------------------------
