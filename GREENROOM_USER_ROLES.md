# Greenroom — User Roles, Journeys & AI Council Prompt

## How to Use This Document

This file serves two purposes:
1. **Reference** — Complete picture of every user role, their goals, pain points, and workflows
2. **AI Prompt** — Copy the "AI Council Prompt" section at the bottom into any AI conversation to have it debug, evaluate, or build features while representing all four users

---

## The Department

This is a **creative production department** inside the marketing org of a Fortune 100 grocery company. It operates like an **internal agency production house**. They shoot food photography and video for marketing materials — packaging, social media, digital ads, in-store signage, seasonal campaigns.

The department receives creative briefs from Art Directors on the creative team, then handles everything from booking crew and vendors, to managing gear, to tracking budgets and delivering final assets.

**Current pain points the software must solve:**
- No visibility into committed (approved estimates) vs. actually spent money
- No spending breakdown by category — the HOP can't see where money goes without manually parsing invoices
- Gear management is chaos — hundreds of items shared across photographers with no coordination system
- Vendor PO lifecycle is slow and manual (emails, Word docs, chasing signatures)
- Budget overages require informal conversations instead of documented requests with rationale
- Campaign playbook is planned 6 months out with no visibility into what shoots will actually require, so budgets are estimates that frequently need adjustment

---

## Role 1: HOP (Head of Production) — "Gretchen"

**App role:** Admin

**Who she is:** Department leader. Responsible for the entire production operation — people, money, output. Reports up to marketing leadership. Manages ~6 Producers and oversees the Studio team.

**Her primary goals:**
- Know where every dollar is at all times — committed, spent, remaining
- Approve or decline budget requests and overages with full context
- Approve final invoices (after Producer pre-approval) with confidence that amounts match estimates
- See the health of all active campaigns at a glance — what's on track, what's at risk
- Manage the annual/quarterly production budget and allocate pools to campaigns during playbook planning
- Ensure gear is maintained, tracked, and not lost or damaged

**Her daily workflow:**
1. Opens dashboard — needs to immediately see: pending approvals, budget health, campaigns at risk
2. Reviews approval queue: budget overage requests (with Producer rationale), invoices flagged for discrepancies
3. Checks budget dashboard: total pool, allocated vs. unallocated, committed vs. spent, spending by category
4. Scans campaign grid to see status of active productions
5. Occasionally checks gear/inventory status — maintenance overdue, items checked out too long

**What she approves:**
- Budget overage requests from Producers (amount + rationale required)
- Final invoices (after Producer pre-approval) — the app should auto-flag if invoice exceeds approved estimate
- New vendor additions to the approved roster (future feature)
- User role assignments

**What frustrates her today:**
- "How much money is committed?" requires manually adding up approved estimates across campaigns
- "What are we spending on food styling vs. photography vs. studio rental?" requires opening every invoice
- Gear goes missing or comes back damaged with no accountability trail
- Budget overages surface as hallway conversations, not documented requests

**What the software should give her:**
- An approval dashboard that is her primary workspace — not buried in settings
- Budget views that auto-calculate committed (sum of approved estimates), spent (sum of paid invoices), and remaining
- Invoice review that shows estimate vs. invoice line-by-line, with automatic flagging of discrepancies
- Campaign status visibility without clicking into every campaign
- Gear utilization and maintenance overview

**Mobile needs:**
- Approve/decline from her phone (budget requests, invoices) when she's away from desk
- Quick budget health check
- Campaign status overview

---

## Role 2: Producer — "Laura"

**App role:** Producer

**Who she is:** Campaign owner. There are ~6 Producers. Each manages multiple campaigns simultaneously. She's the bridge between the creative brief and the finished shoot — she makes it happen.

**Her primary goals:**
- Move campaigns from brief to delivery on time and on budget
- Book the right crew and vendors for each shoot
- Manage the vendor estimate → PO → invoice lifecycle without chasing people
- Stay within campaign budget, and when she can't, request overages with proper documentation
- Keep the HOP informed without manual status reports

**Her daily workflow:**
1. Receives concept deck, shot list, and PR draft from Creative Art Director
2. Checks production budget (allocated by HOP during playbook planning 6 months prior)
3. Books crew — either internal photographers or external vendors from approved roster
4. For vendors: sends invitation to submit estimate for the campaign
5. Reviews vendor estimates, approves or requests revision
6. Once estimate approved, a PO is issued (from marketing budget department — separate team, but once the document arrives, Producer manages getting it signed)
7. Coordinates shoot logistics (dates, location, gear needs, crew assignments)
8. After shoot: receives vendor invoice, pre-approves it (checks against estimate), routes to HOP for final approval
9. Manages deliverable tracking through post-production handoff

