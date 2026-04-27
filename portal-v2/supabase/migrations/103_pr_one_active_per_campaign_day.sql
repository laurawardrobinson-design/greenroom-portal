-- 103: One active product request per campaign shoot day
--
-- Real workflow rule: a campaign can have one product request per shoot day.
-- Additional departments, pickup needs, and item batches belong in that day's
-- PR, not in a second active doc.

CREATE TEMP TABLE pr_duplicate_docs_to_merge (
  duplicate_id uuid PRIMARY KEY,
  keep_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO pr_duplicate_docs_to_merge (duplicate_id, keep_id)
WITH ranked_docs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY campaign_id, shoot_date
      ORDER BY
        CASE WHEN shoot_date_id IS NULL THEN 1 ELSE 0 END,
        created_at ASC,
        id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY campaign_id, shoot_date
      ORDER BY
        CASE WHEN shoot_date_id IS NULL THEN 1 ELSE 0 END,
        created_at ASC,
        id ASC
    ) AS keep_id
  FROM public.product_request_docs
  WHERE status <> 'cancelled'
)
SELECT id, keep_id
FROM ranked_docs
WHERE rn > 1;

-- Move whole department sections when the canonical PR does not already have
-- that department.
UPDATE public.product_request_dept_sections s
   SET doc_id = d.keep_id
  FROM pr_duplicate_docs_to_merge d
 WHERE s.doc_id = d.duplicate_id
   AND NOT EXISTS (
     SELECT 1
       FROM public.product_request_dept_sections keep_s
      WHERE keep_s.doc_id = d.keep_id
        AND keep_s.department = s.department
   );

-- If both docs have the same department section, preserve items by moving them
-- into the canonical section.
UPDATE public.product_request_items i
   SET section_id = keep_s.id
  FROM pr_duplicate_docs_to_merge d
  JOIN public.product_request_dept_sections dup_s
    ON dup_s.doc_id = d.duplicate_id
  JOIN public.product_request_dept_sections keep_s
    ON keep_s.doc_id = d.keep_id
   AND keep_s.department = dup_s.department
 WHERE i.section_id = dup_s.id;

-- Delete duplicate sections after their items have either moved with the whole
-- section or moved into matching canonical sections.
DELETE FROM public.product_request_dept_sections s
 USING pr_duplicate_docs_to_merge d
 WHERE s.doc_id = d.duplicate_id;

-- Keep duplicate docs as cancelled audit history, but remove them from active
-- workflow views and from the active uniqueness rule.
UPDATE public.product_request_docs dup
   SET status = 'cancelled',
       notes = trim(both from concat_ws(
         E'\n\n',
         nullif(dup.notes, ''),
         'Automatically consolidated because Greenroom now allows one active product request per campaign shoot day. Merged into ' || keep.doc_number || '.'
       )),
       updated_at = now()
  FROM pr_duplicate_docs_to_merge d
  JOIN public.product_request_docs keep ON keep.id = d.keep_id
 WHERE dup.id = d.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pr_docs_one_active_per_campaign_day
  ON public.product_request_docs(campaign_id, shoot_date)
  WHERE status <> 'cancelled';

NOTIFY pgrst, 'reload schema';
