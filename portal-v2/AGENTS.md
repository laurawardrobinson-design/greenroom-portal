<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Typography

Inter is the only typeface allowed anywhere in this app. This includes labels, buttons, WF numbers, IDs, dates, counts, prices, PO numbers, filenames, SVG text, and generated documents.

- Use the app font stack from `app/layout.tsx` and `app/globals.css`.
- Never use `font-mono`, `font-serif`, handwritten font stacks, or additional `next/font` imports.
- Never use `tabular-nums`. It changes Inter's number glyphs to fixed-width figures and makes numbers look like a different font.
- SVG text must use `fontFamily="var(--font-sans)"`.

## Product Requests

There is exactly one active product request per campaign shoot day.

- Do not create a second active product request for the same `campaign_id` + `shoot_date`.
- If a product request already exists for that campaign/day, open or reuse it.
- Multiple departments, pickup needs, or item batches belong inside that one day's PR.
- Cancelled PRs are historical exceptions and do not count as active.
