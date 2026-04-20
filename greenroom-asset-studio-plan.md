# Asset Studio for Greenroom — Implementation Plan

*A Storyteq-equivalent module inside Portal V2. Built around what greenroom already knows: campaigns, shots, talent, products, deliverables.*

**Scope:** Full Storyteq parity, phased.
**New role:** "Designer" added alongside Admin / Producer / Post Producer / Studio / Vendor / Art Director.
**Metadata leveraged:** product/catalog (`campaign_products`, `shot_product_links`), channel/placement specs (`campaign_deliverables`), shot list with talent (`shot_list_shots`, `shot_talent`).

---

## 1. Why This Fits Greenroom Naturally

Storyteq sits *downstream* of production — it takes finished assets and turns them into hundreds of channel-ready, market-ready variants. Greenroom sits *upstream* — it manages the production that creates those assets in the first place.

What that means is unusual and valuable: **greenroom already owns the source-of-truth metadata Storyteq has to manually re-collect from clients.** A Storyteq-style module bolted onto greenroom doesn't need a "set up your campaign" wizard, doesn't need to ask what channels you're delivering to, doesn't need to ask which products are in the shot. Greenroom already knows:

- Which deliverables belong to the campaign (`campaign_deliverables` — channel, format, width, height, aspect ratio, quantity)
- Which shots are linked to which deliverables (`shot_deliverable_links`)
- Which products / SKUs are in each shot (`shot_product_links` → `campaign_products` → `products`)
- Which talent is in each shot, with full demographic and wardrobe attributes (`shot_talent`)
- The shot's surface, lighting, food styling, retouching notes (`shot_list_shots`)
- The retouching flag and the post-production handoff state
- The full file pile in `campaign_assets` (categorised — Deliverable, Shot List, Concept Deck, Reference, etc.)

That is the exact metadata Storyteq's Adaptation Studio leans on — and in the marketing-tech world it's normally lossy data scraped from spreadsheets and emails. Greenroom captures it natively at the moment of production.

**The strategic framing for the new module:** "Asset Studio" closes the loop on the campaign lifecycle. Campaign → Shoot → Asset Studio → Channel-ready output. Today's lifecycle ends at "deliverables uploaded." With Asset Studio it ends at "1,200 channel-ready variants delivered to media, with brand governance enforced."

---

## 2. Naming and Placement

### What to call it

**"Asset Studio"** — recommended.

Why:
- Mirrors Storyteq's "Adaptation Studio" without copying it.
- "Studio" is already greenroom's vocabulary (Studio role, Studio Management section).
- Avoids "creative automation" — too tech / SaaS-y for an internal grocery studio.
- Works for both photo (resize/recolour/retouch routing) and video (cut-down/aspect/locale) flows.

Alternative candidates considered: *Versioning, Output Studio, Deliverable Builder, The Cutting Room.* "Asset Studio" wins on continuity and honesty.

### Where it lives in the IDE

Add `Asset Studio` to the sidebar, right between **Post Production** and **Gear**. This is the natural lifecycle position — once the shoot is done and the post handoff is alive, Asset Studio is the next stop.

| Sidebar position | Item | Roles |
|---|---|---|
| 1 | Dashboard | all |
| 2 | Campaigns | all |
| 3 | Pre Production | Admin / Producer / Post Producer |
| 4 | Studio Management | Admin / Producer / Post Producer / Studio |
| 5 | Post Production | Admin / Producer / Post Producer |
| **6** | **Asset Studio (new)** | **Admin / Producer / Post Producer / Designer / Art Director** |
| 7 | Gear | … |
| … | (existing) | |

### Within the campaign command center

Add a new collapsible section to `app/(portal)/campaigns/[id]/page.tsx` titled **"Asset Studio"**, sitting after **Post Workflow** and before **Vendors**. It surfaces:

- # of templates registered against this campaign
- # of variants generated
- # of variants pending approval
- "Open in Asset Studio" CTA

---

## 3. The New User Role

### Role: `Designer`

Add `Designer` to the `user_role` enum. Sits alongside Art Director (creative oversight) but with a different focus:

| Role | Owns |
|---|---|
| Art Director | Creative direction, shot list quality, retouching flags |
| Post Producer | Post-production workflow, edit room scheduling, drives |
| **Designer (new)** | **Templates, brand governance, output authoring, variant configuration** |

A Designer is the in-house Publix designer / mograph artist who builds the templates that downstream variants come from. They also approve final variants for brand correctness.

### Permission additions (`lib/auth/roles.ts`)

```
assets: {
  view:         ["Admin", "Producer", "Post Producer", "Designer", "Art Director"],
  manageTemplates:  ["Admin", "Designer"],
  configureRun:     ["Admin", "Producer", "Post Producer", "Designer"],
  triggerRender:    ["Admin", "Producer", "Post Producer", "Designer"],
  approveVariants:  ["Admin", "Designer", "Art Director"],
  publishToChannel: ["Admin", "Producer", "Post Producer"],
  manageBrandTokens:["Admin", "Designer"],
}
```

### Route additions

`/asset-studio` — dashboard, templates, runs, variants, brand tokens, channel destinations. Open to the five roles above. Studio and Vendor are excluded by default; can be widened later.

### Migration

A new migration (e.g. `049_designer_role_and_asset_studio_core.sql`) does three things:

1. `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Designer';` (mirrors `066_post_producer_role.sql`)
2. Adds the new tables (see §5)
3. Seeds a test user `designer@test.local / testpass123456` named "Daniel" (Publix in-house designer)

---

## 4. Mapping Storyteq → Greenroom

