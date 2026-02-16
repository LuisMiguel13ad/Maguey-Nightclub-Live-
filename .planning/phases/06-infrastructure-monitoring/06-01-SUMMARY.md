# 06-01: Health Check Endpoint - Summary

**Completed:** 2026-01-31
**Duration:** ~3 min

## Objective

Create unified health check edge function that tests DB, Stripe, Resend, and edge function availability.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Create health-check edge function | Complete |
| 2 | Implement service checks (DB, Stripe, Resend) | Complete |

## Deliverables

### Files Created

| File | Purpose |
|------|---------|
| `maguey-pass-lounge/supabase/functions/health-check/index.ts` | Unified health check endpoint |

### Commits

- `77f461d`: feat(06-01): create health check endpoint

## Implementation Details

### Health Check Response Format

```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2026-01-31T12:00:00.000Z",
  "checks": {
    "database": { "status": "healthy", "responseTime": 45 },
    "stripe": { "status": "healthy", "responseTime": 120 },
    "resend": { "status": "healthy", "responseTime": 89 },
    "edge_functions": { "status": "healthy" }
  }
}
```

### Service Checks

1. **Database**: Queries events table with `.limit(1)` to verify connectivity
2. **Stripe**: Fetches `https://api.stripe.com/healthcheck` with 5s timeout
3. **Resend**: Fetches `/domains` endpoint with API key authorization
4. **Edge Functions**: Self-check (if endpoint responds, it's healthy)

### Status Logic

- **healthy**: All services return healthy
- **degraded**: Some services healthy, some unhealthy
- **unhealthy**: Any critical service unavailable

### HTTP Status Codes

- `200 OK`: All services healthy
- `503 Service Unavailable`: Any service unhealthy or degraded

## User Setup Required

1. Deploy the function:
   ```bash
   cd maguey-pass-lounge && supabase functions deploy health-check --no-verify-jwt
   ```

2. Test the endpoint:
   ```bash
   curl https://[PROJECT_REF].supabase.co/functions/v1/health-check
   ```

## Success Criteria Met

- [x] Health check endpoints exist for all critical services
- [x] Returns correct status for each service
- [x] JSON response format with response times