**Vendor management specifics:**
- Works with a regular roster of onboarded vendors (food stylists, photographers, production companies, studios, makeup artists, prop houses)
- Needs to see vendor history — who did we use last time for this type of shoot?
- Vendors submit itemized estimates with categories (labor, materials, equipment rental, travel, etc.)
- If invoice exceeds the approved estimate, an overage estimate is required before the invoice can be approved
- PO documents come from a separate budget department — the Producer uploads the PO into the app and manages the vendor signing it

**Budget management specifics:**
- Each campaign has a budget allocated from the production pool
- Playbook planning happens 6 months early with no visibility into actual shoot needs
- Frequently needs to request overages — must provide amount and rationale
- Needs to see: campaign budget, committed amount (approved estimates), remaining budget, individual vendor costs

**What frustrates her today:**
- Chasing vendors for estimates and signatures via email
- No single place to see all her campaigns and their financial status
- Budget tracking is manual — spreadsheets and memory
- PO lifecycle involves too many manual handoffs
- Can't easily see which vendors are available or what they quoted on similar past jobs

**What the software should give her:**
- Campaign dashboard showing her active campaigns with budget and status at a glance
- One-click vendor invitation to submit estimates
- Estimate review with line items and ability to approve/request revision
- PO upload and digital signature collection from vendors
- Invoice pre-approval with automatic comparison to approved estimate
- Budget overage request form with rationale field
- File management for concept decks, shot lists, contracts, deliverables

**Mobile needs:**
- Check campaign status on the go
- Approve vendor estimates
- View and respond to budget issues
- Quick access to shoot day details and crew contacts

---

## Role 3: Studio Team — "Studio"

**App role:** Coordinator

**Who she/he is:** Internal photographers, coordinators, PAs, and the Studio Manager. ~10 people. They're the ones physically on set, handling equipment, and shooting. The Studio Manager has additional responsibility for gear maintenance.

**Their primary goals:**
- Know what shoots they're assigned to and when
- Check out the right gear for each shoot quickly
- Reserve gear in advance so it's available when needed
- Build favorite gear packages (kits) for common shoot types so checkout is fast
- Track gear condition and report maintenance needs
- Coordinate shared equipment across multiple photographers

**Their daily workflow:**
1. Check upcoming shoot assignments — what am I shooting, when, where
2. Before a shoot: reserve gear, or check out pre-built kit using QR scan
3. On set: shoot, manage equipment
4. After shoot: check in all gear with condition notes, flag anything damaged
5. Studio Manager: review maintenance queue, schedule repairs, track maintenance costs

**Gear management specifics:**
- Hundreds of pieces of equipment: cameras, lenses, lighting, audio, grip, props
- Each item has a QR code (RFID batch scanning is future goal)
- Check-out/check-in must be fast — scan QR, confirm condition, go
- Favorite kits: save common gear bundles (e.g., "Standard Food Flat Lay Kit" = specific camera + 3 lenses + 2 lights + diffuser)
- Reservations: book gear for upcoming shoots, system prevents double-booking
- Condition tracking: log condition at checkout and checkin, flag damage
- Maintenance: scheduled service intervals, repair tracking with costs
- The Studio Manager needs more control over maintenance workflows but for V1, shared dashboard views are fine for all internal team

**What frustrates them today:**
- No idea if the gear they need is available until they walk to the gear room
- Someone else checked out a lens they needed — no visibility
- Gear comes back damaged with no record of who had it or what happened
- Building a gear loadout for a shoot means manually gathering items with no checklist
- Maintenance falls behind because there's no tracking system

**What the software should give them:**
- Shoot calendar showing their assignments
- Fast QR-based checkout/checkin (scan → confirm condition → done)
- Gear availability at a glance — what's available, what's out, what's reserved
- Kit builder — save favorite gear combinations, one-tap checkout of entire kit
- Reservation system — book gear for future shoots, see conflicts
- Maintenance log — report issues, see upcoming scheduled maintenance
- Equipment history — who had this item, when, what condition

**Mobile needs (this is their PRIMARY device on set):**
- QR scanning for check-in/check-out (camera-based)
- Quick gear availability lookup
- Shoot day details and schedule
- Report gear damage/issues from the field

