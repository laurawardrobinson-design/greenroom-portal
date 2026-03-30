-- ============================================================
-- Migration 016: Notifications
-- Persistent per-user notifications tied to campaign events.
-- ============================================================

CREATE TABLE public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid        REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type        text        NOT NULL,
  -- types: status_change | shoot_upcoming | vendor_estimate | po_uploaded
  --        invoice_submitted | invoice_approved | budget_alert | assets_due | campaign_created
  level       text        NOT NULL DEFAULT 'info',
  -- levels: urgent | warning | info
  title       text        NOT NULL,
  body        text        NOT NULL DEFAULT '',
  read        boolean     NOT NULL DEFAULT false,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Row-level security: users only see their own notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Inserts go through server-side admin client; open to service role
CREATE POLICY "notifications_insert_service" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- Fast unread-count lookup
CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id, read, created_at DESC);

CREATE INDEX idx_notifications_campaign
  ON public.notifications(campaign_id);
