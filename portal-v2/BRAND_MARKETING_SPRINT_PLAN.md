# Brand Marketing in Portal V2 — Strategic Product Brief

Last updated: 2026-04-22
Owner: Portal V2
Status: In flight — Sprint 1 kicked off 2026-04-22

---

## 0a. Post-kickoff corrections (2026-04-22)

Two pivots from the draft, confirmed with Laura at kickoff. Everything
downstream of this section has been updated to match; older narrative
prose in §6 and §7 may still use the draft's brand-tier framing — read
through this lens:

1. **Not sub-brands — Lines of Business.** The taxonomy under the single
   Publix parent brand is: **Bakery, Deli, Produce, Meat & Seafood,
   Grocery, Health & Wellness, Pharmacy.** The field on campaigns is
   `line_of_business`, not `sub_brand`. This is the same taxonomy as
   the RBU departments (which remain external to Portal), so
   `product_requests.line_of_business` shares the enum.

2. **Role label: Brand Marketing Manager (BMM).** Enum value is the
   full label; "BMM" is the short form used in product copy. Not
   "Brand Marketing," not "Brand Manager," not "Marketing Manager."

---

## 0. How to read this document

This is a **strategic product brief**, not a tactical spec. It answers the question "what should Portal V2 be for a Brand Marketer at a Fortune 100 grocery retailer?" before it answers "what do we ship first?"

Read §1–§6 first (the strategic frame). If you already know that, skip to §7 (the North Star), §8 (objects), §11 (Sprint 1 scope), or §13 (stories).

RBU (Retail Business Unit — the merchants like Bakery, Deli, Produce) is treated as **external context only** throughout. Brand Marketing's relationship to the RBU happens outside Portal. No RBU user role, no RBU login, no RBU-facing UI. When Producers need product for a shoot, they submit a **Product Request** in Portal that routes to Brand Marketing as a role. Brand Marketing then takes the request to the RBU offline (meeting, email, phone) and updates the request's state based on the RBU's response.

---

## 1. The strategic thesis (elevator)

Portal V2 already holds the production reality of every campaign at the company — the shoots, shot lists, crew, products, and finished assets. **We don't have to build a Brand Marketing platform; we have to surface Portal V2 as the single pane of glass for a Brand Marketer's creative work in flight.**

The Brand Marketer's #1 expressed wish, across every piece of research, is some version of: *"a single view of every piece of creative happening under my brand this week."* Portal can answer that natively because the data is already here — we just have to (a) add brand ownership to our core objects, (b) add a personalized home page, and (c) close three small gaps: **structured briefs**, **a BM approval gate**, and **product requests** (a Producer-initiated, BM-routed process that was previously happening in email/Teams).

That is the shape of this initiative. Four layers. Sprint 1 ships Layers 1 and 2.

---

## 2. What changed from the previous plan

The earlier draft scoped a two-sided workflow between Brand Marketing and RBU, with an `/rbu-inbox` page and an RBU user role. Laura corrected: RBU is context for understanding the BM role, not a persona we build for. This document:

- Removes the RBU user role and all RBU-facing UI.
- Keeps **Product Requests** as a real routed process inside Portal — Producer creates, BM resolves — but with no RBU side. BM handles the RBU conversation offline and updates Portal with the outcome.
- Adds a strategic framing layer (§1–§9) that the previous plan skipped.
- Centers the sprint on the **Brand Marketer's Home Page** (North Star) plus the objects and workflows that populate it.
- Makes Product Requests **visible to Producers company-wide**, not BM-private, so Producers can align with each other on upcoming product needs.

---

## 3. Research summary (executive)

Full citations in §16. Three waves of research converged on the same story.

### 3a. What a Brand Marketer actually does all week