A direct concept-by-concept map so the build doesn't drift.

| Storyteq concept | Greenroom-native name | Built on |
|---|---|---|
| Content Portal (DAM + Brand Hub) | **Asset Library** | `campaign_assets` + new `brand_tokens` table + tagging |
| Adaptation Studio | **Asset Studio** | new `templates`, `template_layers`, `variant_runs`, `variants` tables |
| Collaboration Hub | (already exists) | `campaign_assets` review states + new `variant_approvals` |
| Template Builder (browser) | **Template Builder** (in `/asset-studio/templates/[id]/edit`) | React + a small layer-tree editor |
| AE Extension | **AE Bridge** (later phase) | export script that pushes `.aep` + manifest JSON to a new endpoint |
| Figma plugin | **Figma Bridge** (later phase) | Figma plugin that posts frame JSON + image exports |
| Dynamic rules / dynamic layers | **Dynamic layers + binding rules** | layer table with `is_dynamic`, `binding_source`, `constraints` |
| Batch Creator (UI) | **Run Builder** | `variant_runs` driven from a CSV or from in-app data picker |
| sFTP feed ingestion | **Feed Ingest** (later phase) | Supabase Storage drop folder + Edge Function watcher |
| Output formats (MP4, HTML5, PNG, JPG, PDF) | same | Supabase Storage outputs bucket + render workers |
| Render farm | **Render Workers** | initially: containerised ffmpeg + Sharp + Puppeteer workers; later: real workers per format |
| Smart Resize / BG removal / object swap | **AI Tools** (smart crop, bg-remove) | Anthropic Claude (vision) for prompts; Sharp for crops; rembg or Replicate for bg-remove |
| Adobe Firefly integration | **Generative Fill / Variant Copy** (later phase) | Replicate or direct Firefly API for image; Claude for copy |
| Brand templates / locked layers | **Locked layers + Brand Tokens** | layer.locked + `brand_tokens` table (colour, type, logo, ratio) |
| Multi-language localisation | **Locale Variants** | `locales` table; localised copy in `template_layer_strings` |
| Audit trail / version history | (already exists) | `audit_logs` table; extend to template + variant events |
| Distribution (Meta, DV360, etc.) | **Channel Destinations** | `channel_destinations` table; v1: download-only; later: Meta/DV360 API push |

The right mental model: greenroom's existing schema gives us roughly **70% of the metadata Storyteq depends on** for free. The Asset Studio module is mostly *new tables for templates, variants, runs, and brand tokens* + *render orchestration* + *a designer-grade UI*.

---

## 5. Data Model — New Tables

All new tables RLS-enabled, all referenced via service-layer files (`lib/services/asset-studio/*.service.ts`).

### Brand foundation

**`brand_tokens`** — versioned brand primitives (Publix). Single brand for greenroom, but versioned so brand refreshes don't blow up old templates.

```
brand_tokens
  id uuid pk
  token_set_version int           -- "Publix v3" etc.
  effective_from timestamptz
  payload jsonb                   -- { colors:{...}, type:{...}, logos:[...], spacing:{...} }
  is_active boolean
```

**`brand_logos`** — separate table for binary blobs. Each logo stored in a new `brand-assets` bucket.

### Templates

**`templates`** — a master adaptation spec. Owned by a Designer; tied to an optional campaign or to "global."

```
templates
  id uuid pk
  name text
  description text
  kind text check (kind in ('static','html5','video','print'))
  status text check (status in ('Draft','In Review','Published','Archived'))
  campaign_id uuid null references campaigns(id)   -- null = global / library
  brand_token_version int references brand_tokens(token_set_version)
  base_canvas_w int
  base_canvas_h int
  duration_ms int null              -- video only
  preview_thumb_url text
  authoring_source text             -- 'browser','figma','after_effects'
  authoring_source_ref text         -- Figma node id, AE project id
  created_by uuid references users(id)
  created_at timestamptz
  updated_at timestamptz
```

**`template_layers`** — every layer in the template. The "dynamic vs locked" rule lives here.

```
template_layers
  id uuid pk
  template_id uuid references templates(id) on delete cascade
  parent_layer_id uuid null references template_layers(id)  -- for groups / pre-comps
  layer_type text check (layer_type in
    ('text','image','video','shape','logo','scene','group','audio'))
  name text                         -- "Headline", "Product Hero", "Disclaimer"
  z_order int
  is_dynamic boolean default false
  is_locked boolean default false   -- explicitly locked even if dynamic-eligible
  binding_source text null          -- 'product','talent','shot','copy_pool','feed','none'
  binding_path text null            -- e.g. 'product.name' / 'shot.deliverable.headline'
  constraints jsonb                 -- { maxChars:60, minFontSize:14, allowedColors:['#69A925','#10442B'], allowedRatios:[...] }
  default_payload jsonb             -- starting state shown in builder
  position jsonb                    -- {x,y,w,h,rot}
  style jsonb                       -- font, weight, color, etc.
```

**`template_output_specs`** — what the template can render *into*. Pre-bound to greenroom's existing `campaign_deliverables.channel/format/width/height/aspect_ratio`.

```
template_output_specs
  id uuid pk
  template_id uuid references templates(id) on delete cascade
  channel text                      -- 'Instagram Story','OOH 6-sheet','Weekly Ad','In-store EPOS'
  format text                       -- 'MP4','PNG','JPG','PDF','HTML5'
  width int
  height int
  aspect_ratio text
  fps int null
  bitrate_kbps int null
  derived_from_deliverable_id uuid null references campaign_deliverables(id)
  notes text
```

