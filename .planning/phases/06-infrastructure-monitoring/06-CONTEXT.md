# Phase 6: Infrastructure & Monitoring - Context

**Gathered:** 2026-01-31
**Phase Goal:** Production monitoring and protection systems are operational

## User Decisions

### Health Checks
- **Scope:** Full stack coverage
  - Supabase DB connection
  - Stripe API reachability
  - Resend API health
  - Edge function availability
- **Format:** Standard JSON health response with status per service

### Rate Limiting
- **Strategy:** Tiered by endpoint (decided by implementation)
  - Auth/payment endpoints: 20 req/min per IP (strict)
  - Read endpoints: 200 req/min per IP (relaxed)
  - Webhook endpoints: No limit (Stripe needs freedom)
- **Blocked request handling:** Return 429 with Retry-After header

### Error Tracking & Alerting
- **Error tracking:** Sentry integration for frontend and edge functions
- **Alert channel:** Email only (to owner email)
- **Alert triggers:** Errors + warnings
  - Critical: Payment failures, webhook errors, DB connection lost
  - Warning: Rate limit hits, slow queries, retry attempts
- **Alert frequency:** Aggregate similar errors (no spam)

### Logging
- **Log level:** Info and above in production
  - Info: Significant events (requests, payments, scans)
  - Warn: Concerning patterns (retries, slow operations)
  - Error: Failures and exceptions
- **Log format:** Structured JSON with request ID tracing
- **Log storage:** Supabase's built-in logging dashboard
- **Correlation:** Request ID passed through all operations

## Success Criteria (from ROADMAP.md)

1. Health check endpoints exist for all critical services and return correct status
2. Rate limiting protects APIs from abuse without blocking legitimate traffic
3. Sentry captures and reports production errors with full context
4. Application logs are structured JSON and searchable by request ID
5. Critical errors trigger alerts via configured notification channel

## Technical Constraints

- Supabase Edge Functions for backend (Deno runtime)
- Frontend apps: React (gate-scanner, pass-lounge, nights)
- Rate limiting: Supabase built-in or custom middleware
- Sentry: @sentry/browser for frontend, @sentry/deno for edge functions

## Requirements Covered

- INFRA-01: Health check endpoints exist for monitoring
- INFRA-02: Rate limiting prevents API abuse
- INFRA-03: Error tracking captures production issues (Sentry)
- INFRA-04: Logs are structured and searchable
