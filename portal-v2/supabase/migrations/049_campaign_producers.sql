-- Multi-producer support: junction table for campaign → producers
CREATE TABLE IF NOT EXISTS public.campaign_producers (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_producers_campaign ON public.campaign_producers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_producers_user    ON public.campaign_producers(user_id);

-- Migrate existing producer_id values
INSERT INTO public.campaign_producers (campaign_id, user_id)
SELECT id, producer_id
FROM   public.campaigns
WHERE  producer_id IS NOT NULL
ON CONFLICT DO NOTHING;
