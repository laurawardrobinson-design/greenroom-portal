# Portal V2 — Ownership Transfer Strategy

## Context

Portal V2 was built inside Marketing, by Marketing, for Marketing's creative production work. It is in active daily use and has been validated with the creative team. The goal of this proposal is to formalize what already exists: Marketing owns the application, Laura is its developer of record, and IT provides the underlying corporate infrastructure.

Today the application runs on third-party services (Vercel, Supabase) under Laura's individual accounts. Moving it onto Microsoft Azure under the company's umbrella turns an informal but successful tool into a sanctioned internal system, with a clear budget, a clear owner, and a clear infrastructure home — while keeping the application itself intact.

## Recommended Approach: Marketing-Owned, Azure-Hosted

### The partnership

Marketing leads. IT provides the platform.

| Layer | Owner | Why this fit |
|---|---|---|
| Application code, feature roadmap, release schedule | **Marketing (Laura, developer of record)** | Domain expertise lives in Marketing; the creative team's needs drive the roadmap |
| User support, training, change management | **Marketing** | Marketing owns the user community and the creative workflows the tool serves |
| Product direction and prioritization | **Marketing (Gretchen, sponsor)** | Aligns the tool with Marketing's broader objectives |
| Documentation and continuity plan | **Marketing** | Architecture documentation and a designated backup contact mitigate key-person risk |
| Azure subscription, networking, security baseline, backups | **IT** | Core IT competency; aligns the application with existing corporate standards |
| Microsoft Entra ID (corporate single sign-on) | **IT** | Centralizes identity and strengthens the security posture |

This split mirrors the model already used for other Marketing-owned applications: Marketing owns the product, IT provides the governed platform underneath.

### Why this works for both groups

**For Marketing:**
- Formalizes a tool that is already producing measurable value for the creative team.
- Establishes a real budget line for ongoing development and operations, rather than relying on individual goodwill.
- Preserves the speed and design quality that made Portal V2 worth using in the first place.
- Keeps the developer of record (Laura) close to the creative team, where the requirements come from.
- Mitigates key-person risk through architecture documentation, a code repository under Marketing's control, and a designated backup contact — without disrupting the working model.

**For IT:**
- Brings a previously informal tool into formal Azure governance.
- Standardizes authentication on Entra ID, eliminating a non-corporate login flow.
- Predictable scope — IT manages the infrastructure layer it already supports for other systems, not an unfamiliar codebase.
- Improves the company's security and compliance posture.

**For the company:**
- A sanctioned, supported internal system replaces an individually-owned one.
- Microsoft-native stack throughout, consistent with the company's technology direction.
- Clear accountability for every layer.

### Technical migration (preserves the app as written)

Each piece of the current stack maps to a Microsoft-native equivalent. The application code largely moves as-is.

| Current | Azure equivalent |
|---|---|
| Vercel hosting | **Azure App Service** or **Azure Static Web Apps** |
| Supabase database | **Azure Database for PostgreSQL** |
| Magic-link authentication | **Microsoft Entra ID** |
| Supabase storage | **Azure Blob Storage** |

This is a migration, not a rebuild — all features are preserved, and the design the creative team has adopted is unchanged.

### Why not other options

Two alternatives were considered and set aside:

- **Rebuild on Power Platform (Power Apps / Power Pages / Dataverse).** A strong fit for many internal tools. For Portal V2, the design requirements set by the creative team and the external token-gated user experience (RBU access) are difficult to deliver within Power Apps' UI ceiling. The Azure-hosted approach achieves the same Microsoft-native footprint while keeping the experience the creative team has already adopted.
- **Replace with a SaaS product.** No production-management SaaS reviewed covers the campaign + RBU + flag-loop workflow Portal V2 was built around. A SaaS migration would mean significant feature loss.

The Azure-hosted, Marketing-owned model is the option that meets corporate technology standards while protecting the work already done.

## Proposal package (next steps)

To bring this forward internally, Laura would prepare:

1. **A one-page summary** of what Portal V2 does, who uses it, and the business value it delivers.
2. **An architecture diagram** showing current state and the target Azure state.
3. **A roles and responsibilities matrix** (the table above, expanded).
4. **A cost estimate** — annual Azure hosting plus Marketing's development and operations budget.
5. **A migration timeline** — phased plan covering procurement, infrastructure setup, application migration, and cutover.
6. **A continuity plan** — documentation, backup contact, and code-repository ownership under Marketing.