The `derived_from_deliverable_id` link is the magic move: when a Producer creates `campaign_deliverables` rows for the campaign, the Asset Studio offers them as one-click output specs on any template the campaign uses.

### Runs and variants

**`variant_runs`** — one row per "go produce a batch." This is the unit of work for marketing.

```
variant_runs
  id uuid pk
  template_id uuid references templates(id)
  campaign_id uuid references campaigns(id)
  initiated_by uuid references users(id)
  source text check (source in ('csv','data_picker','feed','single'))
  source_payload jsonb              -- the CSV rows / picked row sets / feed batch id
  status text check (status in
    ('Drafting','Queued','Rendering','Needs Review','Approved','Published','Failed','Cancelled'))
  variant_count int
  output_spec_ids uuid[]            -- which template_output_specs to render
  scheduled_at timestamptz null
  started_at timestamptz null
  completed_at timestamptz null
  error text null
```

**`variants`** — one rendered output. Rich metadata so the library is searchable.

```
variants
  id uuid pk
  variant_run_id uuid references variant_runs(id) on delete cascade
  template_id uuid references templates(id)
  output_spec_id uuid references template_output_specs(id)
  binding_payload jsonb             -- the resolved row that produced this variant (snapshot)
  product_ids uuid[]                -- denormalised for filter speed
  talent_ids uuid[]
  shot_id uuid null references shot_list_shots(id)
  locale text                       -- 'en-US','es-US','en-PR' etc.
  file_url text
  file_name text
  file_size bigint
  mime_type text
  width int
  height int
  duration_ms int null
  thumb_url text
  status text check (status in
    ('Rendering','Ready','Approved','Rejected','Published','Archived'))
  approved_by uuid null references users(id)
  approved_at timestamptz null
  rejection_reason text null
  created_at timestamptz
```

**`variant_approvals`** — explicit review chain so brand governance is auditable.

```
variant_approvals
  id uuid pk
  variant_id uuid references variants(id) on delete cascade
  reviewer_id uuid references users(id)
  decision text check (decision in ('approved','rejected','requested_changes'))
  comment text
  created_at timestamptz
```

### Localisation and copy

**`locales`** — registered locales for the campaign (Publix is mostly en-US plus es-US in some markets).

```
locales
  id uuid pk
  code text unique                  -- 'en-US','es-US','en-PR'
  display_name text
  is_default boolean
```

**`template_layer_strings`** — localised variants of any text layer.

```
template_layer_strings
  id uuid pk
  template_layer_id uuid references template_layers(id) on delete cascade
  locale_id uuid references locales(id)
  text text
```

### Distribution

**`channel_destinations`** — where finished variants go.

```
channel_destinations
  id uuid pk
  name text                         -- 'Meta Ads — Publix Brand','In-store EPOS Network','Weekly Circular Ftp'
  kind text check (kind in
    ('download','meta_ads','dv360','tiktok','sftp','email','epos_drop'))
  config jsonb                      -- credentials/refs (encrypted via Supabase Vault)
  is_active boolean
```

**`variant_publishes`** — log of each push.

```
variant_publishes
  id uuid pk
  variant_id uuid references variants(id)
  destination_id uuid references channel_destinations(id)
  status text check (status in ('pending','succeeded','failed'))
  external_id text null             -- platform-side ad/asset id
  pushed_by uuid references users(id)
  pushed_at timestamptz
  error text null
```

### Storage buckets

Three new Supabase Storage buckets:

| Bucket | Access | Content |
|---|---|---|
| `templates` | RLS | template thumbnails, exported `.aep` / `.fig` source bundles |
| `variants` | RLS | rendered variant outputs (large; lifecycle rule: archive after 180 days) |
| `brand-assets` | RLS | Publix logos, brand fonts (licensed), token-set image refs |

---

## 6. Architecture and Render Pipeline

### Service layer additions

```
lib/services/asset-studio/
  templates.service.ts        — CRUD + publish/version
  template-layers.service.ts  — layer tree, binding rules, validation
  output-specs.service.ts     — derive from campaign_deliverables
  brand-tokens.service.ts     — token sets, versioning
  runs.service.ts             — create, validate, queue
  variants.service.ts         — list, filter, approve, reject
  channels.service.ts         — destinations + publishes
  ai.service.ts               — smart crop, bg-remove, copy gen wrappers
```

Validation lives in `lib/validation/asset-studio/*.schema.ts` (Zod), mirroring existing pattern.

### API routes

```
app/api/asset-studio/
  templates/[GET, POST, PATCH, DELETE]
  templates/[id]/layers
  templates/[id]/output-specs
  templates/[id]/preview              — server-rendered preview frame
  brand-tokens
  runs                                — POST = create + queue
  runs/[id]
  runs/[id]/cancel
  variants
  variants/[id]/approve
  variants/[id]/reject
  variants/[id]/publish
  channels
  ingest/feed                         — Edge Function entry point (later)
  ingest/figma                        — plugin webhook (later)
  ingest/after-effects                — AE bridge webhook (later)
```

### Render orchestration

Storyteq runs its own render farm. Greenroom doesn't need that on day one. Phased approach:

**Phase 1 — Inline renders (statics only).**
- Static images (PNG, JPG): use `sharp` inside an API route or Vercel Edge runtime (Edge has no Node Sharp; use `@vercel/og` for compositing).
- HTML5 banners: server-render an HTML template with bound variables, screenshot via Puppeteer (run on a Vercel serverless function or a tiny render service).

