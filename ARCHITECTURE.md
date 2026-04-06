# Architecture

## Overview

Portal V2 (Greenroom Portal) is a creative production management platform for a Fortune 100 grocery company's in-house content team. It manages campaigns, vendor relationships, gear inventory, crew scheduling, invoices, and budget tracking.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16.2, React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Backend | Next.js API Routes (84 routes) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (JWT + cookies) |
| Storage | Supabase Storage (4 buckets) |
| AI | Anthropic Claude API (invoice parsing via Edge Function) |
| Hosting | Vercel |

## Directory Structure

```
portal-v2/
  app/
    (auth)/          # Login, auth callback
    (portal)/        # Main app (requires auth)
      campaigns/     # Campaign management
      vendors/       # Vendor portal
      gear/          # Gear inventory
      goals/         # Growth plans
      dashboard/     # Dashboard
      ...
    api/             # 84 API routes
      auth/          # Auth endpoints
      campaigns/     # Campaign CRUD
      vendors/       # Vendor operations
      invoices/      # Invoice management
      gear/          # Gear operations
      files/         # File uploads
      health/        # Health check
  components/
    ui/              # Shared UI components
    layout/          # App shell, sidebar
    campaigns/       # Campaign-specific components
    vendors/         # Vendor-specific components
    gear/            # Gear-specific components
  lib/
    auth/            # Guards, roles, permissions
    services/        # Business logic (service layer)
    supabase/        # Supabase client setup
    validation/      # Zod schemas
  hooks/             # React hooks (SWR data fetching)
  types/             # TypeScript types
  supabase/
    migrations/      # 39 incremental SQL migrations
    functions/       # Edge Functions (invoice parser)
```

## Data Flow

```
Browser -> Next.js Middleware (auth + rate limiting)
  -> API Route (auth guard + role check)
    -> Service Layer (business logic)
      -> Supabase Admin Client (bypasses RLS for service operations)
        -> PostgreSQL (RLS as defense-in-depth)
```

## Authentication & Authorization

### Auth Flow
1. User logs in via Supabase Auth (email/password)
2. JWT stored in secure httpOnly cookie (managed by Supabase SSR)
3. Middleware refreshes token on every request
4. API routes call `getAuthUser()` which verifies JWT AND checks DB for current role
5. Role never trusted from JWT alone -- database is source of truth

### Roles
| Role | Access |
|------|--------|
| Admin | Full system access |
| Producer | Campaign and vendor management |
| Studio | Shoots they're assigned to, gear |
| Vendor | Own campaign assignments only |
| Art Director | Content and creative oversight |

### Permission Model
- **API Guards** (`lib/auth/guards.ts`): `requireRole()`, `requireCampaignAccess()`, `requireVendorOwnership()`
- **Database RLS** (`supabase/migrations/006_rls_policies.sql`): 40+ row-level security policies
- **Permission Matrix** (`lib/auth/roles.ts`): Feature-level permissions per role

## Database

### Key Tables
- `users` -- App users with roles
- `campaigns` -- Production campaigns
- `vendors` / `campaign_vendors` -- Vendor assignments per campaign
- `vendor_estimate_items` / `vendor_invoices` -- Financial data
- `gear_items` / `gear_checkouts` / `gear_reservations` -- Inventory
- `shoots` / `shoot_dates` / `shoot_crew` -- Scheduling
- `audit_logs` -- Security audit trail
- `campaign_assets` -- Uploaded files

### Migrations
All schema changes are version-controlled in `supabase/migrations/` (001-039). Migrations are incremental and can recreate the full database from scratch on any Supabase instance.

## Storage Buckets

| Bucket | Access | Content |
|--------|--------|---------|
| campaign-assets | RLS-protected | Contracts, deliverables, shot lists |
| signatures | Private | Vendor PO signatures |
| gear-images | RLS-protected | Gear inventory photos |
| invoices | Private | Vendor invoices |

## API Security

- **Rate Limiting** (`lib/rate-limit.ts`): Tiered -- general (100/min), strict (10/min), auth (20/5min)
- **Input Validation**: Zod schemas on all inputs
- **Error Sanitization**: Generic error responses, no DB details leaked
- **File Upload Validation**: MIME type allowlist, 50MB size limit
- **Security Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options

## Deployment

### Environment Variables
| Variable | Purpose | Scope |
|----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public API key (safe for client) | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (server-only) | Server only |
| `NEXT_PUBLIC_DEV_AUTH` | Enable demo mode | Dev only |

### Portability
To deploy on a new Supabase instance:
1. Create a new Supabase project
2. Run all migrations in order (`supabase/migrations/001-039`)
3. Set the three Supabase environment variables
4. Deploy to Vercel (or any Node.js host)
5. (Optional) Set `ANTHROPIC_API_KEY` in Supabase Edge Function secrets for invoice parsing