- **Roughly 40% meetings, 25% review/approval, 20% strategy, 15% execution-adjacent.** ([Gartner](https://www.gartner.com/en/newsroom/press-releases/2024-05-14-gartner-survey-reveals-eighty-four-percent-of-marketers-report-experiencing-high-collaboration-drag-from-cross-functional-work), [Cella](https://cellainc.com/insights/cella-intelligence-report/), [Ziflow](https://www.ziflow.com/blog/the-2023-state-of-creative-workflow-report-key-findings-bonus-insights))
- **48% lose 5+ hours every month just chasing feedback.** Another 60% frequently have to explain to stakeholders how to leave comments on a proof. ([Ziflow](https://www.ziflow.com/blog/the-2023-state-of-creative-workflow-report-key-findings-bonus-insights))
- **84% of marketing leaders report high "collaboration drag"** working across functions. ([Gartner](https://www.gartner.com/en/newsroom/press-releases/2024-05-14-gartner-survey-reveals-eighty-four-percent-of-marketers-report-experiencing-high-collaboration-drag-from-cross-functional-work))
- **77% say content output is rising; 78% say demand has outrun capacity.** ([HubSpot State of Marketing 2025](https://www.hubspot.com/state-of-marketing))
- Their approval queue is ~40–80 items a week. **About 60% are rubber-stamps, 25% need light judgment, 15% require real thinking.** Software that separates those three is very valuable.
- **Create : consume ratio is ~1:10.** A BM consumes ten artifacts for every one they produce. That's why "single view" tooling is the universal wish.

### 3b. How Brand Marketers actually think

- **Keller's CBBE pyramid** (Salience → Performance/Imagery → Judgments/Feelings → Resonance) is the diagnostic grid behind every brand health deck. ([Mindtools](https://www.mindtools.com/ajnlcxe/kellers-brand-equity-model/))
- **Ehrenberg-Bass / Byron Sharp** reframed the job: growth comes from **Mental Availability** (easy to think of) and **Physical Availability** (easy to find and buy), measured through **Category Entry Points** and **Distinctive Brand Assets**. ([Ehrenberg-Bass](https://marketingscience.info/news-and-insights/how-do-you-measure-how-brands-grow), [Romaniuk](http://www.jenniromaniuk.com))
- **Binet & Field's 60/40** thesis: 60% of budget on brand-building, 40% on activation. The 60% fight with finance is the perennial BM struggle. ([IPA](https://ipa.co.uk/knowledge/effectiveness-research-analysis/les-binet-peter-field))
- **The positioning statement** (`For [target] who [need], [brand] is the [frame] that [benefit], because [RTB]`) is the upstream truth every creative brief must ladder up to.
- **Brand architecture matters structurally.** Publix runs a hybrid monolithic + tiered private label: **Publix** (value staples), **Publix Premium** (indulgence), **GreenWise** (organic/wellness), **Aprons** (content/experience). Every campaign belongs to one of these or to the master brand. ([Latterly](https://www.latterly.org/publix-marketing-strategy/))

### 3c. How Brand Marketers interface with production (creative ops, 2024-2026)

- Adobe's **"content supply chain"** framing dominates: **Plan → Brief → Create → Review → Approve → Activate → Measure → Archive.** Seams between stages are where Fortune 100 teams hemorrhage time — creatives reportedly spend only ~19% of time on actual creation. ([Adobe](https://business.adobe.com/blog/how-to/create-a-content-supply-chain-that-will-stand-the-test-of-time))
- The industry has converged on a **two-step intake**: a lightweight **Request** gates prioritization; a richer **Brief** unlocks production. Best-in-class briefs are 1–3 pages, stored as structured records in the work management system, not PDFs. ([Adobe Workfront](https://www.workfront.com/project-management/life-cycle/initiation/creative-brief), [Asana](https://asana.com/guide/examples/design/creative-briefs-requests))
- Best-in-class review is **parallel, annotated, aged, and checklist-gated** (brand / legal / accessibility / regulatory). Sequential reviews are the #1 source of revision spiral. ([Ziflow](https://www.ziflow.com/blog/ziflows-2025-year-in-review))
- **The dream BM dashboard has five rails**: (1) In-flight work, (2) Awaiting my input, (3) In-market calendar 30/60/90, (4) Brand health + compliance, (5) Budget burn + velocity. ([Aprimo](https://www.aprimo.com/blog/2025-gartner-magic-quadrant-marketing-work-management), [Adobe GenStudio](https://business.adobe.com/summit/2025/sessions/content-supply-chain-gs1-6.html))
- **2026 is "agentic"**. Aprimo Agentic DAM (Mar 2026) and Adobe Brand Intelligence (Apr 2026) codify briefs, brand kits, and guidelines as machine-readable rules so AI generates + self-checks before a human sees it. The SPOC role shifts from "approve every variant" to "approve the rules." ([Aprimo](https://www.businesswire.com/news/home/20260316927462/en/), [Adobe](https://news.adobe.com/news/2026/04/adobe-introduces-brand-intelligence))

### 3d. The grocery-retailer reality

- At Kroger, Publix, Albertsons, the top commercial role is merchant-led; marketing reports into a merchandising-heavy organization. Brand Marketing's internal "client" is the merchant/RBU org, even though they don't log into Portal. ([Kroger IR](https://ir.kroger.com/news/news-details/2025/Kroger-Announces-New-Leaders-in-Key-Roles/default.aspx))
- The weekly circular is the metronome; seasonal tentpoles anchor brand work (holidays, summer grilling, back-to-school, Super Bowl).
- Private label is ~30% of Publix sales — 50% above industry average — and every new SKU needs pack shots, food photography, and recipe content. That's an enormous volume of creative work flowing past the BM.

---

## 4. What the Brand Marketer needs from software (distilled)

Reducing the research to a single list of jobs-to-be-done. Each is a lens we'll use to evaluate every feature decision.

1. **"Show me everything happening under my brand this week without a status meeting."**
2. **"Help me approve without reading every proof end-to-end."** Rubber-stamp the 80%, flag the 20% that matter.
3. **"Make the brief a living thing, not a PDF that nobody opens after Monday."**
4. **"Show me the calendar of what's going in-market in the next 30/60/90 days."**
5. **"Let me earmark products I'll need from the RBU for upcoming shoots"** — BM-private; actual RBU conversation happens offline.
6. **"Tell me which of my campaigns are drifting from brand strategy or positioning."**
7. **"Give me the decision trail so when leadership asks why a campaign went the way it did, I have an answer."**
8. **"Let me onboard a new ABM in a week, not a month, by showing them the active portfolio."**

Notice what's *not* here: "Be my brand health tracker" (vendor: Kantar/YouGov), "Be my brand book" (vendor: Frontify), "Be my media planner." Portal does not need to be all of MarTech. It needs to be the **production-reality window** into the BM's portfolio.

---

## 5. What Portal V2 should and shouldn't be for Brand Marketing

| Portal V2 IS for Brand Marketing | Portal V2 IS NOT |
|---|---|
| The production reality: campaigns, shoots, shot lists, assets | A brand health tracker (Kantar, YouGov, Brandwatch) |
| A single pane of glass filtered by brand ownership | A brand portal / style guide (Frontify, Brandfolder) |
| Structured briefs tied to each campaign | An enterprise annual planner (Annum, CrossCap) |
| A BM approval gate on creative | A full MRM (Aprimo, Workfront) |
| A shared Product Request queue (Producer → BM, RBU handled offline) | An RBU-facing system |
| A personalized home page for each BM | A media planner or retail media console |

This scoping discipline is deliberate. Portal's strength is that creative production *actually lives here*. We lean on that and don't try to replicate tools the enterprise buys from elsewhere.

---

## 6. The Brand Marketer's day in Portal V2

Three representative journeys. These are the scenarios every feature in the sprint must support.

### 6a. The morning triage (every day, 10 minutes)

Nicole, Sr Brand Marketing Manager for **Aprons**, opens Portal at 8:45am over coffee.

1. Lands on `/brand-marketing` (her home page, set by her role).
2. Top-left tile: **AWAITING MY APPROVAL** — 7 items. She clicks the first: a shot list for next week's summer-grilling shoot. Reads it, approves with one comment ("swap the store-brand lemonade for Publix Premium — we're building that tier this quarter"). Next item. Next.
3. Four items auto-approve because she sets a rule: "shot lists under $5K that match positioning, auto-approve with log." Three items need her thought. All seven cleared in 8 minutes.
4. Second tile: **IN-FLIGHT UNDER APRONS** — 14 campaigns. Yellow badge on one: "no brief captured." She opens it, sees it was kicked off last week without going through intake. Adds a brief in 4 minutes.
5. Third tile: **NEXT 30 DAYS IN-MARKET** — 6 campaigns launching. She scans for anything she didn't know about. Nothing. Closes laptop.

Total: 15 minutes. She walks into her 9am with her portfolio in her head.

### 6b. Product Requests — the routed process

A Producer — Marcus, working on the Summer Grilling shoot — realizes he needs three cases of sausage and a Publix Premium marinated flank steak for next Thursday's shoot.

1. On his campaign's Products tab, he clicks **+ Request product**. A Product Request drawer opens, attached to the shoot day. He fills in what he knows (product, quantity: 3 cases, hero), saves as a **draft**. Status chip: **IN PROGRESS**.
2. Two days later his Art Director says they'll also need a second steak SKU for a swap angle. Marcus opens his draft, adds the second product, confirms quantities + shoot day, clicks **Submit**. Status flips to **FORMALIZED**. The request is now in Brand Marketing's queue.
3. **Nicole** (BM) sees it in her Home Page **FORMAL REQUESTS** tile. She opens it, reads it, knows the Meat/Seafood RBU lead well. She takes it to the Tuesday RBU sync offline.
4. At the RBU meeting the Meat/Seafood lead confirms sausage, offers a premium boneless ribeye instead of the flank steak. Back at her desk, Nicole marks the sausage **Confirmed**, the steak **Substituted** (noting the alternate). Marcus sees the update next time he opens his campaign.
5. On shoot day, Studio marks both **Delivered** when the product arrives on set.

Meanwhile, another Producer — Alex, working on a Bakery shoot for the same week — browses `/product-requests` and sees Marcus's in-progress sausage request. Alex also needs sausage for an Aprons recipe photo the same day. She DMs Marcus: "Can we align pickups?" They coordinate offline before either request reaches Nicole.

The RBU never logs into Portal. Portal holds the ledger, the conversation moves offline at Nicole's step, and the outcome comes back into Portal.

### 6c. The brand drift catch (ad-hoc)

Nicole opens a campaign she's been loosely aware of — a Publix Premium holiday gift-box shoot. She reads the brief (captured at intake). Opens the shot list. Sees it's framed entirely as "value and abundance" — that's Publix master brand language, not Publix Premium (which should read "curated indulgence").

1. She leaves a comment on the brief: "positioning needs to re-anchor to Publix Premium language — see examples."
2. Flags the campaign as "brand review needed" which notifies the Producer.
3. The Producer reads it, re-opens the shot list, adjusts the direction with the Art Director.
4. Nicole checks back in 3 days, re-reviews, approves.

This is exactly the kind of loop that today happens in email/Teams with no record. Portal captures it.

---

## 7. The North Star — the Brand Marketer's Home Page

`/brand-marketing` — the single page that anchors everything. Laid out as tiles on one screen using our standard tile-header pattern (ALL CAPS, icon, border-b, `padding="none"`).

```
┌─────────────────────────────────────────────────────────────────┐
│  BRAND MARKETING — NICOLE LEE · APRONS, PUBLIX PREMIUM        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ AWAITING MY APPROVAL ──┐  ┌─ IN-FLIGHT UNDER MY BRANDS ─┐  │
│  │  7 items · 2 aging >2d  │  │  14 campaigns                │  │
│  │  ──────────────────────  │  │  ──────────────────────────  │  │
│  │  Shot list · Summer      │  │  Aprons · Summer Grilling    │  │
│  │    Grilling · due today  │  │    (shoot Mon)               │  │
│  │  Brief · Back-to-School  │  │  Publix Premium · Holiday    │  │
│  │    Aprons · 1 day        │  │    Gift Boxes (in retouch)   │  │
│  │  Variant set · Holiday   │  │  Aprons · Fall Comforts      │  │
│  │    Gift · 2 days ⚠        │  │    (pre-prod)                │  │
│  │  4 more...               │  │  11 more...                   │  │
│  └──────────────────────────┘  └───────────────────────────────┘  │
│                                                                 │
│  ┌─ NEXT 30 DAYS IN-MARKET ─────────────────────────────────┐  │
│  │  Apr 28  Summer Grilling Phase 1        Circular + Social │  │
│  │  May 05  Mother's Day Premium Picks     Circular + CTV    │  │
│  │  May 12  Aprons Weekly: Quick Suppers   Digital + App     │  │
│  │  May 19  GreenWise Earth Week extension Circular          │  │
│  │  5 more ...                                               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ FORMAL PRODUCT REQUESTS ──┐  ┌─ IN PROGRESS ────────────┐  │
│  │  9 awaiting my action       │  │  14 drafts (heads-up)    │  │
│  │  ──────────────────────────  │  │  ────────────────────────  │  │
│  │  Sausage · Summer Grilling  │  │  Watermelon · Aprons 7/8  │  │
│  │    · Marcus · 2d            │  │  Butter · Holiday Gift    │  │
│  │  Premium steak · Grilling   │  │  Sourdough · Weekly       │  │
│  │    · Marcus · 2d            │  │  Flank steak · Grilling   │  │
│  │  6 more...                  │  │  11 more...               │  │
│  └──────────────────────────────┘  └────────────────────────────┘  │
│                                                                 │
│  ┌─ BRIEF HEALTH ─────────────┐                                 │
│  │  11 of 14 campaigns have a │                                 │
│  │    brief                   │                                 │
│  │  3 missing (flagged yellow)│                                 │
│  │  1 brief edited in last 7d │                                 │
│  └────────────────────────────┘                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Rail priority** (what's on screen by default):

1. **AWAITING MY APPROVAL** — the critical approval queue. Aged. Sorted by "needs me by date."
2. **IN-FLIGHT UNDER MY BRANDS** — portfolio view; yellow badges on any campaign missing a brief, missing a shoot date, or not touched in 14 days.
3. **NEXT 30 DAYS IN-MARKET** — the forward calendar (simple list for MVP; calendar view later).
4. **FORMAL PRODUCT REQUESTS** — the action queue: requests Producers have submitted with confirmed quantities + details, routed to Brand Marketing as a role (every BM + Admin sees the same list, no individual assignment).
5. **IN PROGRESS** — Producer drafts not yet submitted. Read-only heads-up for BM; also visible to all Producers so they can align with peers on overlapping product needs.
6. **BRIEF HEALTH** — simple completeness check across the portfolio.

What's *deferred* out of the default view:

- Budget burn / velocity (Layer 3)
- Brand health score (Layer 4; belongs in Kantar/YouGov, we link out)
- Rights-expiring-soon (Layer 4; belongs in DAM)

---

## 8. Core objects — the Brand Marketer's mental model in Portal

Everything added in this initiative plugs into five objects. Only two are new; three are enrichments of existing objects.

| Object | Status | What changes |
|---|---|---|
| **Campaign** | existing | Gains `brand_owner_id` (the BMM), `line_of_business` (Bakery / Deli / Produce / Meat & Seafood / Grocery / Health & Wellness / Pharmacy) |
| **Campaign Brief** | NEW | Structured record attached to a campaign (one-to-one). Stores objective, audience, insight, proposition, mandatories, success measure. |
| **Brand Approval** | NEW | An approval gate on a campaign artifact (brief, shot list, render, final asset). One row per approval. |
| **Product Request** | NEW | Producer-initiated request for product needed for a specific shoot, routed to Brand Marketing Managers as a role. Two-phase: **In Progress** (draft) and **Formalized** (submitted). Visible to all Producers + BMM + Admin. |
| **User Role** | existing | Gains `Brand Marketing Manager` |

Mental model:

> **A Brand Marketing Manager owns a portfolio of campaigns spanning one or more Lines of Business. Each campaign has a brief, a set of approvals, and a stream of Product Requests flowing in from Producers. The Home Page shows this portfolio, filtered by ownership, aged, prioritized. Product Requests are the one stream visible company-wide — so Producers can align with each other on overlapping needs before a BMM gets involved.**

That's it. Everything below derives from this.

---

## 9. Strategic Council — key product design decisions

A design council with a handful of deliberate voices in the room. Each decision below was pressure-tested from these vantage points before being made.

**Voices convened:**

- **The Brand Marketer** (target user; composite of Fortune 100 BM profiles)
- **The Producer** (Laura; internal user who creates a lot of the data BM will consume)
- **The CMO / strategist** (the BM's boss; cares about brand health and portfolio coherence)
- **The in-house agency producer / Creative Ops Manager** (cares about intake quality, brief clarity, revision rate)
- **The simplifier / product manager** (keeps scope honest, defends the user from well-meaning feature sprawl)
- **The future-you / cold-reader** (next engineer to pick this up; needs the doc to be self-contained)

### Decision 1 — Should Portal hold the brief, or link out to a Google Doc?

- **Agency producer:** "Google Docs briefs drift. Comments scatter. Revisions vanish. The Ziflow / Cella / Workfront industry moved to structured briefs for a reason."
- **Brand Marketer:** "I don't want to write a brief in yet another tool."
- **Simplifier:** "A structured brief doesn't have to be a novel. A single-page form — objective, audience, insight, proposition, mandatories, success measure — is achievable."

**Decision:** **Portal holds the brief as a structured record.** One page. Tied one-to-one to a campaign. Export to PDF for distribution. Revisions versioned.

### Decision 2 — What does "approval" mean in Portal?

- **Agency producer:** "Parallel approval is the 2026 norm — every reviewer sees it at the same time, not sequentially. Aging matters more than routing."
- **Brand Marketer:** "I want to approve, approve-with-changes, or reject with a reason. That's it."
- **CMO:** "The decision trail matters. If I ask six months later why we did it this way, it needs to be in the record."
- **Simplifier:** "One table — `brand_approvals` — with subject_type / subject_id / state / actor / reason / timestamp. Works for brief, shot list, variant set, final asset. Don't build a workflow engine for v1."

**Decision:** A single `brand_approvals` table keyed by (subject_type, subject_id), three states (`approved` / `changes_requested` / `rejected`), comment required on anything that isn't `approved`. Reviewers assigned per campaign. No SLA engine, no routing rules in v1.

### Decision 3 — What's the right shape for Product Requests?

- **Producer (Laura):** "Product Requests is a process, not a private BM ledger. Producers submit requests tied to shoots; they route through Brand Marketing. For Sprint 1 they route to Brand Marketing as a **role** — no individual assignment, every BM and Admin sees the same queue."
- **Brand Marketer:** "I want two queues. One for formalized requests I need to action (producer has confirmed quantities + shoot details), and one heads-up view of in-progress drafts so I can see what's coming."
- **Producer again:** "Producers should see both queues too. If another producer is building a draft for a product my shoot also needs, I want to see that and coordinate with them before either of us submits."
- **Simplifier:** "One table — `product_requests` — with a two-phase state (`in_progress` → `formalized`), then BM-driven downstream states. Read access is open to Producer + BM + Admin + Studio. Write access is role-gated (producer owns their drafts, BM updates state after RBU conversation, Studio marks delivered)."
- **Studio:** "On shoot day we mark 'delivered' when product arrives on set. Same pattern as meals."

**Decision:** A shared `product_requests` table. Two-phase Producer flow (**In Progress** draft → **Formalized** submission). BM-driven downstream states (`confirmed` / `substituted` / `declined` / `delivered` / `cancelled`). Routed to Brand Marketing as a role — every BM + Admin sees the same queues, no individual assignment. **Visible to all Producers** (not just the creator), all BM, Admin, and Studio — so Producers can align with peers. The BM Home Page shows summary tiles; a shared `/product-requests` page shows the full list with both queues as tabs. A producer's own drafts are editable; once formalized, BM owns state transitions. Export-to-PDF supported from day one so the weekly RBU meeting has a handout.

### Decision 4 — Should line-of-business be a new entity or an enum?

- **CMO:** "At a big retailer the LOB list is relatively stable — Bakery, Deli, Produce, and a handful of others — but each LOB has a bunch of attributes one day: positioning statement, imagery guidelines, merch color."
- **Simplifier:** "An enum with seven values — `Bakery | Deli | Produce | Meat & Seafood | Grocery | Health & Wellness | Pharmacy` — covers the real world for years. When LOB attributes matter, we migrate to a table."
- **Brand Marketing Manager:** "Just let me filter by it."

**Decision:** Enum on `campaigns.line_of_business` (text column with CHECK constraint). Grow to a table if/when LOB attributes start mattering — Layer 4 territory.

### Decision 5 — Home page: one page for all BMs, or per-sub-brand pages?

- **Brand Marketer:** "One page. Filter chips at the top to narrow by sub-brand."
- **CMO:** "Later I want a CMO view across all BMs."
- **Simplifier:** "Start with 'my' view. Cross-portfolio view is an additive /brand-marketing/overview page in Layer 3."

**Decision:** One page, scoped to the current BM's owned campaigns. Filter chips: sub-brand. CMO overview is follow-up.

### Decision 6 — Where does Brand Marketing sit in the nav?

- **Producer:** "Not under Greenroom. Greenroom is production ops. Brand Marketing is its own lens on the whole system."
- **Engineer:** "Top-level nav, visible only to Brand Marketing + Admin."

**Decision:** Top-level sidebar item `Brand Marketing → /brand-marketing`, role-gated to `Brand Marketing`, `Admin`. Do not alter Greenroom/studio for BM.

### Decision 7 — Do we build brand guidelines / distinctive assets storage?

- **CMO:** "Eventually yes — we want distinctive-asset tagging in the DAM (Romaniuk framework)."
- **Brand Marketer:** "That belongs in Frontify, not here."
- **Simplifier:** "Deferred to Layer 4. Portal's asset-studio already has enough metadata hooks to bolt this on later."

**Decision:** Out of scope for Sprint 1. Documented in backlog.

### Decision 8 — Briefing template: free-form, or structured?

- **Agency producer:** "Structured. With the positioning statement auto-pulled from the sub-brand when we have it."
- **Brand Marketer:** "Structured but optional. I want to write a 3-line brief on a Friday for a quick-turn social if I want to."
- **Simplifier:** "Structured fields, all individually optional, with a 'quality score' visible (how many are filled)."

**Decision:** Structured with a completeness indicator. No hard requirement. Completeness shows up as "brief health" in the dashboard (Decision 1 + this one together).

---

## 10. Layered roadmap — what ships when

Four layers. Sprint 1 delivers Layers 1 and 2. Layers 3–4 are future sprints.

### Layer 1 — Brand Marketing exists in Portal (MUST — Sprint 1)

- Brand Marketing user role
- `campaigns.brand_owner_id` and `campaigns.line_of_business`
- Sidebar entry → `/brand-marketing`
- Home Page with three rails: AWAITING MY APPROVAL (empty MVP — shows "none yet"), IN-FLIGHT UNDER MY BRANDS, NEXT 30 DAYS IN-MARKET
- BMM's filter chips by LOB

### Layer 2 — Brief + Approval + Product Requests (MUST — Sprint 1)

- `campaign_briefs` structured record (one per campaign)
- `brand_approvals` table (any subject_type/subject_id)
- UI to capture a brief from a campaign page
- UI to request BM approval on a brief or a shot list; BM approves / requests changes / rejects from the Home Page queue
- Brief completeness indicator on Home Page
- `product_requests` table with two-phase state (In Progress → Formalized) + BM downstream states
- Producer-side: Request product drawer on campaign Products tab; editable drafts; submit → formalized
- BM-side: two Home Page tiles (Formal Requests, In Progress); shared `/product-requests` page with both queues
- Company-wide visibility (Producer + BM + Admin + Studio all read; write gated by role + ownership)
- RBU rollup export-to-PDF so BM can print a handout per RBU department for the weekly sync

### Layer 3 — Deeper visibility (SHOULD — Sprint 2)

- Budget burn + velocity tile on Home Page
- 30/60/90 calendar view (full calendar, not just list)
- Cross-BM CMO overview page
- Product Request notifications (in-app + email on state change)
- Greenroom `/studio` shoot-day tile showing expected product deliveries

### Layer 4 — Governance and intelligence (COULD — later)

- Distinctive Brand Assets tagging hooked into existing DAM metadata
- Rights-expiring-soon widget (needs DAM metadata expansion)
- Brand drift flagging (AI-assisted check on shot list / brief alignment to positioning)
- Brand health widget (embed from Kantar/YouGov, not native build)
- Parent-child calendar / annual rollup
- Positioning statement library per sub-brand
- Approval rules engine (auto-approve conditions)

Explicit non-goals (never in scope for this initiative until re-decided):

- Brand portal / style guide replacement (use Frontify)
- Full MRM / work management platform replacement (use Aprimo/Workfront if needed)
- Retail Media Network integration (KPM / AMC / Walmart Connect)
- Annual planning platform
- RBU-facing UI or authentication

---

## 11. Sprint 1 scope (one sentence)

**Ship the Brand Marketing home page (Layer 1) with brief, approval, and the routed Product Request process (Layer 2) so a Brand Marketer logging into Portal for the first time sees their portfolio, can meaningfully direct it, and can process a Producer's product request to closure — all within 15 minutes.**

Success criteria:

1. A real Brand Marketer at Publix sees the Home Page and says some version of *"that's the view I've been trying to build in Smartsheet."*
2. A real Producer can submit a Product Request from their campaign in under 60 seconds.
3. Two Producers can discover each other's in-progress requests and self-coordinate, without BM intervention.

---

## 12. Data model — Sprint 1

Next migration numbers: **081** (foundation), **082** (briefs + approvals), **083** (product requests), **084** (seed data).

### Migration 081 — Brand Marketing foundation *(SHIPPED 2026-04-22)*

**UserRole enum** — added `"Brand Marketing Manager"` to `user_role` Postgres enum and to [types/domain.ts](portal-v2/types/domain.ts) UserRole union. `formatRoleLabel` in [lib/auth/roles.ts](portal-v2/lib/auth/roles.ts) returns the value as-is.

**`campaigns` enrichment**

```sql
alter table public.campaigns
  add column if not exists brand_owner_id uuid references public.users(id) on delete set null,
  add column if not exists line_of_business text;

alter table public.campaigns
  add constraint campaigns_line_of_business_check
  check (line_of_business is null or line_of_business in (
    'Bakery','Deli','Produce','Meat & Seafood','Grocery','Health & Wellness','Pharmacy'
  ));

create index if not exists idx_campaigns_brand_owner on public.campaigns(brand_owner_id);
create index if not exists idx_campaigns_line_of_business on public.campaigns(line_of_business);
```

Backfill shipped: all existing campaigns defaulted to `line_of_business = 'Grocery'` as catch-all; migration 084 seed reclassifies the demo campaigns.

**RLS** — BMM can SELECT + UPDATE campaigns where `brand_owner_id = auth.uid()` via new `campaigns_bmm_read` and `campaigns_bmm_update` policies. The update `WITH CHECK` blocks transfer of ownership (admin action). Admin retains full write via pre-existing `campaigns_modify`.

### Migration 082 — Brief + Approval

**`campaign_briefs`**

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| campaign_id | uuid unique fk → campaigns.id | one brief per campaign |
| objective | text | what success looks like |
| audience | text | target shopper + insight |
| proposition | text | single-minded message |
| mandatories | text | claims, legal, brand must-haves |
| success_measure | text | KPI(s) |
| references | text[] | URLs, asset ids, prior work |
| author_id | uuid fk → users.id | |
| last_edited_by | uuid fk → users.id | |
| version | int default 1 | |
| created_at, updated_at | timestamptz | |

Completeness score (computed in service layer, not DB): count of non-null fields / 6.

**`campaign_brief_versions`** (light audit)

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| brief_id | uuid fk | |
| version | int | |
| snapshot_json | jsonb | |
| edited_by | uuid fk → users.id | |
| edited_at | timestamptz | |

**`brand_approvals`**

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| subject_type | text check (subject_type in ('campaign_brief','shot_list','variant_set','final_asset')) | |
| subject_id | uuid | no FK (polymorphic); app layer enforces integrity |
| campaign_id | uuid fk → campaigns.id | denormalized for easy filtering |
| requested_by | uuid fk → users.id | |
| assigned_to | uuid fk → users.id | the BM |
| state | text check (state in ('pending','approved','changes_requested','rejected','withdrawn')) default 'pending' | |
| comment | text | required when state != 'approved' |
| decided_at | timestamptz | |
| created_at, updated_at | timestamptz | |

Indexes: `(assigned_to, state)` for the Home Page queue; `(campaign_id)` for campaign pages.

**RLS**

- `campaign_briefs`: read by campaign producer/AD/BM-owner/Admin. Write by producer/BM-owner/Admin.
- `brand_approvals`: read by requester, assignee, campaign producer/AD/BM-owner, Admin. Write by requester (create) and assignee (decide).

### Migration 083 — Product Requests

**`product_requests`**

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| request_number | text unique | format `PR######` (Product Request, no dash — mirrors WF convention) |
| campaign_id | uuid fk → campaigns.id | |
| shoot_date_id | uuid fk → shoot_dates.id | nullable; can be shoot-level or campaign-level |
| product_id | uuid fk → products.id | nullable; sometimes it's "whatever the RBU has" |
| product_description | text | free text for when product isn't in catalog |
| quantity | int | |
| unit | text | e.g., "cases", "lbs", "each" |
| hero_or_swap | text check (hero_or_swap in ('hero','swap','either')) | |
| delivery_by | timestamptz | when it needs to be on set |
| priority | text check (priority in ('standard','rush')) default 'standard' | |
| notes | text | producer-authored |
| restrictions | text | dietary / appearance / ripeness |
| line_of_business | text | which LOB this request belongs to (same enum as campaigns.line_of_business); denormalized from product.department or campaign.line_of_business when set, else entered by producer |
| status | text check (status in ( `see state machine below` )) default 'in_progress' | |
| requested_by | uuid fk → users.id | the producer |
| submitted_at | timestamptz | set when producer clicks Submit (flips to formalized) |
| bm_resolved_by | uuid fk → users.id | the BM who moved it out of `formalized` |
| bm_resolved_at | timestamptz | |
| substituted_product_id | uuid fk → products.id | populated on `substituted` |
| substitution_note | text | "swap flank steak for premium ribeye, same price" |
| decline_reason | text | populated on `declined` |
| delivered_at | timestamptz | populated on `delivered` |
| delivered_by | uuid fk → users.id | Studio or Producer marks it |
| created_at, updated_at | timestamptz | |

**State machine:**

```
in_progress          ← producer drafting (editable by producer)
  └─ formalized      ← producer submits (BM queue)
       ├─ confirmed  ← BM says "RBU committed"
       │    ├─ delivered (terminal)
       │    └─ cancelled
       ├─ substituted ← BM captures RBU's alternate SKU
       │    ├─ delivered (terminal)
       │    └─ cancelled
       ├─ declined   ← terminal
       └─ cancelled
in_progress → cancelled (producer drops it before submitting)
```

Enforced with a DB check constraint on transitions plus a service-layer guard.

**`product_request_events`** (audit)

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| product_request_id | uuid fk | |
| actor_id | uuid fk → users.id | |
| from_status | text | |
| to_status | text | |
| comment | text | |
| created_at | timestamptz | |

**RLS**

- `product_requests` SELECT: **open to all authenticated users with roles Producer, Brand Marketing, Admin, Studio** — any of them can see any request. This is the "company-wide alignment" requirement.
- INSERT: Producer, Brand Marketing, Admin.
- UPDATE:
  - `requested_by` can edit their own draft while `status = 'in_progress'` and can `cancel`.
  - `requested_by` can transition their own `in_progress → formalized`.
  - Brand Marketing + Admin can transition `formalized → confirmed/substituted/declined/cancelled` and set resolution fields.
  - Studio + Producer on the campaign + Brand Marketing + Admin can transition `confirmed/substituted → delivered`.
- Every transition writes a row in `product_request_events`.

### Migration 084 — Seed data (covered in Story 6)

### Deferred to Sprint 2

- `line_of_business` as a full table (Layer 4, if/when needed)
- Notifications (in-app + email) on Product Request state changes
- Greenroom `/studio` expected-delivery tile

---

## 13. Stories — Sprint 1

Each story has: size (S/M/L), files, acceptance criteria.

### Story 1 — Brand Marketing role + campaign enrichment

**Size:** M

**Scope**
- Migration 081.
- Add `Brand Marketing Manager` to `UserRole` union + `formatRoleLabel`.
- Add RLS policies.
- Backfill existing campaigns with `line_of_business = 'Grocery'`.

**Files**
- `portal-v2/supabase/migrations/081_brand_marketing_foundation.sql` (NEW)
- [portal-v2/types/domain.ts](portal-v2/types/domain.ts) (edit)
- [portal-v2/lib/auth/roles.ts](portal-v2/lib/auth/roles.ts) (edit)

**Acceptance**
- [x] Migration applies on a fresh branch. *(applied 2026-04-22)*
- [x] `Brand Marketing Manager` renders as a role label.
- [x] Every existing campaign has a `line_of_business`. *(13/13 backfilled to 'Grocery')*
- [ ] RLS test: a BMM assigned as `brand_owner_id` on one campaign can read it + edit `line_of_business`; cannot edit another campaign they don't own. *(deferred to Story 6 seed when BMM users exist; policy structure verified at migration time)*

---

### Story 2 — Home page skeleton

**Size:** M

**Scope**
- Route `/brand-marketing` (role: Admin, Brand Marketing).
- Layout: three tile containers using tile-header pattern.
- Rail 1 (In-flight under my brands): list campaigns where `brand_owner_id = me`; show LOB chip; yellow badge if no brief.
- Rail 2 (Next 30 days in-market): list campaigns owned by me with an in-market date in next 30 days.
- Rail 3 (Awaiting my approval): empty state for now (Story 4 fills it).
- Sidebar nav entry.

**Files**
- `portal-v2/app/(portal)/brand-marketing/page.tsx` (NEW)
- `portal-v2/components/brand-marketing/*` (NEW)
- [portal-v2/components/layout/sidebar.tsx](portal-v2/components/layout/sidebar.tsx) (edit)

**Acceptance**
- [ ] Page renders for a BM test user with populated rails.
- [ ] Empty states are editorial, not enterprise.
- [ ] LOB filter chips at top of page narrow every rail.
- [ ] Page loads in < 1s with 50 campaigns seeded.
- [ ] Tile headers match the spec in [CLAUDE.md](portal-v2/CLAUDE.md).

---

### Story 3 — Campaign brief structured record

**Size:** M

**Scope**
- Migration 082 (brief tables only — approval split to Story 4).
- Brief edit UI on `/campaigns/[id]` (new tab or drawer).
- Fields: objective, audience, proposition, mandatories, success_measure, references (multi-URL).
- "Completeness" indicator (x of 6 fields filled).
- Version snapshot on every save.

**Files**
- `portal-v2/supabase/migrations/082_campaign_briefs_and_approvals.sql` (NEW — may split)
- `portal-v2/lib/services/campaign-briefs.service.ts` (NEW)
- `portal-v2/app/api/campaign-briefs/...` (NEW)
- `portal-v2/components/campaign/brief-editor.tsx` (NEW)

**Acceptance**
- [ ] Any Producer, AD, or BM owner on a campaign can edit.
- [ ] Each save creates a `campaign_brief_versions` row.
- [ ] Completeness score displays on the campaign page AND feeds Home Page BRIEF HEALTH.
- [ ] Export-to-PDF works (can reuse existing PDF export infra).

---

### Story 4 — Brand approval gate

**Size:** L

**Scope**
- `brand_approvals` table + service.
- "Request BM approval" action from: a campaign brief, a shot list, a variant set (Asset Studio).
- "Awaiting my approval" queue on Home Page (Rail 3).
- Approval action UI: approve / request changes (comment required) / reject (comment required).
- Decision is logged; viewing the subject shows approval state + decision trail.

**Files**
- `portal-v2/lib/services/brand-approvals.service.ts` (NEW)
- `portal-v2/app/api/brand-approvals/...` (NEW)
- `portal-v2/components/brand-marketing/approval-queue.tsx` (NEW)
- `portal-v2/components/brand-marketing/approval-action-panel.tsx` (NEW)
- touches to shot-list view, brief editor, Asset Studio variant set page

**Acceptance**
- [ ] Producer on a campaign can "Request BM approval" on a brief.
- [ ] BM owner sees it in Home Page queue within seconds (SWR).
- [ ] BM can approve / request changes / reject with comment.
- [ ] Decision appears on the subject page with actor + timestamp + comment.
- [ ] Aging indicator shows on queue items > 2 days old.

---

### Story 5 — Product Requests (the routed process)

**Size:** L

**Scope**
- Migration 083 (`product_requests` + `product_request_events`).
- Service `product-requests.service.ts` with state-machine transition helpers + RLS.
- API routes: `/api/product-requests` GET/POST, `/api/product-requests/[id]` GET/PATCH, `/api/product-requests/[id]/transition` POST (state change with required comment), `/api/product-requests/[id]/events` GET.
- **Producer-side UI:**
  - "Request product" button on `/campaigns/[id]` Products tab (and from a shoot day view).
  - Request drawer: fields for product (catalog picker) OR free-text description, quantity + unit, hero/swap, delivery-by, shoot day, notes, restrictions. Saves as `in_progress` draft. Editable until submitted.
  - Submit button flips to `formalized`. Status chip changes.
  - My drafts visible on the producer's own dashboard.
- **BM-side UI (Home Page):**
  - Tile 1 **FORMAL REQUESTS**: list of `formalized` requests across the company. Click → detail drawer with action buttons (Confirm / Substitute / Decline / Cancel).
  - Tile 2 **IN PROGRESS**: read-only list of `in_progress` drafts across the company. Heads-up view.
- **Shared `/product-requests` page** (Producer, BM, Admin, Studio):
  - Two tabs: Formal Requests + In Progress. Filters: line of business, shoot date range, status.
  - Company-wide visibility — Producers see other Producers' drafts too, enabling peer alignment (§6b).
- **Detail drawer** (shared across roles):
  - Shows status timeline, product detail, substitution info if any, decline reason if any.
  - Comments thread on the request (writes to `product_request_events`).
  - Role-appropriate action buttons.
- **Export-to-PDF** — one-page handout per RBU department for BM's weekly sync.
- **Delivery marking** — on the request detail drawer, Studio / Producer / BM can mark `delivered` with timestamp.

**Files**
- `portal-v2/supabase/migrations/083_product_requests.sql` (NEW)
- `portal-v2/lib/services/product-requests.service.ts` (NEW)
- `portal-v2/app/api/product-requests/...` (NEW)
- `portal-v2/app/(portal)/product-requests/page.tsx` (NEW)
- `portal-v2/components/product-requests/request-drawer.tsx` (NEW)
- `portal-v2/components/product-requests/request-list.tsx` (NEW)
- `portal-v2/components/product-requests/state-action-panel.tsx` (NEW)
- `portal-v2/components/brand-marketing/home-requests-tiles.tsx` (NEW)
- `portal-v2/components/campaign/campaign-products-tab.tsx` (edit — add Request button)
- [portal-v2/components/layout/sidebar.tsx](portal-v2/components/layout/sidebar.tsx) (edit — add `/product-requests` nav for Producer + BM + Admin + Studio)

**Acceptance**
- [ ] Marcus (§6b) can create an in-progress draft, edit it over two days, and submit in under 60 seconds.
- [ ] Submission flips status to `formalized` and the request appears in the BM Home Page tile within seconds (SWR).
- [ ] Alex (another producer) can see Marcus's in-progress draft on `/product-requests` and open a conversation with him outside Portal.
- [ ] Nicole (BM) can transition a request through Confirm → Delivered with required comments on state changes that aren't `confirmed` or `delivered`.
- [ ] Substitute captures the alternate product + note; decline captures reason.
- [ ] Each transition writes a `product_request_events` row with actor + timestamp.
- [ ] Export-to-PDF produces one page per RBU department grouping.
- [ ] RLS blocks a Producer from editing another Producer's draft; blocks anyone outside Producer/BM/Admin/Studio from reading.
- [ ] Empty states are editorial, not enterprise.

---

### Story 6 — Seed data, polish, demo pass

**Size:** M

**Scope**
- Seed 2 BM users (one Aprons owner, one Publix Premium owner).
- Seed 2 additional Producer users for the peer-alignment demo.
- Assign `brand_owner_id` and `line_of_business` on ~15 existing seeded campaigns.
- Seed 8 briefs (varying completeness).
- Seed 6 pending approvals.
- Seed 12 product requests across varied states: 5 in_progress, 4 formalized, 2 confirmed, 1 substituted.
- Polish empty states, labels, status pills.
- Walk through Nicole's morning triage (§6a), the Product Request flow (§6b), and the brand drift catch (§6c) end-to-end, screenshot each.

**Files**
- `portal-v2/supabase/migrations/084_seed_brand_marketing_demo.sql` (NEW)

**Acceptance**
- [ ] All three journeys in §6 work end-to-end in the preview environment.
- [ ] Screenshots captured for the Laura ↔ stakeholder demo.
- [ ] No text anywhere < 10px. All tile headers conform to spec.

---

## 14. Follow-up backlog (post-Sprint 1)

Mapped to the Layer 3 / Layer 4 columns in §10.

1. **Product Request notifications** (Layer 3) — in-app + email on state changes (Producer when BM transitions, BM when Producer submits, Studio when confirmed near shoot day).
2. **Greenroom `/studio` shoot-day tile** (Layer 3) — expected product deliveries per shoot day; reuses the meal-status pattern.
3. **30/60/90 calendar view** (Layer 3) — full calendar, filterable by sub-brand, RBU, state.
4. **Budget burn + velocity tile** (Layer 3) — ties to existing `campaign_budget` tables from the 4-section restructure.
5. **Cross-BM CMO overview** (Layer 3) — `/brand-marketing/overview` for portfolio rollup.
6. **Distinctive Brand Asset tagging** (Layer 4) — Romaniuk framework on DAM assets.
7. **Rights-expiring-soon widget** (Layer 4) — requires DAM metadata expansion.
8. **Brand drift AI check** (Layer 4) — "does this shot list match the Publix Premium positioning?"
9. **Brand health widget embed** (Layer 4) — link out to Kantar/YouGov, no native build.
10. **Positioning statement library** (Layer 4) — one statement per sub-brand, surfaced in brief editor.
11. **Approval auto-rules** (Layer 4) — "under $5K matching positioning → auto-approve with log."
12. **Line of business as a full table** (Layer 4) — when/if LOB attributes start mattering (positioning statement per LOB, merch color, imagery guidelines, etc).
13. **Parent-child annual calendar** ([Annum](https://annumplanning.com/marketing-calendar/)-style) — true enterprise roll-up.

---

## 15. Open questions

1. **Who are the real Brand Marketing Managers we'll seed?** 2026-04-22: Laura said seed reasonable names; swap for real ones when Gretchen provides.
2. ~~**What's our sub-brand list in ground truth?**~~ **RESOLVED 2026-04-22.** Not sub-brands — Lines of Business under the single Publix parent brand: Bakery, Deli, Produce, Meat & Seafood, Grocery, Health & Wellness, Pharmacy.
3. **Do we have a positioning statement per Line of Business on file?** If so, paste into seed data so the brief editor can surface it (Layer 4 but easy to stub).
4. ~~**Does "Brand Marketing" role overlap with any existing role?**~~ **RESOLVED 2026-04-22.** Role is `Brand Marketing Manager` (BMM).
5. **Is BM approval needed on Asset Studio variant sets in Sprint 1, or only on briefs/shot lists?** Currently scoped to all three; can cut variant sets to save a day.
6. **How does BM approval relate to the existing DAM `workflow_instances` from migrations 077–078?** Probably no overlap (DAM workflow is about asset state machine; brand approval is about sign-off) — but worth a 15-min confirm.

---

## 16. Glossary

- **Brand Marketing (BM)** — internal team at the retailer that translates RBU business goals into campaigns, owns brand equity across master + sub-brands, and acts as SPOC to the in-house production team. Their KPI is brand health + campaign effectiveness.
- **RBU** — Retail Business Unit. Department-level P&L owner (Bakery, Deli, Produce, Meat/Seafood, Grocery, etc.). BM's internal client. **External to Portal.**
- **Producer** — Laura's team; makes campaigns and shoots happen.
- **Line of Business (LOB)** — departmental identity under the single Publix parent brand. Enum values for Sprint 1: Bakery, Deli, Produce, Meat & Seafood, Grocery, Health & Wellness, Pharmacy. Same taxonomy as the RBU departments (which stay external to Portal). A BMM owns campaigns across one or more LOBs.
- **BMM** — Brand Marketing Manager. Portal role whose portfolio is a set of campaigns scoped by LOB + ownership.
- **Brief** — the single source of truth for a campaign's direction. Structured in Portal: objective, audience, proposition, mandatories, success measure, references.
- **Approval** — a BM's decision on a campaign artifact (brief / shot list / variant set / final asset). Approve / request changes / reject.
- **Product Request** — a Producer-initiated record of product needed for a specific shoot. Two-phase: **In Progress** (draft — producer still building) → **Formalized** (submitted — BM acts). Routed to Brand Marketing as a role (every BM + Admin sees the same queue). Visible to all Producers company-wide for peer alignment. Downstream states: confirmed / substituted / declined / delivered / cancelled. Numbered `PR######`.
- **Distinctive Brand Asset (DBA)** — Romaniuk/Ehrenberg-Bass framework: colors, logos, characters, sounds, typography scored on Fame × Uniqueness. Future work.
- **CBBE** — Keller's Customer-Based Brand Equity pyramid. Diagnostic grid for brand health.
- **Content supply chain** — Adobe framing: Plan → Brief → Create → Review → Approve → Activate → Measure → Archive. Portal V2 is the creative-production slice.
- **WF######** — campaign Work File number (existing convention).
- **Home Page** — the Brand Marketer's default landing at `/brand-marketing`. The North Star.

---

## 17. Sources

### The BM's lived experience
- [Gartner — 84% high collaboration drag](https://www.gartner.com/en/newsroom/press-releases/2024-05-14-gartner-survey-reveals-eighty-four-percent-of-marketers-report-experiencing-high-collaboration-drag-from-cross-functional-work)
- [Gartner — CMO budgets at 7.7% of revenue](https://www.gartner.com/en/newsroom/press-releases/2024-05-13-gartner-cmo-survey-reveals-marketing-budgets-have-dropped-to-seven-point-seven-percent-of-overall-company-revenue-in-2024)
- [Ziflow — State of Creative Workflow 2023](https://www.ziflow.com/blog/the-2023-state-of-creative-workflow-report-key-findings-bonus-insights)
- [Cella 2025 Intelligence Report](https://cellainc.com/insights/cella-intelligence-report/)
- [Marketing Week — 'It was a scary place' (burnout)](https://www.marketingweek.com/one-marketer-overcame-burnout/)
- [HubSpot State of Marketing 2025](https://www.hubspot.com/state-of-marketing)
- [McKinsey — Marketing operating model makeover](https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/connecting-for-growth-a-makeover-for-your-marketing-operating-model)
- [AMA — 2025 Marketing Skills Report](https://www.ama.org/2025/01/31/2025-marketing-skills-report/)

### Brand strategy frameworks
- [Keller's CBBE — Mindtools](https://www.mindtools.com/ajnlcxe/kellers-brand-equity-model/)
- [Aaker Brand Vision Model](https://howbrandsarebuilt.com/david-aakers-brand-vision-model-and-how-it-works-part-one/)
- [Ehrenberg-Bass — How Brands Grow](https://marketingscience.info/news-and-insights/how-do-you-measure-how-brands-grow)
- [Romaniuk — Category Entry Points](http://www.jenniromaniuk.com/blog/2023/1/19/increasing-mental-market-share-by-using-category-entry-points)
- [Distinctive Brand Assets framework](https://umbrex.com/resources/frameworks/marketing-frameworks/distinctive-brand-assets-framework-ehrenberg-bass/)
- [IPA — Les Binet & Peter Field](https://ipa.co.uk/knowledge/effectiveness-research-analysis/les-binet-peter-field)
- [Mark Ritson — three axioms of brand strategy](https://www.marketingweek.com/mark-ritson-brand-strategy-marketing/)
- [Interbrand Best Global Brands methodology](https://interbrand.com/thinking/best-global-brands-2021-methodology/)
- [Kantar BrandZ methodology](https://www.kantar.com/campaigns/brandz/methodology)
- [HBS — Christensen's milkshake / JTBD](https://www.library.hbs.edu/working-knowledge/clay-christensens-milkshake-marketing)

### Creative ops + content supply chain
- [Adobe — Content supply chain that stands the test of time](https://business.adobe.com/blog/how-to/create-a-content-supply-chain-that-will-stand-the-test-of-time)
- [Adobe News 2026 — Brand Intelligence + GenStudio](https://news.adobe.com/news/2026/04/adobe-introduces-brand-intelligence)
- [Aprimo — Agentic DAM](https://www.businesswire.com/news/home/20260316927462/en/Aprimo-Unveils-Agentic-Digital-Asset-Management-DAM-System-to-Govern-Content-for-the-AI-Driven-Enterprise)
- [Aprimo — 2025 Gartner MQ leader](https://www.aprimo.com/blog/2025-gartner-magic-quadrant-marketing-work-management)
- [Adobe Workfront — Creative Brief guide](https://www.workfront.com/project-management/life-cycle/initiation/creative-brief)
- [Asana — Creative briefs & requests](https://asana.com/guide/examples/design/creative-briefs-requests)
- [IHAF — Great briefs lead to great work](https://www.ihaforum.org/blog/great-briefs-lead-to-great-work)
- [Bynder — Digital Rights Management guide](https://www.bynder.com/en/guides/bynder-guide-to-digital-rights-management/)
- [Frontify — AI tools for brand management 2025](https://www.frontify.com/en/guide/ai-tools-for-brand-management)
- [Computerworld — Adobe agentic content supply chain](https://www.computerworld.com/article/4161631/adobe-builds-an-agentic-content-supply-chain-for-the-ai-era.html)

### Grocery / Publix context
- [Publix Careers — Marketing Department](https://corporate.publix.com/careers/support-areas/corporate/departments/marketing)
- [Latterly — Publix Marketing Strategy](https://www.latterly.org/publix-marketing-strategy/)
- [Progressive Grocer — Publix shopper marketing AOR](https://progressivegrocer.com/publix-consolidates-shopper-marketing-program-under-1-agency-record)
- [Kroger IR — 2025 leadership](https://ir.kroger.com/news/news-details/2025/Kroger-Announces-New-Leaders-in-Key-Roles/default.aspx)
- [Modern Retail — Kroger/Albertsons reorg](https://www.modernretail.co/marketing/retail-media-boom-forces-grocers-like-kroger-albertsons-to-reorganize/)

---

## 18. Handoff notes (for the next session)

**You are picking up Sprint 1 of a Brand Marketing initiative in Portal V2.** Read §1–§11 top-to-bottom once before touching code. The strategic framing matters — this feature's value is in the *simplicity* of the framing, not the quantity of the stories.

**Do not add an RBU role or RBU-facing UI.** RBU is context only. The RBU conversation happens offline; Portal captures both sides of what the BM knows about it via the **Product Request** lifecycle.

**Product Requests are a routed process, not a BM ledger.** Two-phase Producer flow (In Progress → Formalized) then BM-driven downstream states. Routed to Brand Marketing as a **role** — every BM + Admin sees the same queue, no individual assignment. **Visible company-wide to all Producers** for peer alignment. See §6b for the canonical journey.

**Sprint 1 shipping order** — Stories 1 → 2 → 3 → 4 → 5 → 6, mostly serial. Stories 4 and 5 are the biggest lifts; budget the most time there.

**Kickoff inputs** — confirmed with Laura 2026-04-22:

- LOBs (resolved — §15 q2): Bakery, Deli, Produce, Meat & Seafood, Grocery, Health & Wellness, Pharmacy.
- Role label (resolved — §15 q4): `Brand Marketing Manager` / BMM.
- Real BMM names for seed (§15 q1): still pending — using placeholder names until Gretchen provides.

**Design must hit the tile-header pattern** (`text-sm uppercase tracking-wider`, icon `h-4 w-4`, `flex items-center gap-2`, `px-3.5 py-2.5`, `border-b border-border`, Card `padding="none"`) per [CLAUDE.md](portal-v2/CLAUDE.md). No text below 10px anywhere.

**Design must feel editorial**, not enterprise. Think "Kinfolk magazine editor's inbox," not "JIRA." Empty states are warm, plainspoken. Status pills reuse the existing `status-pill.tsx`. No decorative iconography beyond what's already in the system.

**The Home Page is the whole point.** If you're debating scope on any given day, protect the Home Page experience first. Brief editor, approval queue, and product requests all exist *to populate the Home Page*.

**Product Requests have one subtle design property to preserve:** the two Home Page tiles (FORMAL REQUESTS + IN PROGRESS) and the shared `/product-requests` page must draw from the same source of truth and the same component. BMs triage from the Home Page; Producers browse the `/product-requests` page for peer alignment. Never let those two views drift.

**Related docs / memory**:
- [STORYTEQ_PARITY_IMPLEMENTATION_PLAN.md](portal-v2/STORYTEQ_PARITY_IMPLEMENTATION_PLAN.md) — Asset Studio roadmap; Brand Approval on variant sets ties into this.
- Memory: `feedback_rbu_external.md` — the RBU scoping rule.
- Memory: `feedback_tile_headers.md`, `feedback_design.md` — visual discipline.
- Memory: `feedback_communication.md` — Laura is not a developer; use plain language.

**Measure success like this**: if a real Brand Marketer at Publix sees the Home Page and says some version of *"I've been trying to build this in Smartsheet for years,"* we shipped it right. If they say *"this is neat but I'll still use my spreadsheet,"* we missed.