---

## Role 4: Vendor — "Sam"

**App role:** Vendor

**Who they are:** External contractors — food stylists, photographers, production companies, studio rental, makeup artists, prop houses. They work with this team regularly but are not employees. They only see campaigns they're assigned to. They never see other vendors' financial information.

**Their primary goals:**
- Respond to campaign invitations quickly
- Submit accurate, itemized estimates
- Sign POs digitally without printing/scanning
- Submit invoices after the shoot
- Get paid

**Their workflow (the PO lifecycle from their side):**
1. **Invited** — Receive notification they've been added to a campaign
2. **Submit Estimate** — Fill out itemized estimate (labor, materials, equipment, travel, etc.)
3. **Estimate Approved** — Producer approves (or requests revision)
4. **PO Issued** — Producer uploads PO document from budget department
5. **Sign PO** — Vendor reviews PO and signs digitally (drawn signature + IP/timestamp capture)
6. **Shoot Happens** — Vendor performs the work
7. **Submit Invoice** — Upload invoice PDF after the shoot
8. **Invoice Approved** — Producer pre-approves, then HOP final approves
9. **Paid** — Marked as paid (actual payment happens outside the system)

**Critical rules:**
- Vendors can ONLY see campaigns they are assigned to
- Vendors can NEVER see other vendors' estimates, invoices, or financial data
- Vendors can only upload files categorized as "Deliverable" or "Invoice" — no access to internal documents
- The PO lifecycle is a strict state machine — steps cannot be skipped
- If invoice amount exceeds the approved estimate, the system must flag it and require an overage estimate before the invoice can be approved

**What frustrates vendors today:**
- Waiting for emails with PO documents
- Printing, signing, scanning POs and sending back
- No visibility into where things stand — "Did they approve my estimate?" "When will I get the PO?"
- Invoice disputes because there's no shared record of what was agreed upon

**What the software should give them:**
- Clean, simple interface — they don't need the full app, just their assigned campaigns
- Status visibility on each campaign they're part of — where are we in the process
- Estimate submission form with line items
- Digital PO signature (draw on screen, legally captured with IP + timestamp)
- Invoice upload
- Notification when action is needed from them

**Mobile needs:**
- Check status of their campaigns/POs
- Sign POs from their phone
- Upload invoices (photo of paper invoice or PDF)
- Respond to estimate requests

---

## The Campaign Lifecycle (All Roles Together)

```
Creative Art Director sends concept deck + shot list + PR draft
        |
        v
PRODUCER receives brief, checks campaign budget (set by HOP months ago)
        |
        v
PRODUCER books crew:
  - Internal → assigns STUDIO team members
  - External → invites VENDOR(s) from approved roster
        |
        v
VENDOR submits itemized estimate
        |
        v
PRODUCER reviews estimate → approves or requests revision
        |
        v
PO issued (from separate budget department, uploaded by PRODUCER)
        |
        v
VENDOR signs PO digitally
        |
        v
STUDIO checks out gear (QR scan, kits, reservations)
        |
        v
=== SHOOT DAY ===
  - STUDIO on set with gear
  - VENDOR performing contracted work
  - PRODUCER coordinating
        |
        v
STUDIO checks in gear (condition assessment)
        |
        v
VENDOR submits invoice
        |
        v
APP auto-compares invoice to approved estimate, flags discrepancies
        |
        v
PRODUCER pre-approves invoice (or flags issues)
        |
        v
HOP final approval on invoice
        |
        v
VENDOR marked as paid (payment happens outside system)
        |
        v
Campaign status → Complete
```

**Budget flow throughout:**
- HOP allocates budget pools during playbook planning (6 months ahead)
- Each campaign gets an allocation from the pool
- "Committed" = sum of all approved vendor estimates on a campaign
- "Spent" = sum of all paid vendor invoices
- If a campaign needs more money → Producer submits overage request with rationale → HOP approves/declines
- Unspent campaign budget returns to the pool

---

## Non-Standard Shoots

Not every shoot fits the neat lifecycle above. The software must be structured but not restrictive. Examples:
- Emergency/rush shoots with compressed timelines
- Internal-only shoots (no vendors, just Studio team)
- Reshoot requests that piggyback on existing campaigns
- Multi-day shoots that span weeks
- Shoots where the concept changes mid-production

The system should allow skipping optional steps (like vendor assignment on internal-only shoots) while enforcing critical ones (like the PO state machine for any vendor engagement).

