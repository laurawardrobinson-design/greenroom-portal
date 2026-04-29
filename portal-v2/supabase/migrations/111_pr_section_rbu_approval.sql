-- RBU approval at the PR section level. When the RBU reviewer (Grant) opens
-- a forwarded PR via /pr/view/[token] and clicks Approve, we stamp these
-- columns. The dashboard uses them to flip a section from Pending → Approved.

ALTER TABLE public.product_request_dept_sections
  ADD COLUMN IF NOT EXISTS rbu_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rbu_approved_by_name text;
