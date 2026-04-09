@AGENTS.md

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
