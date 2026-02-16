# Production Environment Audit

> **Purpose:** Validate all secrets and configuration before launch
> **Audit Date:** _______________
> **Audited By:** _______________

This checklist ensures all required environment variables are configured and validated before going to production. Complete each section and mark checkboxes as verified.

---

## 1. Supabase Edge Functions (Backend Secrets)

These secrets must be configured in **Supabase Dashboard > Project Settings > Edge Functions > Secrets**.

### Core Infrastructure

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| SUPABASE_URL | Database and API connection URL | Yes | [ ] | [ ] |
| SUPABASE_SERVICE_ROLE_KEY | Service role access for admin operations | Yes | [ ] | [ ] |
| ENVIRONMENT | Environment identifier (production/staging) | Yes | [ ] | [ ] |

### Payment Processing (Stripe)

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| STRIPE_SECRET_KEY | Stripe API secret for payment processing | Yes | [ ] | [ ] |
| STRIPE_WEBHOOK_SECRET | Webhook signature verification (checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed) | Yes | [ ] | [ ] |

### Email Service (Resend)

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| RESEND_API_KEY | Resend API key for sending emails | Yes | [ ] | [ ] |
| RESEND_WEBHOOK_SECRET | Resend webhook signature verification (email.delivered, email.bounced, email.complained) | Yes | [ ] | [ ] |
| EMAIL_FROM_ADDRESS | Sender email address (e.g., tickets@maguey.club) | Yes | [ ] | [ ] |

### QR Code Security

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| QR_SIGNING_SECRET | HMAC secret for QR code signing/verification | Yes | [ ] | [ ] |

### Notifications

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| OWNER_EMAIL | Email address for payment failure notifications | Yes | [ ] | [ ] |
| FRONTEND_URL | Frontend base URL for email links | Yes | [ ] | [ ] |

### Rate Limiting (Upstash)

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| UPSTASH_REDIS_REST_URL | Upstash Redis REST endpoint for rate limiting | Recommended | [ ] | [ ] |
| UPSTASH_REDIS_REST_TOKEN | Upstash Redis authentication token | Recommended | [ ] | [ ] |

### Error Tracking (Sentry)

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| SENTRY_DSN | Sentry Data Source Name for error tracking | Recommended | [ ] | [ ] |

### CORS Configuration

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| ALLOWED_ORIGINS | Comma-separated list of allowed CORS origins | Yes | [ ] | [ ] |

### Legacy/Alternative Services (Optional)

These may be present from development but are not required for production if using primary services above.

| Variable | Purpose | Status |
|----------|---------|--------|
| EMAIL_API_KEY | Alternative email service API key | Optional |
| EMAIL_FROM | Alternative email from address | Optional |
| EMAIL_SERVICE | Email service selector | Optional |
| MAILGUN_DOMAIN | Mailgun domain (if using Mailgun) | Optional |
| MESSAGEBIRD_API_KEY | MessageBird SMS (if using) | Optional |
| SMS_SERVICE | SMS service selector | Optional |
| TWILIO_ACCOUNT_SID | Twilio account (if using SMS) | Optional |
| TWILIO_AUTH_TOKEN | Twilio auth token | Optional |
| TWILIO_PHONE_NUMBER | Twilio phone number | Optional |

---

## 2. Frontend Environment: maguey-pass-lounge

These variables are set in the frontend deployment environment (e.g., Vercel environment variables).

### Core Configuration

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| VITE_SUPABASE_URL | Supabase project URL | Yes | [ ] | [ ] |
| VITE_SUPABASE_ANON_KEY | Supabase anonymous key for public access | Yes | [ ] | [ ] |
| VITE_STRIPE_PUBLISHABLE_KEY | Stripe publishable key for client-side payment UI | Yes | [ ] | [ ] |
| VITE_FRONTEND_URL | Frontend base URL for redirects | Yes | [ ] | [ ] |

### Scanner Integration

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| VITE_SCANNER_API_URL | Scanner app API endpoint | Yes | [ ] | [ ] |
| VITE_QR_SIGNING_SECRET | QR code verification secret (must match backend) | Yes | [ ] | [ ] |

