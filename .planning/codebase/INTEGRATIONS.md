# External Integrations

**Analysis Date:** 2026-01-29

## APIs & External Services

**Payment Processing:**
- Stripe - Payment processing for ticket and VIP table purchases
  - SDK/Client: `@stripe/stripe-js`, `@stripe/react-stripe-js`, `stripe`
  - API Key: `VITE_STRIPE_PUBLISHABLE_KEY` (frontend), `STRIPE_SECRET_KEY` (backend env)
  - Webhook Secret: `STRIPE_WEBHOOK_SECRET` (backend env)
  - Implementation: `src/lib/stripe.ts` (pass-lounge, nights)
  - Edge Functions: `supabase/functions/create-checkout-session/index.ts`, `supabase/functions/create-vip-payment-intent/index.ts`, `supabase/functions/stripe-webhook/index.ts`
  - Features: Checkout sessions, payment intents, VIP table payments, webhook signature verification

**Email Services:**
- Resend - Transactional email service
  - SDK/Client: `resend`
  - API Key: `VITE_EMAIL_API_KEY` or `RESEND_API_KEY`
  - From Address: `VITE_EMAIL_FROM_ADDRESS` or `EMAIL_FROM_ADDRESS`
  - Implementation: `supabase/functions/stripe-webhook/index.ts` (email sending via Deno environment)
  - Use Case: Ticket confirmations, VIP reservation confirmations

- SendGrid - Alternative email service (gate-scanner)
  - SDK/Client: `@sendgrid/mail`
  - API Key: `VITE_EMAIL_API_KEY`
  - Implementation: `src/lib/notification-service.ts`
  - Use Case: Notifications, alerts

**Analytics:**
- Google Analytics 4 - Web analytics and user tracking
  - Measurement ID: `VITE_GA_MEASUREMENT_ID`
  - SDK: `react-ga4`
  - Implementation: `src/components/GoogleAnalytics.tsx` (pass-lounge, nights)
  - Tracking: Page views, custom events
  - Used in: maguey-pass-lounge, maguey-nights

**Communications:**
- Twilio - SMS and voice communications
  - SDK: `twilio`
  - Implementation: `src/lib/notification-service.ts` (gate-scanner)
  - Use Case: SMS notifications, alert delivery

## Data Storage

**Databases:**
- PostgreSQL via Supabase (cloud database)
  - Connection: `VITE_SUPABASE_URL`
  - Auth Key: `VITE_SUPABASE_ANON_KEY` (frontend), `SUPABASE_SERVICE_ROLE_KEY` (backend)
  - Client: `@supabase/supabase-js`
  - Location: `src/lib/supabase.ts` (initialization across all projects)
  - Tables: `events`, `orders`, `tickets`, `ticket_types`, `vip_reservations`, `event_vip_tables`, `vip_guest_passes`, `newsletter_subscribers`, etc.
  - RPC Functions: `check_and_reserve_tickets`, `release_reserved_tickets`, `reserve_tickets_batch`, `create_order_with_tickets_atomic`

**File Storage:**
- Supabase Storage - Cloud file storage
  - Buckets: `event_images`, `qr_codes`, `flyers`
  - Access: Via Supabase client authenticated requests

**Client-Side Database:**
- IndexedDB via Dexie (gate-scanner)
  - Library: `dexie`
  - Purpose: Offline data storage and local caching
  - Implementation: `src/lib/notification-service.ts`

**Caching:**
- React Query (@tanstack/react-query) - Server state synchronization and caching
  - Configuration: Default cache strategies for ticket availability, events, orders
  - Implementation: Throughout pass-lounge components

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built into Supabase)
  - Method: Session-based authentication with JWT tokens
  - Implementation: Via `@supabase/supabase-js` client
  - Context: `src/contexts/AuthContext.tsx` (pass-lounge)
  - Features: Email/password auth, session management, user profiles

**QR Code Security:**
- HMAC-SHA256 Signing for QR codes
  - Secret: `VITE_QR_SIGNING_SECRET`
  - Implementation: Signature generation in Stripe webhook, verification in scanner
  - Location: `supabase/functions/stripe-webhook/index.ts`, `maguey-gate-scanner` scanner logic
  - Purpose: Prevent QR code tampering and ensure ticket authenticity

