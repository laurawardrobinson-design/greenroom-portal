-- Creative team read access to campaigns.
--
-- Before this migration, the only internal roles able to SELECT from
-- campaigns were Admin and Producer (plus Studio/Vendor via their own
-- scoped policies). Creative Director, Art Director, Designer, and
-- Post Producer were all blocked, which caused the CD/DD dashboard's
-- decision inbox to show "Unassigned campaign" for every mechanical
-- batch — they could read the variant and run but not the campaign
-- it belongs to.
--
-- These roles all legitimately need to know which campaign a piece of
-- creative work belongs to in order to do their jobs. Grant a read-only
-- policy scoped to those four roles.

CREATE POLICY "campaigns_creative_team"
ON public.campaigns
FOR SELECT
USING (
  get_my_role() = ANY (ARRAY[
    'Creative Director'::text,
    'Art Director'::text,
    'Designer'::text,
    'Post Producer'::text
  ])
);
