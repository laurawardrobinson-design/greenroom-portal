# Storyteq — Deep Research Brief

*A product-expertise brief on both function and form. Built for marketing leaders, designers, and engineering partners — and to seed a knowledge base for an agent that needs to understand Storyteq use cases end to end.*

**Compiled:** April 2026
**Audience:** Marketing ops, creative/design, engineering & IT
**Status:** Research synthesis from public sources (Storyteq site + docs, G2/Capterra, Gartner, analyst coverage, partner listings). Items that could not be independently verified are flagged.

---

## 1. TL;DR — What Storyteq Actually Is

Storyteq is an enterprise **Content Marketing Platform (CMP)** with creative automation at its core. It is built to let global marketing organisations turn a small number of designer-made master templates into thousands of localised, channel-ready creative variants — with brand governance, approvals and a DAM baked into the same product.

It is *not* a design tool (it doesn't replace Figma / After Effects / Photoshop). It is a **production and adaptation layer** that sits between creative tools and ad/publishing channels. Think "the factory floor for creative output" rather than "the drawing board."

Key facts:

- **Vendor:** Storyteq, a product of Inspired Thinking Group (ITG). ITG acquired a majority stake in June 2021; Equistone-backed. Storyteq is ITG's technology division.
- **Origins:** Founded 2016 in Amsterdam (as "Storymail"). EU product DNA, EU hosting defaults.
- **Category recognition:** Named a Leader in the **Gartner Magic Quadrant for Content Marketing Platforms** for three consecutive years (most recent confirmed: 2025) and a Leader in the 2025 Gartner Magic Quadrant for Digital Asset Management — the only vendor recognised as a Leader in both CMP and DAM that year.
- **Three core modules** in the current platform: **Content Portal** (DAM + brand hub), **Adaptation Studio** (template builder + dynamic creative engine), **Collaboration Hub** (briefs, reviews, approvals). A cross-cutting **AI** layer and integrations with **Adobe Firefly** sit on top.
- **Sweet spot:** Large, multi-market brands that produce a *lot* of paid social, video, banners, retail signage and localised comms — e.g. Heineken, ŠKODA, Renault, Sky, ASOS, Co-op, Haleon, Voodoo, Essity, Mentos.
- **Weakness:** Setup-heavy, enterprise-only pricing (roughly €30k–€180k+ / year per G2), thin native integrations with project-management tools (Asana, Monday, Wrike) and PIM systems.

---

## 2. Positioning and Category

Storyteq's current public positioning: *"The only AI-powered platform that manages and optimizes your entire content lifecycle"* — an all-in-one Content Marketing Platform that makes campaign rollout effortless, on-brand, on-time, on-budget.

**Category it fights in:** "Content Marketing Platform" (Gartner's naming) — overlapping with:

- Creative Automation Platforms (Celtra, Smartly.io, Bannerflow, Creatopy, Rocketium, Hunch, Plainly, CHILI GraFx)
- Enterprise Digital Asset Management (Bynder, Aprimo, Adobe Experience Manager Assets, Frontify)
- Creative Operations / Marketing Workflow (Frame.io, Ziflow, Air, ReviewStudio — now owned by ITG)
- Enterprise design (Canva for Enterprise, Adobe Express for Enterprise)

**What Storyteq wants you to believe is unique:** it is one of the few that sits across *all of the above* — DAM + creative automation + review/approval + AI assist — in a single platform, vs. needing Bynder + Celtra + Ziflow + AEM stitched together.

**Proof points Storyteq uses publicly** (treat as vendor-sourced; useful as messaging signals):

- *"42% faster content creation for global brands"*
- *"5–10× more creative variations while reducing production time by 50–80%"*
- Heineken: ~40% content production cost reduction, scaled to 160 countries
- Voodoo: 6,000+ ad versions in 3 months, ~550 production days saved
- ASOS: templates used across 850+ partner brands, 200+ models
- ŠKODA: content feeds to 128+ retailer sites
- Co-op: assets to 2,500+ stores

---

## 3. Platform Architecture — The Three Modules

### 3.1 Content Portal (DAM + Brand Hub)

The "find and keep things on brand" layer. Storyteq runs its own first-party DAM — not a reseller of Bynder or AEM. It includes:

- Natural-language / AI-powered search across the asset library
- Mass upload with auto-tagging, smart taxonomy, object-and-text detection
- Custom pages for brand guidelines, tone-of-voice docs, campaign playbooks — positioned as a lightweight brand portal
- Asset usage analytics (what gets downloaded, remixed, published)
- Rights/usage metadata

Practical point for an evaluator: Storyteq has its own DAM *and* integrates with Bynder via the Bynder Marketplace. So customers who already own Bynder/Aprimo/AEM can still use Storyteq as the automation+workflow layer on top, while customers without a DAM don't need to buy one.

### 3.2 Adaptation Studio (Creative Automation Engine)

The core of the product — where versioning happens. It combines:

- A **Template Builder** (browser-based visual editor) for statics/banners
- **Designer authoring paths** via After Effects extension and a Figma plugin ("Figma to Storyteq")
- A **Batch Creator** + **sFTP/CSV feed ingestion** for bulk generation
- **Dynamic rules** that control what any given layer can do across variants
- **Output formats:** MP4, MOV, HTML5, JPG, PNG, PDF
- **Smart Resize / background removal / object swap / auto-crop** AI utilities
- **Adobe Firefly Services** for generative image and copy variants

### 3.3 Collaboration Hub (Briefs, Reviews, Approvals)

Storyteq's creative workflow layer. Strengthened in 2023 when ITG acquired **ReviewStudio** and folded it into the Storyteq stack. Includes:

- Briefing forms (also feed naming conventions downstream)
- Stage-gated review workflows (draft → review → legal/brand → approve → publish)
- Internal + external collaborators (agencies, suppliers, regional marketers)
- Audit trail / version history for compliance
- Role-based permissions tied to templates (see §4.3)

### 3.4 AI Layer (Cross-cutting)

- Auto-tagging of uploads (object + text detection)
- Translation / localisation assistance (reportedly ~29 languages supported; treat specific count as vendor claim)
- Smart resize, background removal, object expansion
- Brand compliance checks (does this asset fit the colour/logo/ratio rules?)
- Adobe Firefly generative models for copy and imagery inside the workflow

---

## 4. The Marketing Lens — How Storyteq Versions Assets

This is where Storyteq earns its keep for a marketing department. The problem it solves: *"We designed one hero ad; now we need 800 versions across 14 markets, 6 channels, 5 formats and 3 audience segments — without the creative team being a bottleneck and without anything going off-brand."*

### 4.1 The End-to-End Versioning Flow

```
  Designer builds master              Marketer configures run              Platform renders
  ───────────────────────             ─────────────────────────            ────────────────
  In AE / Figma / Template  →  Mark   Upload spreadsheet OR use     →     Auto-generate all
  Builder. Define "dynamic"            Batch Creator UI with           variants at approved
  layers (text, image, colour,         market / language / product    specs. Files land in
  scene, ratio). Lock the rest.        / size permutations.           DAM + optional push to
                                                                      Meta / DV360 / partner
                                                                      sites. CSV returned
                                                                      enriched with URLs.
```

Two data entry modes:

1. **Browser Batch Creator** — marketers drop a CSV or fill a spreadsheet-style grid in the UI. Good for ad-hoc campaigns and low volume (hundreds).
2. **sFTP / CSV feed ingestion** — enterprise mode. Storyteq watches a secure folder on a schedule (daily/hourly). Each row = one asset generation request. After the run, the original CSV is returned enriched with output columns (URLs, statuses). This is how the 6,000-variant type numbers get produced — it's batch pipeline work, not point-and-click.

### 4.2 What Can Vary Per Version

| Dimension | Storyteq supports | Notes |
|---|---|---|
| Size / aspect ratio | Yes | Single-click resize across format presets; smart crop uses AI |
| Language / copy | Yes | ~29 languages cited; auto text-fit (scale/alignment) for character-set expansion |
| Imagery & product | Yes | Layer swap, product feed swap, background removal |
| Colour / brand | Yes (within allowed set) | Designers scope which colours are switchable |
| Scene / backplate (video) | Yes | Entire pre-comps can be swappable scenes |
| Legal / disclaimers | Yes (as dynamic text) | No dedicated "legal per market" module — handled via data |
| RTL languages | Claimed | Supports "special characters" and RTL; specific layout-flip behaviour not deeply documented |
| Regional currency / date formats | Via data | Not a first-class feature; handled as an input column |

**Gotcha worth flagging:** Storyteq's own render farm does **not** support third-party After Effects plugins. Any dynamic layer has to be built with native AE features (shape layers, native text, etc.). Third-party plugin effects are fine on *locked* layers only, and only after being pre-rendered. This is the biggest constraint a mograph designer will hit.

### 4.3 Brand Governance — the Lock/Unlock Model

The governance model is the second quiet superpower. Every layer in a template is either **locked** (marketer can't touch) or **dynamic** (marketer can edit within constraints). Common patterns:

- Logo, master typography, brand colour palette, safe areas → locked
- Headline, CTA, product shot, price, legal disclaimer → dynamic, with rules (max chars, allowed fonts, min font size)
- Sometimes a *controlled* choice set — e.g. "pick one of these 5 pre-approved hero images" rather than "upload any image"

This gives a clean split:

- **Designers and brand owners** author and own templates (the governance layer).
- **Regional marketers / channel managers** self-serve inside templates (the production layer).

The pattern mirrors how permissions work in Figma or a CMS: it *enables* a broader audience to publish, precisely because it locks them out of breaking things.

### 4.4 Approvals, Versioning, and Audit Trails

- Workflow stages are configurable (draft / review / legal / brand / approved / published).
- Reviewers can comment on specific assets and request changes; ReviewStudio tooling is now native.
- Audit trails capture who changed what, when — useful for regulated industries (financial services, healthcare, pharma).
- Templates themselves are versioned: you can roll back to a previous template, and generated assets reference a specific template version. True **roundtrip** from an exported Storyteq file back into AE and re-import with merge is **not** well-documented; in practice designers keep mastering in AE/Figma and re-publish the template.

### 4.5 Distribution — Where the Assets Go Next

- Native pushes exist for Meta Ads Manager and Google DV360 / YouTube / Google Ads.
- TikTok and LinkedIn appear in some messaging but depth of integration is unclear; likely via direct export + manual upload or API.
- Assets also land back in the Content Portal (DAM) and can be syndicated to other DAMs via API or to retailer/dealer portals (how ŠKODA serves 128+ dealers and ASOS serves 850+ brands).
- File Name Generator + Briefing Form drive consistent naming conventions so downstream systems can parse them.

### 4.6 Marketing Use Cases Storyteq Is Genuinely Good For

1. **Global campaign localisation.** One master spot / key visual → localised copy, imagery, legal lines, CTAs across 20+ markets in hours, not weeks.
2. **High-volume paid social / programmatic.** Hundreds or thousands of ad variants for A/B testing, audience targeting, DCO-style personalisation.
3. **Retail and dealer enablement.** Central brand team ships templates; individual stores/dealers self-serve localised versions (offers, addresses, OOH).
4. **Always-on product catalog ads.** Feed-driven ad generation for large SKU counts (fashion, gaming, CPG). Feed in → asset out.
5. **Multi-brand portfolios.** One platform serves many sub-brands, each with its own brand rules, inside one ITG/Storyteq instance.
6. **Corporate / regulated content.** Finance, pharma, insurance — legal and brand reviews are the critical bottleneck, which is exactly where Collaboration Hub earns its cost.

### 4.7 Where Marketing Teams Tend to Struggle

- **Setup is heavy.** Templates need real care at the start; first 60–90 days often involves ITG services. Storyteq is not a tool you "pick up in an afternoon."
- **Self-serve marketers with no design literacy** still find the configuration options overwhelming (G2/Capterra reviews). Template quality is therefore downstream of designer-time invested upfront.
- **Low template reuse = low ROI.** The economics work when a template runs 100× or 1,000×. For campaigns that change hero creative every month, it's over-engineered.

---

## 5. The Designer Lens — How Creatives Interact With It

The bigger question for designers is often: *"Am I still a designer here, or am I becoming a template engineer?"* Storyteq's answer is that you keep your native tools (AE, Figma, Photoshop) and add a **thin authoring layer** that converts your work into a reusable, automatable asset.

### 5.1 Where Designers Actually Work

Three entry points:

| Entry point | For what | How it feels |
|---|---|---|
| **After Effects extension** | Video, motion, dynamic video ads | Designers work in AE as normal; a side panel lets them tag layers as dynamic (text source, image, scene) and publish the comp as a Storyteq template. |
| **Figma plugin ("Figma to Storyteq")** | Static ads, display, banners, simple motion | One-way export from Figma into Storyteq. Layers become the bones of the template; final dynamic rules get configured inside Storyteq. |
| **Template Builder (browser)** | Simple static and HTML5 templates | No install needed. Drag in assets, set layers as dynamic or locked, configure rules. Good for producers and template ops people as much as designers. |

**Not confirmed / gaps worth noting:** no native Illustrator or InDesign plugin; Photoshop is import-only; Sketch is not supported; there is no public Adobe Premiere plugin.

### 5.2 After Effects — The Real Video Workflow

Because video is where Storyteq earns its Gartner score, it's worth going deep here.

How a motion designer typically builds a Storyteq template in AE:

1. Build the project cleanly — bins for footage, graphics, audio; one master comp; pre-comps per scene.
2. Use **native** AE layers for anything that needs to be dynamic. Native text layers for dynamic copy; native shape layers for auto-fit background boxes behind text.
3. For scene-swaps, build each alternative scene as its own pre-comp and mark the scene slot as a dynamic layer.
4. Avoid third-party plugins (Plexus, Trapcode, Element 3D) on dynamic layers — Storyteq's render farm will not execute them. Use them only on locked layers, or pre-render.
5. Open the Storyteq AE extension and tag layers: *this text is dynamic, this image slot is dynamic, this pre-comp is dynamic with these options*.
6. Publish to Storyteq as a template.

For designers coming from a one-off commercial/broadcast background, step 4 is the shock. For designers already working in DCO or banner environments, it's the familiar trade-off.

### 5.3 Figma — The Static / Display Workflow

The Figma plugin is a **one-way bridge**, not a live sync. Typical flow:

1. Design the ad system in Figma as you would for any campaign.
2. Run the "Figma to Storyteq" plugin; choose which frames become templates.
3. In Storyteq, finish the template: mark layers as dynamic vs locked, set rules, wire up to data.

Implication: design changes post-handover generally mean re-running the plugin and republishing the template. Teams who want Figma-as-source-of-truth with live update-in-place will be disappointed.

### 5.4 What Designers Control vs. What Marketers Control

| Control | Designer | Marketer |
|---|---|---|
| Template structure (layers, timing, composition) | ✓ | ✗ |
| Which layers are dynamic | ✓ | ✗ |
| Rules on dynamic layers (max chars, font size floors, allowed colours, permitted images) | ✓ | ✗ |
| Edit a dynamic layer's content per variant | Optional | ✓ |
| Add/remove layers, retime, restyle outside the rules | ✓ | ✗ |
| Export / render / batch / push to channels | Optional | ✓ |

The net: designers trade some individual-asset craft for system-level leverage. One well-built template can reliably produce 1,000+ on-brand assets a month without designer involvement. That's the pitch to the creative team: *your time gets reinvested in master creative and system design, not in resizing.*

### 5.5 Pain Points Designers Commonly Report

From G2 / Capterra / TrustRadius reviews and community posts:

- **Learning curve is real.** First template takes meaningful effort; the templating paradigm (dynamic vs locked, data binding, constraints) is unfamiliar to most motion designers unless they've done DCO work.
- **Third-party AE plugin restriction** is the biggest single workflow frustration for mograph designers.
- **Editor performance** with very large asset libraries gets sluggish.
- **Pre-built templates are thin** — this is not a library of starters like Creatopy or Canva. You are building.
- **Roundtripping is weak.** If a brand refresh changes the core type system, you rebuild templates; there's no automatic propagation of "we changed the logo, regenerate all templates."

On the flip side: consistently high marks for customer support, the After Effects integration quality, and how much time a well-built template saves the team downstream.

### 5.6 What Good Designer Enablement Looks Like

For a team adopting Storyteq, the high-leverage investments are:

1. A dedicated **template owner** (someone senior in design who becomes the in-house Storyteq expert).
2. **Template system design** up front: naming, layer conventions, shared pre-comps, colour tokens. This is design-system work, not ad work.
3. **Clear governance contract** with marketing: what's dynamic, what's locked, and who decides when to change that.
4. **Regular template audits** — as brand evolves, templates need curation and retirement.

---

## 6. The Engineering / IT Lens

### 6.1 Integrations at a Glance

**Confirmed / documented:**

- Adobe Creative Cloud — After Effects extension (native), Firefly Services (native integration inside Storyteq's AI layer), Adobe Video Partner Program member
- Figma — via plugin
- Bynder DAM — native integration via Bynder Marketplace
- Getty Images Media Manager — stock imagery pipe
- Meta Ads Manager, Google DV360 / YouTube / Google Ads — ad delivery connectors
- sFTP / CSV feed pipes — enterprise batch ingestion

**Claimed but thin public evidence:**

- TikTok, LinkedIn ad platform integrations (likely export-based rather than deep API)
- Aprimo, AEM Assets, Frontify, Cloudinary (likely via API/custom, not native)
- PIM systems (Akeneo, Salsify, Syndigo) — not explicitly listed
- Project management tools (Asana, Monday, Wrike, Workfront) — not documented; ITG's strategy is to absorb this via ReviewStudio rather than integrate

**Not found:**

- No public GraphQL API; REST + webhooks only
- No published OpenAPI/Swagger spec in the public domain
- No Postman collection or official SDKs in the public domain

### 6.2 API Surface

- REST API, webhooks, documented at the Storyteq API/integrations page.
- API maturity best described as "intermediate enterprise" — enough to build feed-driven workflows, not as developer-ecosystem-polished as, say, Contentful or Segment. Expect to work with Storyteq solutions engineers for custom builds.

### 6.3 Security, Hosting, Compliance

- Hosted on Google Cloud Platform; EU-default region given Dutch origins.
- GDPR and UK GDPR compliant (explicitly referenced in their data policy).
- Parent ITG holds ISO 27001:2022.
- **SOC 2**: not confirmed publicly — procurement teams should request the report directly.
- Role-based access control and SSO are standard enterprise expectations; confirm specifics per contract (SAML, SCIM).

### 6.4 Deployment Patterns

Storyteq is delivered in two shapes:

- **Self-service subscription** — licence + monthly fees (users, workspaces, template count, render volume). Customers operate the platform themselves.
- **Managed service with ITG** — Storyteq software plus ITG creative production team handling strategy, template building, campaign execution. This is the "halo" model Essity and similar use. It's closer to a creative agency retainer than SaaS.

For IT buyers, the distinction matters: the managed model changes the shape of the vendor relationship, the data flows, and who touches the templates.

---

## 7. Competitive Landscape

A compressed competitor map, because Storyteq's differentiation only becomes clear next to alternatives.

| Vendor | Where it wins | Where it loses vs Storyteq |
|---|---|---|
| **Celtra** | Deepest DCO + analytics; mature for global display | No owned DAM; heavier learning curve; no bundled services |
| **Smartly.io** | Paid social + buying integrated; strongest on Meta/TikTok feed ads | Performance-marketing flavour, lighter on brand-governance/DAM |
| **Bannerflow** | UX + customer support; fast time-to-value | Narrower (display-heavy); less video; less governance |
| **Creatopy / The Brief** | Transparent pricing, self-serve, good templates | Not enterprise-grade governance; limited automation at scale |
| **Rocketium** | Lightweight, creative analytics, growing AI features | Smaller feature set; newer at enterprise scale |
| **Hunch** | Purpose-built for feed-driven social retail | Narrow channel coverage, no DAM |
| **CHILI GraFx** | Design-automation depth, print-strong | Weaker collaboration/approvals; less marketer-friendly |
| **Canva for Enterprise** | Mass self-serve, strong templates | Not a batch-automation platform; governance is lighter |
| **Adobe Express + Frame.io** | Native to Creative Cloud; Firefly; creative review | Fragmented across multiple Adobe products; no unified CMP |
| **Bynder / Aprimo / AEM Assets** | Pure DAM leaders | Don't do creative automation at Storyteq's depth |

**Storyteq's strongest lanes:**

- Global, multi-market, multi-brand organisations where **governance + localisation + batch video** all matter.
- Buyers who want **one platform** rather than Bynder + Celtra + Ziflow stitched together.
- Organisations open to a **bundled services relationship** with ITG (this is either a strength or a deal-breaker depending on the buyer).

**Storyteq's weaker lanes:**

- Pure performance-marketing shops on Meta/TikTok feeds — Smartly.io is purpose-built for that.
- Mid-market teams with tight budgets and no need for governance — Creatopy/Canva suit better.
- Teams that want a developer-first, API-first platform — Storyteq is an enterprise app with an API, not an API product.

---

## 8. Commercial Model and Buying Signals

- Pricing is quote-only. G2 data points put typical annual spend at roughly **€30k–€180k+**, with managed-service engagements extending well beyond that.
- Contract components usually include: platform licence, user seats, workspace count, template count, render-volume tiers, managed-services hours, and onboarding / setup.
- No self-serve or free tier.
- Expect a 60–120 day implementation for enterprise deployments, often with ITG services engaged for template authoring and change management.
- Economic argument is strongest when annual creative production volume is very high (tens of thousands of assets/year), or when brand governance failure is expensive (regulated industries, brand-sensitive global brands).

---

## 9. Use-Case Playbook (For an Agent Knowledge Base)

A compact set of *"when someone says X, Storyteq fits if Y"* mental models:

**"We shoot one hero spot and need 400 cut-downs and localisations."**
→ Core fit. After Effects workflow, dynamic scenes, language switching, bulk render.

**"We run a feed-based catalog with 50k SKUs and need fresh creative weekly."**
→ Fit, via CSV/sFTP + Batch Creator. Compare seriously vs Smartly.io and Hunch on social depth.

**"We have 30 local markets and a small central creative team; markets keep going off-brand."**
→ Strong fit. Lock/unlock model + approvals are the main answer.

**"We need a DAM."**
→ Fit if you also need automation. If it's *only* DAM, pure-play Bynder/Aprimo/Frontify are more focused.

**"We want designers to get back to real creative work instead of resizing."**
→ Fit, *conditional on* the team having the maturity to invest in template authoring.

**"We want to plug creative into our existing Workfront / Asana / Monday setup."**
→ Weaker fit. Storyteq prefers the internal Collaboration Hub / ReviewStudio model. Expect custom integration.

**"We want transparent, fast, self-serve onboarding for a 10-person marketing team."**
→ Poor fit. Look at Creatopy, Canva, Rocketium.

**"We're in a regulated vertical (pharma/finance) and brand/legal review is our bottleneck."**
→ Fit. The governance + audit trail story is the core value, not the render count.

**"We want to generate creative from text prompts end-to-end."**
→ Not Storyteq's bet. Firefly is integrated, but Storyteq's philosophy is *adapt and assemble*, not *generate from scratch*. For that lane, look at Adobe Firefly directly, Runway, Flair, or similar.

---

## 10. Risks, Gotchas, and Things to Verify Before Committing

1. **Third-party AE plugin restriction** on dynamic layers — brief designers early; may require re-architecting existing AE projects.
2. **Setup cost and time** — 60–120 days and meaningful services investment. Plan for it in the business case.
3. **Self-serve usability** — marketers without design literacy will need training; templates need to be *opinionated* to guide them.
4. **PIM / product feed** integrations are thin — if you rely on Akeneo/Salsify, scope the custom build.
5. **PM tool integrations** (Asana/Monday/Wrike) are thin — if your team lives in those, expect manual workflow or custom API work.
6. **Vendor concentration via ITG** — you're buying into ITG's ecosystem, not a standalone vendor. Fine if aligned; worth eyes-open on lock-in.
7. **SOC 2** — request the report directly; not publicly confirmed.
8. **Roundtripping limits** — brand refreshes mean rebuilding, not propagating. Budget template-maintenance capacity.
9. **Pricing opacity** — get a multi-year, multi-scenario quote that includes renders, users, workspaces, services. Hidden cost is usually in render volume and services hours.
10. **AI claims vs reality** — the Firefly integration and auto-tagging are real; specific claims like "29 languages" and "42% faster" are vendor-sourced. Validate in your own pilot.

---

## 11. Glossary — Storyteq-Specific Terminology

- **Content Portal** — Storyteq's DAM + brand hub module.
- **Adaptation Studio** — Storyteq's creative automation and template module.
- **Collaboration Hub** — Storyteq's briefs / review / approval module (ReviewStudio folded in).
- **Template Builder** — the browser-based visual editor inside Adaptation Studio.
- **Dynamic rule / dynamic layer** — a layer in a template that marketers can vary at generation time, within designer-defined constraints.
- **Batch Creator** — the UI for generating many variants from a spreadsheet upload.
- **sFTP ingestion** — the automated pipeline mode where CSVs dropped in a secure folder trigger bulk renders.
- **Halo model** — ITG's managed-service delivery model wrapping Storyteq software with ITG services.
- **Figma to Storyteq** — the one-way Figma export plugin.
- **Adobe Video Partner Program** — Storyteq's formal standing in Adobe's ecosystem, enabling the AE extension.

---

## 12. Sources

Storyteq primary:

- [Storyteq — Homepage / Platform](https://www.storyteq.com)
- [Storyteq — Creative Automation Platform / Products](https://storyteq.com/creative-automation-platform/products/)
- [Storyteq — Adaptation Studio](https://storyteq.com/content-marketing-platform/adaptation-studio/)
- [Storyteq — AI Features](https://storyteq.com/content-marketing-platform/ai/)
- [Storyteq — Reviews and Approvals](https://storyteq.com/content-marketing-platform/reviews-and-approvals/)
- [Storyteq — API & Integrations](https://storyteq.com/api-and-integrations/)
- [Storyteq — Data Protection Policy](https://docs.storyteq.com/home/data-policy)
- [Storyteq — sFTP setup guide](https://docs.storyteq.com/home/sftp-setup-guide)
- [Storyteq — Video Ads: Delivering AE project files](https://docs.storyteq.com/home/video-ads-delivering-ae-project-files)
- [Storyteq — Figma to Storyteq plugin docs](https://docs.storyteq.com/home/figma-to-storyteq-plugin)
- [Storyteq — Blog: Everything you need to know](https://storyteq.com/blog/everything-you-need-to-know-about-storyteq/)
- [Storyteq — Blog: Template Builder](https://storyteq.com/blog/how-our-template-builder-helps-brands-create-ads-at-scale/)
- [Storyteq — Blog: Localising and scaling global campaigns](https://storyteq.com/blog/how-to-localise-and-scale-your-global-marketing-campaigns-with-storyteq/)
- [Storyteq — Blog: Automated creative versioning](https://storyteq.com/blog/how-does-automated-creative-versioning-work-for-different-audiences/)
- [Storyteq — Blog: Approval processes across teams](https://storyteq.com/blog/how-do-marketing-workflows-handle-approval-processes-across-teams/)
- [Storyteq — Blog: Brand guidelines and compliance](https://storyteq.com/blog/how-does-creative-automation-handle-brand-guidelines-and-compliance/)
- [Storyteq — Blog: Storyteq and DAM](https://storyteq.com/blog/storyteq-the-future-of-digital-asset-management/)
- [Storyteq — Blog: Named a Leader in 2025 Gartner MQ for CMP (third consecutive year)](https://storyteq.com/blog/storyteq-named-a-leader-in-gartner-magic-quadrant-for-content-marketing-platforms-for-third-consecutive-year/)
- [Storyteq — Blog: Named a Leader in 2025 Gartner MQ for DAM](https://storyteq.com/blog/storyteq-named-a-leader-in-the-2025-gartner-magic-quadrant-for-digital-asset-management/)
- [Storyteq — Blog: ReviewStudio acquisition](https://storyteq.com/blog/inspired-thinking-group-itg-acquires-reviewstudio-to-enhance-storyteqs-creative-workflow-tool/)

Case studies:

- [Heineken](https://storyteq.com/case-studies/heineken/)
- [ŠKODA](https://storyteq.com/case-studies/skoda/)
- [Voodoo](https://storyteq.com/case-studies/voodoo)
- [Essity (ITG)](https://inspiredthinking.group/case-study/essity/)

Third-party and analyst:

- [G2 — Storyteq reviews](https://www.g2.com/products/storyteq/reviews)
- [G2 — Storyteq pricing](https://www.g2.com/products/storyteq/pricing)
- [G2 — Celtra vs Storyteq](https://www.g2.com/compare/celtra-vs-storyteq)
- [Capterra — Storyteq reviews](https://www.capterra.com/p/187369/Dynamic-Video-Software/reviews/)
- [Gartner Peer Insights — Storyteq](https://www.gartner.com/reviews/product/storyteq)
- [Gartner — Creative Management Platforms market](https://www.gartner.com/reviews/market/creative-management-platform)
- [LBBOnline — Storyteq named Leader, 2026 Gartner MQ](https://lbbonline.com/news/Storyteq-Named-Leader-in-2026-Gartner-Magic-Quadrant-for-Content-Marketing-Platforms)
- [LBBOnline — ITG brings Firefly into Storyteq](https://lbbonline.com/news/ITG-Brings-Adobe-Firefly-Services-Into-Storyteq-as-It-Doubles-Down-on-AI-Ready-Content-Operations)
- [PRNewswire — Storyteq named Gartner Leader in DAM](https://www.prnewswire.com/news-releases/itgs-storyteq-named-a-gartner-leader-in-dam-302612079.html)
- [Adobe Video Partner Program — Storyteq](https://www.adobevideopartner.com/partners/storyteq/)
- [Bynder Marketplace — Storyteq](https://marketplace.bynder.com/en-US/apps/411729/storyteq)
- [Figma Community — Figma to Storyteq plugin](https://www.figma.com/community/plugin/1471069715027452972/figma-to-storyteq)
- [apitracker.io — Storyteq API](https://apitracker.io/a/storyteq)
- [Equistone — ITG / Storyteq investment](https://www.equistonepe.com/investmentdetail/inspired-thinking-group/159?list=1)
- [Mergr — ITG acquires Storyteq (June 2021)](https://mergr.com/transaction/inspired-thinking-group-acquires-storyteq-b-v)
- [Crunchbase — ITG acquires Storymail / Storyteq](https://www.crunchbase.com/acquisition/inspired-thinking-group-acquires-storymail--003364d3)
- [Tracxn — Storyteq company profile](https://tracxn.com/d/companies/storyteq/__v09b5QQmmFRdS6BNAY8jspI4BE3et_r3QgYRduLr3Vw)
- [Abyssale — Enterprise creative automation comparison 2026](https://www.abyssale.com/blog/enterprise-creative-automation-comparison-2026)
- [The Brief — 9 best creative automation tools 2026](https://www.thebrief.ai/blog/creative-automation-tools/)
- [Plainly — Celtra alternatives](https://www.plainlyvideos.com/blog/celtra-alternatives)
- [Bannerflow — Celtra vs Bannerflow](https://www.bannerflow.com/celtra-vs-bannerflow)
- [Rocketium — Celtra alternatives](https://rocketium.ai/academy/all/celtra-alternatives)