**Phase 2 — Background workers (video).**
- Stand up a separate render service (Cloud Run or Fly.io) running `headless-aerender` (CLI for After Effects) **or** an alternative like `nexrender`, **or** ffmpeg-based composition for simpler video.
- Workers pull from a `variant_runs` queue (Postgres `LISTEN/NOTIFY` or a small Redis queue).
- Outputs land in the `variants` bucket; webhook back to greenroom updates the variant row.

**Phase 3 — AE Bridge.**
- An AE script-extension that exports a `.aep` + a manifest JSON describing dynamic layers. Mograph designers keep working in AE.
- Same render workers handle these jobs.

**Phase 4 — Figma Bridge.**
- A Figma plugin that posts node JSON + image exports to `/api/asset-studio/ingest/figma`.
- Greenroom converts the export into a `template` + `template_layers`.

This phasing matches Storyteq's own evolution and lets value land in months, not quarters.

### Dependencies (npm)

New (estimated):
- `sharp` — static image compositing and crop
- `@vercel/og` — OpenGraph-style HTML→PNG (good for banners)
- `puppeteer-core` + `@sparticuz/chromium` — HTML5 banner captures on Vercel
- `papaparse` — CSV parsing for run inputs
- `zod` — already present
- (optional) `replicate` SDK — for bg-remove + generative fill via Replicate hosted models
- (optional) `@anthropic-ai/sdk` — already implied by invoice-parser Edge Function; reuse for copy generation

---

## 7. Visual Design Language — Storyteq-mirror, with restraint

The rest of greenroom is editorial / boutique-agency premium. Asset Studio breaks from that on purpose. Storyteq's UI is enterprise-clean: very white, lots of whitespace, hairline borders instead of shadows, asset-forward (the work is the hero, not the chrome), and brand colour used so sparingly you almost forget it's there. We adopt that aesthetic *inside* the Asset Studio canvas, while keeping greenroom's outer shell so users never feel they've left the app.

The Publix brand greens stay in the system but are demoted to accents. Greenroom's logo and sidebar stay as they are — that's the "you're still in greenroom" signal. Everything inside the Asset Studio main area is light, neutral, and quiet.

### 7.1 Design intent in one sentence

*The chrome quiets so the asset speaks.*

When you enter Asset Studio, the visual temperature drops: backgrounds go near-white, borders go from soft shadows to hairlines, type tightens, and the only colour with weight is the asset thumbnail itself.

### 7.2 Colour system

**Used everywhere (the neutral foundation):**

| Token | Value | Use |
|---|---|---|
| `--as-bg` | `#FFFFFF` | Page background |
| `--as-surface` | `#FAFAFA` | Card hover, table row hover, secondary panels |
| `--as-surface-2` | `#F4F4F5` | Tertiary fills (chip backgrounds, code blocks) |
| `--as-border` | `#E5E5E5` | Hairline borders on cards, tables, dividers |
| `--as-border-strong` | `#D4D4D8` | Borders that need weight (input outlines, primary card frames) |
| `--as-text` | `#0A0A0A` | Primary type |
| `--as-text-muted` | `#52525B` | Secondary type, labels |
| `--as-text-faint` | `#A1A1AA` | Tertiary type, placeholders, metadata |

**Used sparingly (the brand-restricted accents):**

Only these moments get Greenroom green (`--color-primary` `#69A925`):

1. The primary action button (one per page max — "Render run", "Publish", "Approve all")
2. The active tab underline in the inner Asset Studio tab bar
3. The "Approved" status chip (and only that — other statuses are monochrome)
4. The headline number on a metric card (e.g. **482** variants — only the digit is green)
5. The brand-token swatch on the Brand console where green *is* the token

The deeper Greenroom green (`--color-sidebar` `#10442B`) is **not** used in Asset Studio at all, except where the global sidebar already paints it. Inside the canvas: zero deep green.

**Status palette (muted, monochrome-leaning):**

| Status | Background | Foreground |
|---|---|---|
| Approved | `#E8F5E0` | `#3D6614` (Publix green darkened for AA contrast) |
| In review | `#F4F4F5` | `#52525B` |
| Rendering | `#EFF6FF` | `#1E40AF` (used minimally) |
| Failed | `#FEF2F2` | `#991B1B` |
| Draft | transparent | `#52525B` (text-only chip with border) |

No second brand colour is ever introduced. No purples, no oranges except the Publix-warning `#D97706` for genuinely warning states.

### 7.3 Typography

Continue Inter (already loaded). Tighten the scale vs the rest of greenroom — Storyteq's UI runs more compact:

| Use | Size | Weight | Tracking | Notes |
|---|---|---|---|---|
| Page title | 24px | 600 | -0.02em | Single line, never wrap |
| Section eyebrow | 11px | 600 | 0.08em uppercase | Muted colour, sits above section title |
| Section title | 16px | 600 | -0.01em | |
| Body | 14px | 400 | normal | |
| Metadata | 12px | 500 | normal | Muted colour |
| Metric number | 32px | 600 | -0.03em tabular-nums | The only place where numbers carry visual weight |
| Button label | 13px | 500 | normal | |
| Filter chip | 12px | 500 | normal | |

Line-height: 1.5 for body, 1.2 for headlines, 1.0 for metric numbers.

### 7.4 Layout grid

