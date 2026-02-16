# 06-05: Email Alert Digest System - Summary

**Completed:** 2026-01-31
**Duration:** ~3 min

## Objective

Create email alert system for critical errors with aggregation to prevent alert fatigue.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Create alert_digest table and aggregation function | Complete |
| 2 | Create send-error-digest edge function | Complete |
| 3 | Document pg_cron setup (manual step) | Complete |

## Deliverables

### Files Created

| File | Purpose |
|------|---------|
| `maguey-pass-lounge/supabase/migrations/20260131000000_alert_digest_system.sql` | Database schema for error aggregation |
| `maguey-pass-lounge/supabase/functions/send-error-digest/index.ts` | Edge function to send digest emails |

### Commits

- `e2a026d`: feat(06-05): create alert_digest table and aggregate_error function
- `1520fd1`: feat(06-05): create send-error-digest edge function

## Implementation Details

### Alert Digest Table Schema

```sql
CREATE TABLE alert_digest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type VARCHAR(100) NOT NULL,
  error_hash VARCHAR(64) NOT NULL,
  first_occurrence TIMESTAMPTZ DEFAULT NOW(),
  last_occurrence TIMESTAMPTZ DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,
  sample_error JSONB NOT NULL,
  notified_at TIMESTAMPTZ,
  digest_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(error_hash, digest_date)
);
```

### Aggregation Function

```sql
SELECT aggregate_error(
  'payment_failed',
  'Stripe API timeout',
  '{"paymentIntentId": "pi_123", "customerId": "cus_456"}'::jsonb
);
```

- UPSERT pattern: increments `occurrence_count` if same error_hash + date
- Stores sample error for context in email

### Email Digest Format

- Subject: `[Alert] 5 errors in the last 15 minutes`
- Body: HTML table with error type, count, sample message, last seen
- Sent to `OWNER_EMAIL` via Resend API

### Alert Flow

1. Errors are captured by Sentry and logged
2. Critical errors call `aggregate_error()` to record
3. pg_cron triggers `send-error-digest` every 15 minutes
4. Digest function queries unnotified errors
5. Sends consolidated email to owner
6. Marks errors as `notified_at = NOW()`

## User Setup Required

### 1. Apply Migration

```bash
cd maguey-pass-lounge && supabase db push --include-all
```

### 2. Configure Environment Variables

In Supabase Dashboard > Edge Functions > Secrets:
- `OWNER_EMAIL`: Owner's email address for alerts

### 3. Configure pg_cron Job

In Supabase Dashboard > SQL Editor:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Store secrets in vault
INSERT INTO vault.secrets (name, secret)
VALUES
  ('project_url', 'https://[PROJECT_REF].supabase.co'),
  ('service_role_key', '[SERVICE_ROLE_KEY]');

-- Schedule digest every 15 minutes
SELECT cron.schedule(
  'send-error-digest',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/send-error-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### 4. Deploy Edge Function

```bash
cd maguey-pass-lounge && supabase functions deploy send-error-digest
```

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Error hash grouping | Prevents duplicate alerts for same error |
| 15-minute digest interval | Balances alerting speed vs. noise |
| Daily reset (digest_date) | Fresh aggregation each day |
| HTML email format | Better readability for owner |

## Success Criteria Met

- [x] Critical errors trigger alerts via email
- [x] Errors are aggregated (no spam)
- [x] Owner receives consolidated digest
