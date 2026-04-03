# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Portal V2 (Greenroom Portal), please report it responsibly.

**Contact:** [INSERT SECURITY TEAM EMAIL]
**Response SLA:** Acknowledgment within 24 hours, triage within 72 hours.

Do not open a public GitHub issue for security vulnerabilities.

## Incident Response

### Contacts

| Role | Name | Contact |
|------|------|---------|
| Security Lead | [TBD] | [TBD] |
| Engineering Lead | [TBD] | [TBD] |
| Data Privacy Officer | [TBD] | [TBD] |

### Severity Levels

| Level | Definition | Response Time |
|-------|-----------|---------------|
| Critical | Active exploit, data breach, auth bypass | Immediate (< 1 hour) |
| High | Exploitable vulnerability, PII exposure risk | < 4 hours |
| Medium | Potential vulnerability, configuration issue | < 24 hours |
| Low | Best practice deviation, informational | Next sprint |

### Response Process

1. **Detect** -- Identify the incident via monitoring, report, or alert.
2. **Contain** -- Isolate affected systems. Revoke compromised credentials.
3. **Investigate** -- Determine scope, affected data, and root cause.
4. **Remediate** -- Fix the vulnerability. Deploy patch.
5. **Notify** -- If PII or financial data was accessed, notify affected parties and legal within required timeframes.
6. **Post-mortem** -- Document what happened, why, and how to prevent recurrence.

### Breach Notification

If a breach involves PII or financial data:
- Notify Legal within 24 hours
- Notify affected users per applicable state privacy laws (CCPA: 72 hours)
- Document all actions taken in the incident log

## Security Controls

### Authentication
- Supabase Auth (email/password)
- MFA: [PENDING ENABLEMENT]
- SSO: [PENDING INTEGRATION WITH CORPORATE IDP]

### Authorization
- Role-based access control (Admin, Producer, Studio, Vendor, Art Director)
- Row-level security policies on all database tables
- API-level guards on all routes
- Vendor isolation enforced at database level

### Data Protection
- HTTPS enforced via Vercel/Supabase
- Security headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- Input validation via Zod schemas on all API inputs
- SQL injection prevention via Supabase ORM (parameterized queries)
- Rate limiting on all API routes (tiered: general, strict, auth)

### Audit Logging
- Audit triggers on security-sensitive tables (users, campaigns, vendors, invoices, gear)
- Logs: user_id, action, resource, metadata, timestamp

### Secrets Management
- Environment variables via `.env.local` (gitignored)
- Service role key: server-side only, never exposed to client
- Dev auth endpoint: disabled in production via NODE_ENV check

## Subprocessors

| Vendor | Purpose | Data Handled |
|--------|---------|-------------|
| Supabase | Database, auth, storage | All application data |
| Vercel | Hosting, CDN | Application code, HTTP requests |
| Anthropic | Invoice parsing (Edge Function) | Invoice PDFs (financial data) |

## Compliance Status

- [ ] DPA with Supabase
- [ ] DPA with Vercel
- [ ] DPA with Anthropic
- [ ] SOC2 readiness assessment
- [ ] Penetration test
- [ ] Data retention policy
- [ ] Privacy policy
