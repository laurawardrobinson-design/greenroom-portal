@AGENTS.md

## Release Workflow

For any shipping/release/deploy task, follow [`RELEASE_PLAYBOOK.md`](./RELEASE_PLAYBOOK.md).
When preparing a PR, use the checklist in [`.github/pull_request_template.md`](./.github/pull_request_template.md).

The Greenroom logo is an IMAGE (`/greenroom-logo.png`), not styled text.
Do not create or adjust text-based logo treatments with letter-spacing/tracking.

## Tile Headers

Every tile/card/section on a page must use a consistent **tile header** pattern:

- **Text**: `text-sm font-semibold uppercase tracking-wider text-text-primary`
- **Icon**: `h-4 w-4 shrink-0 text-primary` — always present, placed before the title
- **Layout**: `flex items-center gap-2` for icon + title
- **Container**: `px-3.5 py-2.5` padding, with `border-b border-border` separating the header from the tile body. The Card must use `padding="none"` so the header controls all spacing — no extra card-level padding stacking above it.
- **ALL CAPS**: tile headers are always uppercase via the `uppercase` class

The `CollapsibleSection` component already implements this pattern for sidebar sections. Standalone tiles (calendar, shoot days, shot list, documents, etc.) must match this same style exactly. Do not use `text-xs` or smaller for tile headers.

## WF Number Format

WF numbers always appear inline with the campaign name, separated by a single space: **`WF260401 Summer Grilling Hero`**

- **No dot, no dash, no separator character** between WF number and campaign name. Ever.
- This applies everywhere in the app: page titles, breadcrumbs, dropdowns, cards, list rows, dashboards, asset studio, call sheets — everywhere.
- Pattern: `` `${wfNumber} ${name}` `` or `[wfNumber, name].filter(Boolean).join(" ")`
- Never use ` · `, ` - `, ` — `, or any other separator between WF number and campaign name.

## Product Request Cardinality

There is exactly one active product request per campaign shoot day.

- Key rule: one active PR for each `campaign_id` + `shoot_date`.
- If one already exists, open/reuse it instead of creating another.
- Multiple departments, pickup windows, or item batches must live inside the one PR for that day.
- Cancelled PRs are historical exceptions and do not count as active.

## Page Spacing

The space above the page header and the space below the header line must be visually equal. This is enforced globally via CSS variables in `globals.css` — do not override with inline padding or margin on individual pages.

- **`--density-page-content-py`** controls the top (and bottom) padding of the entire page content area. Default: `1rem`. Compact: `0.875rem`.
- **`--density-page-header-pb`** controls the breathing room between the header title/actions and the bottom border line. Default: `1rem`. Compact: `0.875rem`.
- These two values must always be equal so the header title sits at the same visual distance from the topbar above it as it does from the content below it.
- Never increase `--density-page-content-py` or decrease `--density-page-header-pb` independently — they move together.

## Page Wrapper Space-Y Rule

The outermost page wrapper `div` must always use `space-y-4`. Never use `space-y-5` or `space-y-6` at the page wrapper level — these make the gap below the header look too loose relative to the CSS variable spacing enforced by `--density-page-content-py` and `--density-page-header-pb`.

- This applies to every page under `app/(portal)/` and every dashboard component under `components/dashboard/`
- It applies whether the page uses `<PageHeader>` or a custom `<h1>` heading
- Do NOT change `space-y-*` on inner content sections (cards, tiles, lists, columns) — only the outermost wrapper
- Do NOT change intentional `space-y-0` wrappers that collapse `<PageHeader>` + `<PageTabs>` together

## No Explanation / Hint / Fluff Lines

Do NOT add coaching, instruction, or explanation lines next to form fields, labels, or sections. The label and the placeholder are the spec — nothing else.

- No tertiary "hint" text next to labels (e.g., "One sentence. The shape of the win.", "If they only remember one thing...", "The non-negotiables.", "Metrics or a qualitative read we'll look for.").
- No helper paragraphs under section headers explaining what the section is for.
- No tooltip-style descriptors describing the obvious.
- If a field needs guidance, put it in the placeholder — once.
- Trust the user. They know what an "Objective" field is for.

## Page Header Rules

Every page follows this exact structure — no exceptions:

1. **Pages with tabs use two border lines** — one from `<PageHeader>` (default `showDivider={true}`, renders `border-bottom` below the title) and one from the tab container (`<div className="border-b border-border">` wrapping `<nav className="ui-tabs">`). This creates the gold-standard sandwich: line above tabs, line below tabs.
2. **Never pass `showDivider={false}` to `<PageHeader>` on a page that has tabs.** The header border is the top line; removing it breaks the pattern.
3. **Wrap `<PageHeader>` + tab container in `<div className="space-y-0">`** so they collapse flush with no gap between the header border and the tab row.
4. **If a page has no tabs**, `<PageHeader>` with default `showDivider={true}` gives the single line below the title — no tab container needed.
5. **`CampaignSectionTabs` always uses default `showDivider` (true)** — never pass `showDivider={false}` to it.
6. **Title and actions are vertically centered.** The `.ui-page-header-row` flex container uses `align-items: center`. Never override with `items-end` / `items-start` / `items-baseline` on header rows or any container that places a heading next to action buttons. The title and the buttons must sit on a shared horizontal centerline — never with the heading visually hanging below or above the actions.

## Minimum Text Size

No text anywhere in the app should be smaller than 10px. The minimum Tailwind class is `text-[10px]`. Never use `text-[9px]` or smaller.

## Typography — Inter only, no exceptions

**Inter is the only typeface allowed anywhere in this app.** Not monospace for WF numbers, not monospace for IDs / amounts / PO numbers / filenames. Not serif. Everything — every label, every chip, every number, every ID — is Inter.

- Loaded via `next/font/google` in `app/layout.tsx` as the CSS variable `--font-inter`.
- In `app/globals.css`, `--font-sans` **must** reference `var(--font-inter)`, never a literal `"Inter"` string — a literal string resolves to whatever Inter happens to be installed on the user's machine, which can differ from the bundled webfont and reads as "a weird font."
- Never use `font-mono`. Never use `font-serif`. Never introduce another `@font-face` or `next/font` import.
- Never use `tabular-nums`. It keeps the Inter family but swaps number glyphs to fixed-width figures, which reads as a different font in WF numbers, dates, IDs, and amounts.
- If you see `font-mono`, `font-serif`, or `tabular-nums` in existing code, strip it.
- SVG text must use `fontFamily="var(--font-sans)"`, not a hand-written system fallback stack.
- If a rendering looks off, check the computed `font-family` with `preview_inspect` before assuming it's fine.
