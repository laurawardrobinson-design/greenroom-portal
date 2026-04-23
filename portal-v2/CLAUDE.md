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

## Minimum Text Size

No text anywhere in the app should be smaller than 10px. The minimum Tailwind class is `text-[10px]`. Never use `text-[9px]` or smaller.

## Typography — Inter only, no exceptions

**Inter is the only typeface allowed anywhere in this app.** Not monospace for WF numbers, not monospace for IDs / amounts / PO numbers / filenames. Not serif. Everything — every label, every chip, every number, every ID — is Inter.

- Loaded via `next/font/google` in `app/layout.tsx` as the CSS variable `--font-inter`.
- In `app/globals.css`, `--font-sans` **must** reference `var(--font-inter)`, never a literal `"Inter"` string — a literal string resolves to whatever Inter happens to be installed on the user's machine, which can differ from the bundled webfont and reads as "a weird font."
- Never use `font-mono`. Never use `font-serif`. Never introduce another `@font-face` or `next/font` import.
- If you see `font-mono` in existing code, strip it.
- If a rendering looks off, check the computed `font-family` with `preview_inspect` before assuming it's fine.