### Monitoring & Tracking

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| VITE_SENTRY_DSN | Sentry error tracking for frontend | Recommended | [ ] | [ ] |
| VITE_GA_MEASUREMENT_ID | Google Analytics measurement ID | Optional | [ ] | [ ] |
| VITE_LOG_LEVEL | Logging verbosity level | Optional | [ ] | [ ] |
| VITE_APP_VERSION | Application version for tracking | Optional | [ ] | [ ] |

### Alerting (Optional)

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| VITE_ALERT_WEBHOOK_URL | Alert webhook endpoint | Optional | [ ] | [ ] |
| VITE_SLACK_WEBHOOK_URL | Slack notification webhook | Optional | [ ] | [ ] |

---

## 3. Frontend Environment: maguey-gate-scanner

### Core Configuration

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| VITE_SUPABASE_URL | Supabase project URL | Yes | [ ] | [ ] |
| VITE_SUPABASE_ANON_KEY | Supabase anonymous key | Yes | [ ] | [ ] |
| VITE_PURCHASE_SITE_URL | Link to ticket purchase site | Yes | [ ] | [ ] |

### QR Verification

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| VITE_QR_SIGNING_SECRET | QR code verification secret (must match backend and pass-lounge) | Yes | [ ] | [ ] |

### Monitoring

| Variable | Purpose | Required | Configured | Validated |
|----------|---------|:--------:|:----------:|:---------:|
| VITE_SENTRY_DSN | Sentry error tracking for scanner | Recommended | [ ] | [ ] |
| VITE_LOG_LEVEL | Logging verbosity level | Optional | [ ] | [ ] |
| VITE_APP_VERSION | Application version | Optional | [ ] | [ ] |

### Alert Templates (SendGrid - Optional)

If using SendGrid for scanner alerts:

| Variable | Purpose | Required |
|----------|---------|----------|
| VITE_SENDGRID_API_KEY | SendGrid API key | Optional |
| VITE_SENDGRID_FROM_EMAIL | SendGrid sender email | Optional |
| VITE_SENDGRID_FROM_NAME | SendGrid sender name | Optional |
| VITE_SENDGRID_TEMPLATE_BATTERY_LOW | Battery alert template ID | Optional |
| VITE_SENDGRID_TEMPLATE_CAPACITY | Capacity alert template ID | Optional |
| VITE_SENDGRID_TEMPLATE_EMERGENCY | Emergency alert template ID | Optional |
| VITE_SENDGRID_TEMPLATE_FRAUD | Fraud alert template ID | Optional |
| VITE_SENDGRID_TEMPLATE_OFFLINE | Offline alert template ID | Optional |
| VITE_SENDGRID_TEMPLATE_VIP | VIP alert template ID | Optional |

---

## 4. Validation Procedure

### Step 1: Backend Secrets Verification

1. Log into **Supabase Dashboard**
2. Navigate to **Project Settings > Edge Functions > Secrets**
3. For each required secret in Section 1:
   - Verify the secret exists
   - Verify the value is non-empty
   - Mark **Configured** checkbox

### Step 2: Health Check Validation

Run the health check endpoint to validate backend dependencies:

```bash
curl -X POST https://[project-ref].supabase.co/functions/v1/health-check \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "database": "healthy",
    "stripe": "healthy",
    "resend": "healthy",
    "upstash": "healthy" | "not_configured",
    "sentry": "healthy" | "not_configured"
  }
}
```

- [ ] Health check returns 200 status
- [ ] Database check is "healthy"
- [ ] Stripe check is "healthy"
- [ ] Resend check is "healthy"

### Step 3: Frontend Environment Verification

For each frontend deployment (Vercel/Netlify):

1. Navigate to deployment platform dashboard
2. Go to project settings > environment variables
3. For each required variable in Sections 2-3:
   - Verify the variable exists
   - Verify the value is set for production environment
   - Mark **Configured** checkbox