---

## AI Council Prompt

Copy everything below this line into a new AI conversation to have it evaluate, debug, or build features for Greenroom while representing all four users:

---

```
You are an AI council representing the four user roles of Greenroom, a creative production management portal for an internal agency production house at a Fortune 100 grocery company. The department manages photo/video shoots for marketing materials, especially food photography.

When evaluating any feature, UI, workflow, or bug, you must consider the perspective of ALL FOUR users and flag conflicts or gaps. Respond as each role when relevant.

THE FOUR COUNCIL MEMBERS:

**GRETCHEN (HOP / Admin — Head of Production)**
Department leader. Manages ~6 Producers, oversees Studio team, owns the budget.
Primary concern: Financial visibility — committed vs. spent, spending by category, budget health.
She approves: budget overage requests, final invoices (after Producer pre-approval), vendor roster additions, user roles.
She needs: an approval dashboard as her primary workspace, auto-calculated budget views, invoice vs. estimate comparison with auto-flagging, campaign status at a glance, gear utilization overview.
Her frustration: "I can't tell how much money is committed versus spent without manually adding up estimates."
Test her perspective by asking: "Can Gretchen see the financial health of the department in under 10 seconds?"

**LAURA (Producer — Campaign Owner)**
One of ~6 Producers. Manages multiple campaigns simultaneously. Bridge between creative brief and finished shoot.
Primary concern: Moving campaigns from brief to delivery on time and on budget without manual busywork.
She manages: vendor invitations, estimate review/approval, PO upload and signature collection, invoice pre-approval, budget overage requests, crew booking, shoot logistics.
She needs: campaign dashboard with budget and status, one-click vendor workflows, estimate-to-invoice tracking, overage request forms, file management.
Her frustration: "I spend half my time chasing vendors for estimates and signatures via email."
Test her perspective by asking: "Can Laura manage her 5 active campaigns without switching to email or spreadsheets?"

**STUDIO TEAM (Coordinator — Internal Photographers + Studio Manager)**
~10 internal team members who are physically on set. They share hundreds of pieces of gear.
Primary concern: Gear availability, fast checkout, knowing their shoot schedule.
They manage: gear check-in/out via QR scan, gear reservations, favorite kits, condition reporting, maintenance tracking.
They need: QR scanning that works fast, gear availability at a glance, kit builder for common loadouts, reservation system with conflict detection, maintenance logging, shoot calendar with assignments.
Their frustration: "I walk to the gear room and the lens I need is already checked out with no record of who has it."
Test their perspective by asking: "Can a photographer check out a full kit for tomorrow's shoot in under 60 seconds?"

**SAM (Vendor — External Contractor)**
Food stylists, photographers, production companies, studios, makeup artists, prop houses. External, not employees.
Primary concern: Know what's needed, submit paperwork, get paid. Minimum friction.
They can: see ONLY their assigned campaigns, submit estimates, sign POs digitally, upload invoices/deliverables. They can NEVER see other vendors' financial data.
They need: simple interface showing their campaigns and status, estimate form with line items, digital signature canvas, invoice upload, clear status indicators.
Their frustration: "I submitted my estimate three days ago and have no idea if it was approved."
Test their perspective by asking: "Can Sam see exactly where every one of their active campaigns stands without calling the Producer?"

CRITICAL RULES THE SOFTWARE ENFORCES:
1. PO lifecycle is a strict 9-step state machine — steps cannot be skipped (Invited → Estimate Submitted → Estimate Approved → PO Issued → PO Signed → Shoot Complete → Invoice Submitted → Invoice Approved → Paid)
2. Vendor data isolation — vendors never see other vendors' financial information
3. Invoice must be <= approved estimate amount, or an overage estimate is required
4. Budget committed = sum of approved estimates; Budget spent = sum of paid invoices
5. Gear checkout is atomic — no race conditions, no double-booking
6. The system must be structured but not restrictive — non-standard shoots happen

When asked to evaluate anything, respond with:
- GRETCHEN says: [her perspective, focused on oversight, budget, approvals]
- LAURA says: [her perspective, focused on campaign workflow, vendor management]
- STUDIO says: [their perspective, focused on gear, scheduling, on-set needs]
- SAM says: [their perspective, focused on simplicity, status visibility, getting paid]
- CONFLICTS: [any tensions between roles]
- RECOMMENDATION: [your unified recommendation]
```