## Monitoring & Observability

**Error Tracking:**
- Sentry - Error tracking and performance monitoring
  - DSN: `VITE_SENTRY_DSN`
  - SDK: `@sentry/react`
  - Implementation: `src/lib/sentry.ts` (pass-lounge)
  - Features: Error capture, breadcrumbs, performance monitoring, session replay (optional)
  - Configuration: 10% trace rate in production, 100% in development

**Logs:**
- Console logging + Sentry integration
- Supabase Edge Function logs (via Deno console)
- Implementation: `src/lib/logger.ts` patterns throughout codebase

**Metrics:**
- Custom metrics tracking via `src/lib/monitoring.ts`
- Stripe circuit breaker metrics tracking payment service health
- Google Analytics for user behavior metrics

## CI/CD & Deployment

**Hosting:**
- Supabase (backend + Edge Functions + PostgreSQL + Auth)
  - Service Role Key: `SUPABASE_SERVICE_ROLE_KEY` (admin operations)
  - URL: https://djbzjasdrwvbsoifxqzd.supabase.co (example from .env)

- Frontend deployment (Vercel, Netlify, or self-hosted)
  - Port: 3016 (default dev port via Vite)
  - Base path: Configurable via `VITE_APP_BASE_PATH`
  - Frontend URL: `VITE_FRONTEND_URL` (for redirects and callbacks)

**CI Pipeline:**
- GitHub Actions (implicit from presence of Edge Functions and Supabase integration)
- Supabase CLI for function deployment and database migrations
- Functions location: `supabase/functions/*/index.ts`

## Environment Configuration

**Required env vars (Frontend/Vite):**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `VITE_QR_SIGNING_SECRET` - HMAC secret for QR code signing
- `VITE_EMAIL_API_KEY` - Email provider API key
- `VITE_EMAIL_FROM_ADDRESS` - Email sender address
- `VITE_GA_MEASUREMENT_ID` - Google Analytics ID (optional)
- `VITE_SENTRY_DSN` - Sentry DSN (optional)
- `VITE_APP_URL` - Application base URL

**Required env vars (Backend/Edge Functions - Deno):**
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `SUPABASE_URL` - Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key
- `RESEND_API_KEY` - Resend email API key
- `EMAIL_FROM_ADDRESS` - Email sender address
- `FRONTEND_URL` - Frontend URL for redirects

**Secrets location:**
- `.env` files in each project root (development)
- Supabase project secrets (production via Edge Functions)
- GitHub Secrets (for CI/CD)

## Webhooks & Callbacks

**Incoming (Stripe Webhooks):**
- Endpoint: `supabase/functions/v1/stripe-webhook`
- Events handled:
  - `checkout.session.completed` - Order payment confirmation
  - `payment_intent.succeeded` - VIP table payment confirmation
  - `payment_intent.payment_failed` - Payment failure handling
  - `charge.refunded` - Refund processing
- Signature verification: HMAC-SHA256 using `STRIPE_WEBHOOK_SECRET`
- Implementation: `supabase/functions/stripe-webhook/index.ts`

**Outgoing (To Supabase):**
- Function invocation via `supabase.functions.invoke()`
- Newsletter confirmation: `newsletter-welcome` function
- Implementation: `src/hooks/useNewsletter.ts`

**Outgoing (Email Callbacks):**
- Resend email service sends transactional emails on successful payments
- No callback needed - fire-and-forget pattern with error logging

## Security & Auth Flow

**Payment Flow:**
1. Frontend creates checkout session via Edge Function
2. Stripe processes payment
3. Webhook received at `stripe-webhook` function
4. QR codes signed with HMAC
5. Ticket emails sent via Resend
6. Confirmation saved to Supabase

**VIP Reservation Flow:**
1. Frontend creates VIP payment intent via Edge Function
2. Stripe Elements embedded form collects payment
3. Webhook confirms payment and creates reservation
4. Guest passes generated with QR codes
5. Confirmation email with guest passes sent
6. Status updated in `vip_reservations` table

**Scanner Authentication:**
1. QR code token + signature verified by scanner
2. Signature verification against `VITE_QR_SIGNING_SECRET`
3. Ticket status checked in Supabase
4. Attendance recorded in database

---

*Integration audit: 2026-01-29*