### Step 4: QR Secret Consistency Check

**Critical:** The QR_SIGNING_SECRET must be identical across:
- Backend: `QR_SIGNING_SECRET` in Supabase Edge Functions
- Pass Lounge: `VITE_QR_SIGNING_SECRET` in frontend
- Gate Scanner: `VITE_QR_SIGNING_SECRET` in frontend

- [ ] All three QR signing secrets match

### Step 5: Mark Validated

After completing validation:
- [ ] Re-test a ticket purchase flow end-to-end
- [ ] Verify email delivery
- [ ] Test scanner QR code verification
- [ ] Mark all **Validated** checkboxes

---

## 5. External Service Configuration

| Service | Configuration Item | Location | Verified |
|---------|-------------------|----------|:--------:|
| **Stripe** | Webhook endpoint URL | Stripe Dashboard > Developers > Webhooks | [ ] |
| **Stripe** | Webhook events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed` | Stripe Dashboard > Developers > Webhooks | [ ] |
| **Stripe** | Production API keys (not test keys) | Stripe Dashboard > Developers > API keys | [ ] |
| **Resend** | Webhook endpoint URL | Resend Dashboard > Webhooks | [ ] |
| **Resend** | Webhook events: `email.delivered`, `email.bounced`, `email.complained` | Resend Dashboard > Webhooks | [ ] |
| **Resend** | Domain verified | Resend Dashboard > Domains | [ ] |
| **Supabase** | pg_cron job for email queue processor | Supabase Dashboard > Database > Extensions > pg_cron | [ ] |
| **Upstash** | Redis database created | Upstash Console | [ ] |
| **Sentry** | Project DSN configured | Sentry Dashboard > Project Settings | [ ] |
| **Vercel** | Production environment variables set | Vercel Dashboard > Project Settings | [ ] |

---

## 6. Security Notes

### Secret Rotation

- **Never commit secrets to git** - All secrets should be in environment variables only
- **Rotate immediately if exposed:**
  - STRIPE_WEBHOOK_SECRET - Regenerate in Stripe Dashboard
  - STRIPE_SECRET_KEY - Regenerate and update all deployments
  - QR_SIGNING_SECRET - Regenerate and update backend + both frontends simultaneously
  - SUPABASE_SERVICE_ROLE_KEY - Regenerate in Supabase Dashboard

### Critical Consistency Requirements

1. **QR_SIGNING_SECRET** must be identical across:
   - Supabase Edge Functions secrets
   - maguey-pass-lounge VITE_QR_SIGNING_SECRET
   - maguey-gate-scanner VITE_QR_SIGNING_SECRET

2. **ALLOWED_ORIGINS** must include all production domains

3. **OWNER_EMAIL** must be a valid, monitored email address

### Webhook Security

- Stripe webhooks use signature verification via `STRIPE_WEBHOOK_SECRET`
- Resend webhooks use Svix signature verification via `RESEND_WEBHOOK_SECRET`
- Both should use HTTPS endpoints only in production

### Rate Limiting Fallback

- If Upstash is unavailable, the system operates in "fail-open" mode
- Rate limiting is recommended but not required for launch
- Monitor for abuse if launching without rate limiting

---

## 7. Pre-Launch Checklist Summary

| Category | Total | Configured | Validated |
|----------|:-----:|:----------:|:---------:|
| Backend Secrets (Required) | 13 | __/13 | __/13 |
| Backend Secrets (Recommended) | 3 | __/3 | __/3 |
| Pass Lounge Frontend (Required) | 6 | __/6 | __/6 |
| Pass Lounge Frontend (Recommended) | 4 | __/4 | __/4 |
| Gate Scanner Frontend (Required) | 4 | __/4 | __/4 |
| Gate Scanner Frontend (Recommended) | 3 | __/3 | __/3 |
| External Services | 10 | __/10 | __/10 |

**Minimum for Launch:** All "Required" items must be Configured and Validated.

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Venue Owner | | | |

**Launch Approval:** [ ] All required environment variables configured and validated
