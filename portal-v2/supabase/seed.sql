-- ============================================================
-- Seed: Notifications
-- Realistic campaign notifications for test users.
-- Run after migrations and after test users/campaigns exist.
-- ============================================================

DO $$
DECLARE
  admin_id    uuid;
  producer_id uuid;
  cam1_id     uuid;
  cam2_id     uuid;
  cam3_id     uuid;
BEGIN
  -- Look up test user IDs
  SELECT id INTO admin_id    FROM auth.users WHERE email = 'admin@test.local'    LIMIT 1;
  SELECT id INTO producer_id FROM auth.users WHERE email = 'producer@test.local' LIMIT 1;

  -- Look up first three campaigns (sorted oldest first)
  SELECT id INTO cam1_id FROM public.campaigns ORDER BY created_at ASC LIMIT 1 OFFSET 0;
  SELECT id INTO cam2_id FROM public.campaigns ORDER BY created_at ASC LIMIT 1 OFFSET 1;
  SELECT id INTO cam3_id FROM public.campaigns ORDER BY created_at ASC LIMIT 1 OFFSET 2;

  -- --------------------------------------------------------
  -- Admin (HOP) notifications
  -- --------------------------------------------------------
  IF admin_id IS NOT NULL THEN
    INSERT INTO public.notifications
      (user_id, campaign_id, type, level, title, body, read, created_at)
    VALUES

    -- Unread urgent: invoice needs HOP approval
    (admin_id, cam1_id, 'invoice_submitted', 'urgent',
     'Invoice ready for approval',
     'Fresh Focus Photography submitted a $14,200 invoice. Pre-approved by Laura — waiting on your sign-off.',
     false, now() - interval '2 hours'),

    -- Unread warning: budget nearly gone
    (admin_id, cam2_id, 'budget_alert', 'warning',
     'Budget under 10% remaining',
     'Only 8% of the production budget remains. Review spending before approving additional costs.',
     false, now() - interval '5 hours'),

    -- Unread info: new estimate came in
    (admin_id, cam1_id, 'vendor_estimate', 'info',
     'New estimate submitted',
     'Studio North submitted an estimate for $6,850. Waiting on producer review.',
     false, now() - interval '1 day'),

    -- Unread urgent: shoot is tomorrow
    (admin_id, cam3_id, 'shoot_upcoming', 'urgent',
     'Shoot tomorrow',
     'Spring Refresh — Beauty Products shoot starts tomorrow at 7:00 AM. Call sheet sent.',
     false, now() - interval '18 hours'),

    -- Read: campaign status changed
    (admin_id, cam1_id, 'status_change', 'info',
     'Campaign moved to Post',
     'Summer Grilling — Outdoor Entertaining moved from In Production → Post.',
     true,  now() - interval '3 days'),

    -- Read: invoice approved
    (admin_id, cam2_id, 'invoice_approved', 'info',
     'Invoice approved and paid',
     'Final payment of $8,400 to Bright Light Rentals marked complete.',
     true,  now() - interval '5 days'),

    -- Read: budget request approved
    (admin_id, cam3_id, 'budget_alert', 'warning',
     'Budget request needs review',
     'Laura submitted a $3,000 overage request for additional talent. Reason: last-minute casting change.',
     true,  now() - interval '1 week'),

    -- Read info: campaign created
    (admin_id, cam3_id, 'campaign_created', 'info',
     'New campaign created',
     'Spring Refresh — Beauty Products was created by Laura and is now in Planning.',
     true,  now() - interval '2 weeks');
  END IF;

  -- --------------------------------------------------------
  -- Producer notifications
  -- --------------------------------------------------------
  IF producer_id IS NOT NULL THEN
    INSERT INTO public.notifications
      (user_id, campaign_id, type, level, title, body, read, created_at)
    VALUES

    -- Unread urgent: PO needs signature
    (producer_id, cam1_id, 'po_uploaded', 'urgent',
     'PO awaiting vendor signature',
     'Fresh Focus Photography PO has been uploaded for 4 days with no signature. Follow up needed.',
     false, now() - interval '1 hour'),

    -- Unread warning: assets past due
    (producer_id, cam2_id, 'assets_due', 'warning',
     'Assets delivery date passed',
     'Final edited assets for Holiday Entertaining were due yesterday. Check with post on status.',
     false, now() - interval '3 hours'),

    -- Unread info: estimate submitted
    (producer_id, cam1_id, 'vendor_estimate', 'info',
     'Estimate submitted for review',
     'Studio North submitted a $6,850 estimate for review. Approve or request changes.',
     false, now() - interval '6 hours'),

    -- Unread urgent: shoot is today
    (producer_id, cam3_id, 'shoot_upcoming', 'urgent',
     'Shoot today',
     'Spring Refresh — Beauty Products shoot is today. Call time 7:00 AM.',
     false, now() - interval '30 minutes'),

    -- Unread warning: pending estimate over 3 days old
    (producer_id, cam2_id, 'vendor_estimate', 'warning',
     'Estimate pending 4 days',
     'Invited Creative Motion 4 days ago — still no estimate submitted. Consider following up.',
     false, now() - interval '2 days'),

    -- Read: invoice submitted
    (producer_id, cam1_id, 'invoice_submitted', 'info',
     'Invoice submitted',
     'Fresh Focus Photography submitted their invoice for $14,200. Review line items vs. estimate.',
     true,  now() - interval '1 day'),

    -- Read: campaign status change
    (producer_id, cam1_id, 'status_change', 'info',
     'Campaign status updated',
     'Summer Grilling — Outdoor Entertaining moved from In Production → Post.',
     true,  now() - interval '3 days'),

    -- Read: shoot upcoming (was in future, now past)
    (producer_id, cam1_id, 'shoot_upcoming', 'warning',
     'Shoot in 2 days',
     'Summer Grilling — Outdoor Entertaining shoot on Friday. Confirm crew and gear.',
     true,  now() - interval '1 week');
  END IF;

END $$;