- 12-column grid, 24px gutters (vs greenroom's looser 5/8 layouts)
- Page max-width 1440px; comfortable centre on wide monitors
- Section vertical rhythm: 32px between sections (vs greenroom's typical 20px)
- Cards: 20px padding (vs typical 16px)
- The variant grid is the hero pattern: four to six columns of 1:1 thumbs at desktop, three at tablet, two at phone

### 7.5 Components

**Buttons.** 32px tall, 6px radius, 13px medium label.

| Variant | Spec |
|---|---|
| Primary | Solid Greenroom green `#69A925`, white label, no border, no shadow. Hover: darken 6%. |
| Secondary | White, 1px `--as-border-strong` border, dark text. Hover: `--as-surface`. |
| Tertiary | No border, no fill. Hover: `--as-surface`. |
| Destructive | White, 1px `#FECACA` border, `#991B1B` text. Hover: `#FEF2F2`. |

Only ONE primary per page. Secondary handles everything else. (This is the rule that keeps things looking Storyteq-clean.)

**Cards.** White, 1px `--as-border`, 12px radius, no shadow at rest, `0 4px 12px rgba(0,0,0,0.04)` shadow on hover. Padding 20px. Headers in section-eyebrow + section-title pattern.

**Tabs.** Underline pattern, not pills. 13px medium label, muted at rest, dark on hover, dark + 2px Greenroom-green underline on active. Distance between tabs 24px.

**Status chips.** 22px tall, 11px label, 8px horizontal padding, 4px radius. Monochrome by default — only "Approved" carries colour. Optional 6px dot to the left.

**Filter chips.** Smaller — 24px tall, 12px label, 6px radius, surface-2 background, optional ✕ to remove. Active state: 1px dark border, no fill change.

**Inputs.** 36px tall (a touch taller than buttons for clear hit), 1px `--as-border-strong`, 6px radius, 14px text. Focus: 2px outer ring `#69A925` at 30% opacity.

**Tables.** 48px row height, 1px `#F5F5F5` row separators, header row uppercase 11px muted, hover row `--as-surface`. No zebra striping.

**Empty states.** Centred, 40% page width max, single line eyebrow + 18px title + 14px muted description + one secondary button. No illustrations on day one — keep it Linear-clean.

**Skeletons.** Use `--as-surface-2` blocks with a slow pulse (1.4s). No shimmer animation — Storyteq's loading states are quiet, not flashy.

### 7.6 The variant grid (the hero pattern)

This is the single most important visual moment because it's where users spend most of their time. The pattern:

```
┌──────────────────────────────────────────────────────────────┐
│  Spring Citrus Run · 124 variants · 3 specs · 2 locales      │
│  Filters: ▾ Spec  ▾ Status  ▾ Locale  ▾ Talent  + reset      │
├──────────────────────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │
│  │      │  │      │  │      │  │      │  │      │  │      │ │
│  │ thumb│  │ thumb│  │ thumb│  │ thumb│  │ thumb│  │ thumb│ │
│  │      │  │      │  │      │  │      │  │      │  │      │ │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘ │
│  1080×1080  1080×1350 1080×1080 ...                          │
│  ● Approved ○ Review  ● Approved                             │
└──────────────────────────────────────────────────────────────┘
```

- 1:1 thumbnails on a near-white grid
- 12px gap, 6px corner radius on the thumb
- 1px hairline border on the thumb (so it sits on white without disappearing)
- Below the thumb: 11px muted spec label + 11px status with leading dot
- Hover: full-card hover zone darkens to `--as-surface`, an action overlay slides up from the bottom of the thumb (`Approve · Reject · Open`)
- Selected: 2px Greenroom-green outer ring with 2px white inner gap

That's it. No card frames around each variant, no badges piled on top, no shadows. Asset speaks.

### 7.7 The metric card row

Storyteq leans on a row of 4 metric cards across the top of dashboards. We copy that gesture:

- 4 cards across, equal width, 16px gap
- Each card: white, 1px hairline, 20px padding, 92px tall
- Layout per card: 11px eyebrow / 32px metric number / 12px muted delta
- The metric number is the *only* place green appears in the row

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ VARIANTS THIS MO │ │ PENDING APPROVAL │ │ TEMPLATES LIVE   │ │ BRAND ALERTS     │
│ 482              │ │ 6                │ │ 14               │ │ 1                │
│ +18% vs last     │ │ 2 due today      │ │ 3 in draft       │ │ Token v3 not yet │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
```

### 7.8 Sidebar continuity (the bridge)

Greenroom's sidebar stays exactly as it is — the deep green wall is the thing that says "you're still in greenroom." But the active-state for `Asset Studio` in the sidebar uses a slightly different signal: instead of the bright-green bullet dot used by other items, the active row gets a 2px left border in the same green. It's a subtle hand-off — the moment the visual language begins to shift.

### 7.9 What NOT to do

- No second brand colour. Don't introduce purple, blue, orange.
- No heavy shadows. The whole canvas is held together by 1px hairlines.
- No gradients except inside variant thumbnails (which are user content, not chrome).
- No pillification. Statuses are chips, but cards aren't pills, buttons aren't pills, tabs aren't pills.
- No editorial flair. Asset Studio is a tool. Save the boutique-magazine moves for the campaign command center.
- No icons on every label. Only on tabs and on primary actions. Storyteq is restrained with iconography.

### 7.10 Concrete CSS tokens to add

In `app/globals.css`, scope a new `@layer` or a `[data-area="asset-studio"]` selector so these tokens only apply inside the Asset Studio canvas — the rest of greenroom is untouched:

```
[data-area="asset-studio"] {
  --as-bg: #FFFFFF;
  --as-surface: #FAFAFA;
  --as-surface-2: #F4F4F5;
  --as-border: #E5E5E5;
  --as-border-strong: #D4D4D8;
  --as-text: #0A0A0A;
  --as-text-muted: #52525B;
  --as-text-faint: #A1A1AA;
  --as-radius-sm: 6px;
  --as-radius-md: 12px;
  --as-shadow-hover: 0 4px 12px rgba(0,0,0,0.04);
  --as-page-gap: 32px;
  --as-card-pad: 20px;
}
```

The Asset Studio root layout (`app/(portal)/asset-studio/layout.tsx`) sets `data-area="asset-studio"` on its container. Greenroom's existing tokens stay unchanged.

### 7.11 A one-line guide for every PR

*"If this change doesn't make either the asset more visible or the chrome more invisible, it's the wrong change."*

---

## 8. UX — Page-by-Page

The design bar is set in the context doc: editorial, premium, generous whitespace, Linear/Apple-grade — never default Bootstrap. All new pages use the existing patterns: `CollapsibleSection`, `PageTabs`, status pills, page header pattern, sidebar position 6.

### `/asset-studio` — landing dashboard

```
[ Asset Studio ]  Variants generated this month: 482   |  Pending approval: 6   |  Templates published: 14
─────────────────────────────────────────────────────
[ Tabs: Overview · Templates · Runs · Variants · Brand · Channels ]

OVERVIEW
  [Tile]  Active Runs (3)              [Tile]  Needs My Approval (6)
  [Tile]  Recently Published (12)      [Tile]  Brand alerts (1: token v3 not yet adopted by 2 templates)
  [List]  Recent runs by campaign — small thumbs, status, # variants, owner
```

Designer-first lens; secondary lens for Producer ("what's mine in flight?").

### `/asset-studio/templates`

A grid of template cards, each showing thumbnail + kind (Static / HTML5 / Video / Print) + status pill + campaign tag (or "Library") + last-edited.

Filter: kind, status, campaign, brand-token version, owner.

### `/asset-studio/templates/[id]/edit` — Template Builder

Two-pane editor:

- **Left rail:** layer tree. Each layer row shows the layer name, an icon for type, and three controls: 🔒 lock toggle, ⚡ dynamic toggle, ⚙ rules. Drag to reorder.
- **Centre:** preview canvas with rulers + safe-area overlay for the active output spec (toggle between specs in a top dropdown).
- **Right rail:** properties for the selected layer:
  - For text: source (literal / `product.name` / `shot.headline` / locale string), max chars, min font, allowed colours, allowed fonts.
  - For image: source (literal / `product.image` / `shot.hero_image` / brand logo slot), allowed crop ratios, focal-point hint.
  - For video scene: source pre-comp options.
  - For shape: brand-token bound colour.

Top bar: Save, Save & Publish, Preview Run (renders 5 sample variants without queuing the full job), Brand-token version selector, Output specs editor (link to `/edit/output-specs`).

### `/asset-studio/runs/new` — Run Builder

Three-step modal-page:

1. **Pick the template** (with optional pre-selected from a campaign deep-link).
2. **Pick the data source:**
   - **CSV upload** — preview first 10 rows; map columns to dynamic layers; validation runs against template constraints.
   - **In-app data picker** — pick a campaign; choose which products from `campaign_products`, which talent rows from `shot_talent`, which deliverables / output specs to render. This is the killer move: the Producer never leaves greenroom and never re-enters product or shot data.
   - **Single shot** — render one variant for proofing.
3. **Pick output specs and channels.** Output specs default to those derived from the campaign's `campaign_deliverables`. Channel destinations are optional (variants always land in the library; publishing is a separate step).

Submit → row in `variant_runs`, queued.

### `/asset-studio/runs/[id]`

Live progress (SWR polling every 3s, switch to realtime later via Supabase Realtime):

- Progress bar (X of Y rendered)
- Variant grid as they complete (thumb + spec label + locale + bound row)
- Per-variant inline approve/reject (only for users with approve permission)
- Bulk actions: approve all, reject all, publish approved
- Errored variants get a row with a "retry" button

### `/asset-studio/variants`

Library view of every variant ever rendered. Faceted filters along the left:

- Campaign · Template · Status · Channel · Format · Locale · Talent · Product · Shot · Approved by · Date

Cards/grid with hover preview. This is where Producers come to find "the spring sale 1080×1080 with the strawberries and Talent T2."

### `/asset-studio/brand`

The brand console — a Designer's home page.

- Token sets (versioned). Show colour swatches, type ramp, logo bank, spacing tokens.
- "Promote" a token set to active: starts the migration banner on every old template.
- Logo bank with upload + lock metadata (which logo is the "primary CMYK," "1-colour reverse," etc.).
- Brand rulebook page (free-text + image embeds) — replaces "Brand Hub" in Storyteq.

### `/asset-studio/channels`

Configure channel destinations. v1: just "Local download (zipped)" and "Email to producer." Phase 2: Meta Ads, DV360, sFTP, EPOS drops.

### `/settings` extensions

Add a "Asset Studio" panel for per-user defaults (preferred output specs, default approval queue) and admin-only platform settings (brand token version policy, default render priority).

---

## 8. Integration with Existing Greenroom Flows

The point of building this *inside* greenroom rather than as a separate tool is that everything links.

| Existing area | Integration |
|---|---|
| **Campaigns** | New "Asset Studio" collapsible section on the campaign detail page. Shows templates linked to this campaign + variant counts + "Open in Asset Studio." |
| **Campaign Deliverables** | Each deliverable becomes a one-click output spec on any template. New "Generate variants for this deliverable" button on each row. |
| **Shot List** | New "Send to Asset Studio" action on a shot row — opens Run Builder pre-filled with that shot's products + talent + the shot's deliverable links. |
| **Products** | Product detail page gets "Used in N templates / M variants" badge + variant gallery. |
| **Talent** | `shot_talent` rows feed the Run Builder talent picker. Casting + asset versioning live in the same data. |
| **Post Production** | Asset Studio sits as a third tab on the existing `/post-workflow` page **and** as its own sidebar item. The tab is the "I'm in post and want to do versioning right now" entry; the sidebar item is the "I live in Asset Studio" entry. |
| **Vendors** | When a vendor delivers final retouched assets via the existing PO flow, Producer can flag them as "ingest as template source" — pre-populates a new draft template from the file. |
| **Budget** | Asset Studio doesn't directly consume budget today (it's an internal tool), but the cost categories already include `Post-Production`; later we add `Asset Production` if it ever has external spend. |
| **Audit logs** | Hook every `variants` and `templates` mutation into the existing `audit_logs` table. |
| **Notifications** | Reuse `016_notifications.sql`. New notification types: `variant_run_complete`, `variant_pending_approval`, `template_published`, `brand_token_promoted`. |
| **Approvals queue (Admin dashboard)** | Add Asset Studio rows: pending variant approvals, brand-token promotion requests. |
| **On-set mode** | "Generate now" small action on a shot card — for influencer / social-first content where a variant goes live the same day as the shoot. |

---

## 9. Phased Build Plan (full-parity ambition, sequenced)

This is the long-haul plan. Each phase ships independently.

### Phase 0 — Foundations *(2–3 weeks)*
- Add `Designer` role + permissions
- Migrations for `brand_tokens`, `templates`, `template_layers`, `template_output_specs`, `variant_runs`, `variants`, `variant_approvals`, `locales`
- Storage buckets: `templates`, `variants`, `brand-assets`
- Service layer skeletons + Zod schemas
- Sidebar entry + `/asset-studio` placeholder
- Test user `designer@test.local`
- Seed: one Publix brand-token set (colours, type, logos)

**Done when:** a Designer can log in, see Asset Studio in the sidebar, and the schema is in place.

### Phase 1 — Static templates, browser-only authoring *(4–6 weeks)*
- Template Builder UI for static images (text + image + shape + logo)
- Layer dynamic/lock model wired
- Output specs derived from `campaign_deliverables`
- Run Builder: CSV mode + in-app data picker (products + talent)
- Inline render via `sharp` + `@vercel/og`
- Variant library with filters
- Approval workflow (single-stage)
- Channel destination: download as zip, email to producer
- Audit log + notifications

**Done when:** a Designer builds a static template; a Producer points a campaign at it; 100 variants render and download.

### Phase 2 — HTML5 banners + locales *(3–4 weeks)*
- HTML5 layout engine in the builder
- Puppeteer render path (separate service)
- Locale support (`en-US`, `es-US` to start) + `template_layer_strings`
- Multi-stage approvals (designer → AD → producer)
- Brand token version migration banner

**Done when:** the team can produce localised HTML5 banners at scale.

### Phase 3 — Video + AE Bridge *(8–12 weeks)*
- Render worker service (Cloud Run / Fly.io) running ffmpeg + nexrender
- AE Bridge: AE extension publishes `.aep` + manifest to greenroom
- Video output specs (MP4, MOV, fps, bitrate)
- Scene-swap dynamic layers
- Constraint: no third-party AE plugins on dynamic layers — surface this in builder UI

**Done when:** a 30-second video template produces 50 cut-down/locale variants overnight.

### Phase 4 — AI Tools *(4 weeks, parallel-able)*
- Smart crop (Sharp + saliency or Replicate model)
- Background removal (Replicate `rembg`-equivalent)
- Generative fill / variant copy via Anthropic Claude (already have an API key precedent)
- Auto-tagging on upload (Claude vision) — populates `variants.product_ids` etc.

**Done when:** Designers can let AI propose smart crops per output spec instead of hand-tweaking.

### Phase 5 — Figma Bridge + Feed Ingest *(6 weeks)*
- Figma plugin → ingest endpoint
- sFTP-style Feed Ingest via Supabase Storage drop folder + Edge Function watcher
- Scheduled runs

**Done when:** a static drop of a CSV into a folder kicks off a nightly variant run.

### Phase 6 — Channel Push *(4 weeks)*
- Meta Ads Manager push (creative library upload)
- DV360 push (display creative)
- sFTP / EPOS drops
- Variant publish history + rollback

**Done when:** Asset Studio variants land directly in Meta and DV360 without download/upload steps.

### Phase 7 — Performance loop *(ongoing)*
- Pull performance data back from Meta/DV360 → join to `variants` → "which template / talent / locale wins?"
- Surfaces in Goals (existing module) and Admin dashboard.

**Total:** ~6–9 months to full parity at a small-team pace; first business value in 4–6 weeks.

---

## 10. Key Decisions to Make Early (and recommended defaults)

These will compound if you defer them.

| Decision | Options | Recommendation |
|---|---|---|
| Single-brand vs multi-brand | Greenroom is single-brand (Publix) by design | Stay single-brand; `brand_tokens` is versioned, not multi-tenant |
| Render where | Inline (Vercel) vs separate service vs hosted (Bannerflow API, Plainly, etc.) | Inline for static; separate service for video; never use a third-party render-as-a-service for production assets |
| AE vs ffmpeg for video | AE = creative parity, slow / expensive; ffmpeg = fast, limited motion | Both. ffmpeg for high-volume cut-downs; AE for premium motion. Designer chooses per template |
| AI provider | Anthropic + Replicate vs Adobe Firefly Services | Anthropic + Replicate. Firefly is heavier to license and not differentiated for in-house grocery work |
| Brand-token versioning enforcement | Soft warning vs hard block when a template uses a deprecated version | Soft warning + a "Brand alerts" tile on the dashboard. Hard blocks frustrate Designers |
| Vendor access | Should Vendors see Asset Studio? | No, in v1. Vendors deliver source assets; Asset Studio is internal. Revisit if Publix outsources versioning |
| Approval depth | Single-stage vs multi-stage | Multi-stage as a *feature flag per template*. Default single-stage to keep velocity |
| Talent privacy | `shot_talent` includes ethnicity + skin tone for casting purposes — these flow into variant metadata | Keep talent attributes *internal* and never push to channel platforms; redact from any external publish payload |
| Publix-internal tokens | Where does the brand source-of-truth live today? | Worth a 30-min conversation with the design team — Asset Studio's brand-token set should be co-authored, not invented |

---

## 11. Risks and How to Mitigate Them

1. **Designers reject the in-browser builder.** Mitigation: the Figma Bridge in Phase 5 means the builder doesn't have to be best-in-class — Figma stays the design source of truth. Position the browser builder as a quick-edit tool, not a replacement.
2. **Render reliability under volume.** Mitigation: dedicated worker service from Phase 2, with retry queues, dead-letter, and strict per-template render timeouts.
3. **Brand drift.** Mitigation: brand-token versioning with audit trail; the Designer role owns brand and is required to approve token-set promotions.
4. **Scope creep into "marketing automation."** Asset Studio produces assets; it does not buy media, run experiments, or own performance. Channel push is delivery, not optimisation. Hold this line.
5. **Pile-up in `variants` storage.** Mitigation: lifecycle rule — archive Approved variants after 180 days, hard-delete Rejected after 30 days.
6. **Permission accidents** (Vendor sees variants for someone else's campaign). Mitigation: RLS policies mirror `campaign_assets` from day one — write the policy in the same migration as the table.
7. **Talent attribute leakage to ad platforms.** Mitigation: the publish payload builder explicitly strips `talent_ids`, `binding_payload.talent.*`, and `wardrobe_notes` before sending. Test with an integration test fixture per channel.
8. **AE plugin blocker** (Storyteq's most-cited designer pain). Mitigation: surface a linter in the AE Bridge — when a designer publishes a project, scan for unsupported plugins on dynamic layers and warn before upload.
9. **Single-brand-but-needs-to-look-like-Storyteq.** Avoid faux multi-brand tooling. Greenroom's clarity comes from being a Publix tool. If Publix ever spins up a sub-brand, brand-token versioning carries it.

---

## 12. First Sprint — A Concrete Two-Week Slice

If you wanted to start tomorrow, this is the slice that proves the model.

**Goal:** Designer logs in, builds a "Weekly Ad Tile" static template with a dynamic product image + dynamic price + locked Publix logo, then a Producer kicks off a run from a campaign that produces 30 variants (10 products × 3 sizes), and approves them.

**Tasks**

1. Migration `049_designer_role_and_asset_studio_core.sql` — adds Designer enum value + `brand_tokens`, `templates`, `template_layers`, `template_output_specs`, `variant_runs`, `variants`, plus RLS policies and indexes.
2. Storage buckets: `templates`, `variants`, `brand-assets` + RLS.
3. Service layer skeletons (`templates.service.ts`, `runs.service.ts`, `variants.service.ts`).
4. Sidebar + `/asset-studio` shell with the six tabs (only Overview + Templates + Runs + Variants wired in this sprint).
5. Template Builder MVP: layer tree, three layer types (text, image, logo), dynamic/lock toggles, three output specs hardcoded (1080×1080, 1080×1350, 1080×1920).
6. Run Builder MVP: pick template, pick campaign, pick products from `campaign_products`, queue the run.
7. Inline render with `sharp`: bind product image + price text into the layout, write to `variants` bucket.
8. Variant gallery for the run with approve / reject buttons.
9. Seed Publix brand tokens v1 (primary green `#69A925`, dark green `#10442B`, base white, type system, the existing logo file).
10. Test user `designer@test.local`.

**Done when:** the team can demo "shot list → template → 30 variants → approved → downloaded zip" end-to-end on the demo data.

That's the smallest credible Storyteq inside greenroom. Everything else in this plan is amplification.

---

## 13. What I Need From You to Build This

Three things, in order of decreasing importance:

1. **30 minutes with a Publix designer.** Get the actual brand token set (colours, type, logos, spacing). Without this, brand governance is fiction.
2. **Confirm the role name "Designer"** vs an alternative ("Asset Designer" / "Brand Designer" / "Versioning Lead") — naming matters for adoption.
3. **Commit to phasing.** Trying to build all of Phases 1–6 in one go is the V1 failure pattern. Ship Phase 0 → Phase 1 → real demo → then decide what's next based on real usage.

---

## Sources / Reference

- The Storyteq deep-dive at `outputs/storyteq-deep-dive.md` (companion file) — feature mapping leans heavily on it.
- Greenroom code reviewed: `ARCHITECTURE.md`, `GREENROOM_CONTEXT_PROMPT.md`, `GREENROOM_USER_ROLES.md`, `portal-v2/lib/auth/roles.ts`, `portal-v2/components/layout/sidebar.tsx`, `portal-v2/types/domain.ts`, `portal-v2/supabase/migrations/001`, `002`, `040`, `041`, `043`, `066`, `portal-v2/app/(portal)/post-workflow/page.tsx`.
