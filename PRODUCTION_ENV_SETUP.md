# Production Environment Setup Guide

This guide provides step-by-step instructions for configuring all three sites for production deployment.

## Prerequisites

- Supabase project created
- Stripe account created (with live keys)
- Email provider account (Resend/SendGrid/Mailgun)
- Domain names configured
- Vercel account (or hosting provider)

---

## 1. Supabase Configuration

### 1.1 Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create new project
3. Note your project URL and anon key

### 1.2 Configure CORS Origins

1. Go to **Settings** → **API**
2. Add to **Allowed CORS origins**:
   ```
   https://yourclub.com
   https://tickets.yourclub.com
   https://scanner.yourclub.com
   http://localhost:5173
   ```

### 1.3 Configure OAuth Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add **Redirect URLs**:
   ```
   https://yourclub.com/auth/callback
   https://tickets.yourclub.com/auth/callback
   https://scanner.yourclub.com/auth/callback
   ```

### 1.4 Run Database Migrations

Execute migrations in order:

**maguey-pass-lounge migrations:**
1. `20250115000000_create_ticket_system.sql`
2. `20250115000001_add_event_image_to_tickets.sql`
3. `20250115000002_seed_events.sql` (remove test data)
4. `20250201000000_add_rls_policies.sql`
5. `20250201001000_create_promotions_table.sql`
6. `20250301090000_update_tickets_add_security_columns.sql`
7. `20250302000000_add_ticket_categories.sql`
8. `20250302000001_update_scanner_view_categories.sql`
9. `20250303000000_add_event_status.sql`
10. `20250303000001_add_promo_code_tracking.sql`
11. `20250303000002_create_user_loyalty.sql`
12. `20250320000000_auth_enhancements.sql`
13. `20250322000000_organizer_reservations.sql`

**maguey-gate-scanner migrations:**
1. `20250115000000_ticket_system_integration.sql`
2. `20250116000000_add_scanner_columns.sql`
3. `20250116000001_add_event_artist_metadata.sql`
4. `20250117000000_add_ticket_tiers.sql`
5. `20250118000000_create_sync_status.sql`
6. `20250118000000_add_emergency_override.sql`
7. `20250119000000_add_id_verification.sql`
8. `20250120000000_add_scan_speed_metrics.sql`
9. `20250121000000_add_battery_monitoring.sql`
10. `20250122000000_add_nfc_support.sql`
11. `20250123000000_add_photo_capture.sql`
12. `20250125000000_add_fraud_detection.sql`
13. `20250126000000_add_predictive_queue_management.sql`
14. `20250127000000_add_door_counter_integration.sql`
15. `20250127000000_add_notification_system.sql`
16. `20250127000000_add_white_label_branding.sql`
17. `20250128000000_add_audit_logs.sql`
18. `20250128000000_add_sms_tracking.sql`
19. `20250128000001_add_security_tables.sql`
20. `20250128000002_add_staff_shifts.sql`
21. `20250128000003_add_waitlist.sql`
22. `20250129000000_add_push_notifications.sql`
23. `20250129000001_add_shift_clock_fields.sql`
24. `20250129000002_add_email_templates.sql`
25. `20250129000003_add_notification_preferences.sql`
26. `20250201000000_add_site_management.sql`
27. `20250202000000_insert_template_events.sql`
28. `20250203000000_add_event_status_and_rich_fields.sql`
29. `20250203000001_fix_event_availability_function.sql`
30. `20250204000000_performance_optimizations.sql`
31. `20250204000001_optimize_rls_policies.sql`
32. `20250204000002_fix_rls_permissions.sql`
33. `fix_rls_for_events.sql`
34. `20251030040502_d39e686b-4ced-498f-a6df-2b42802986f7.sql`

### 1.5 Create Initial Admin Account

```sql
-- Create admin user (replace with your email)
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  'admin@yourclub.com',
  crypt('your-secure-password', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- Grant admin role (if you have a roles table)
-- Or use Supabase Dashboard → Authentication → Users → Set role
```

---

## 2. Environment Variables

### 2.1 maguey-nights (Marketing Site)

Create `.env` file:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Purchase Site URL
VITE_PURCHASE_SITE_URL=https://tickets.yourclub.com

# App Configuration
VITE_APP_NAME=Maguey Club
VITE_APP_URL=https://yourclub.com
```

### 2.2 maguey-pass-lounge (Purchase Site)

Create `.env` file:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Stripe (Live Keys)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...  # Server-side only (Edge Functions)

# API Configuration
VITE_API_URL=https://your-project.supabase.co/functions/v1

# Email Service (Choose one)
# Option 1: Resend (Recommended)
VITE_EMAIL_PROVIDER=resend
VITE_EMAIL_API_KEY=re_...
VITE_EMAIL_FROM_ADDRESS=noreply@yourclub.com

# Option 2: SendGrid
# VITE_EMAIL_PROVIDER=sendgrid
# VITE_EMAIL_API_KEY=SG....
# VITE_EMAIL_FROM_ADDRESS=noreply@yourclub.com

# Option 3: Mailgun
# VITE_EMAIL_PROVIDER=mailgun
# VITE_EMAIL_API_KEY=key-...
# VITE_EMAIL_DOMAIN=mg.yourclub.com
# VITE_EMAIL_FROM_ADDRESS=noreply@yourclub.com

# QR Code Signing
VITE_QR_SIGNING_SECRET=your-random-secret-key-here

# Frontend URL
VITE_FRONTEND_URL=https://tickets.yourclub.com
VITE_APP_BASE_PATH=/
```

**Generate QR Signing Secret:**
```bash
openssl rand -hex 32
```

### 2.3 maguey-gate-scanner (Admin/Scanner Site)

Create `.env` file:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only

# QR Code Signing (same as purchase site)
VITE_QR_SIGNING_SECRET=your-random-secret-key-here

# Twilio (SMS notifications)
VITE_TWILIO_ACCOUNT_SID=your-twilio-account-sid
VITE_TWILIO_AUTH_TOKEN=your-twilio-auth-token
VITE_TWILIO_PHONE_NUMBER=+1234567890

# SendGrid (Email notifications)
VITE_SENDGRID_API_KEY=your-sendgrid-api-key
VITE_SENDGRID_FROM_EMAIL=noreply@yourclub.com

# App Configuration
VITE_APP_NAME=Maguey Scanner
VITE_APP_URL=https://scanner.yourclub.com
```

---

## 3. Vercel Configuration

### 3.1 Deploy maguey-nights

1. Connect repository to Vercel
2. Set root directory: `maguey-nights`
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Add environment variables (from section 2.1)

### 3.2 Deploy maguey-pass-lounge

1. Connect repository to Vercel
2. Set root directory: `maguey-pass-lounge`
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Add environment variables (from section 2.2)
6. Configure `vercel.json` rewrites if needed

### 3.3 Deploy maguey-gate-scanner

1. Connect repository to Vercel
2. Set root directory: `maguey-gate-scanner`
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Add environment variables (from section 2.3)

---

## 4. Stripe Configuration

### 4.1 Get Live Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Switch to **Live mode**
3. Go to **Developers** → **API keys**
4. Copy **Publishable key** and **Secret key**

### 4.2 Configure Webhook

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set endpoint URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy **Signing secret**

### 4.3 Set Webhook Secret in Supabase

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 5. Email Provider Setup

### 5.1 Resend (Recommended)

1. Sign up at [Resend](https://resend.com)
2. Verify your domain
3. Get API key from dashboard
4. Add to environment variables

### 5.2 SendGrid

1. Sign up at [SendGrid](https://sendgrid.com)
2. Verify sender email/domain
3. Create API key
4. Add to environment variables

### 5.3 Mailgun

1. Sign up at [Mailgun](https://mailgun.com)
2. Verify domain
3. Get API key
4. Add to environment variables

---

## 6. Domain Configuration

### 6.1 DNS Setup

For each domain, add CNAME records pointing to Vercel:

**yourclub.com:**
```
Type: CNAME
Name: @
Value: cname.vercel-dns.com
```

**tickets.yourclub.com:**
```
Type: CNAME
Name: tickets
Value: cname.vercel-dns.com
```

**scanner.yourclub.com:**
```
Type: CNAME
Name: scanner
Value: cname.vercel-dns.com
```

### 6.2 SSL Certificates

Vercel automatically provisions SSL certificates. Ensure:
- DNS records are configured
- Domains are verified in Vercel
- SSL is enabled in project settings

---

## 7. Supabase Edge Functions

### 7.1 Deploy Edge Functions

```bash
cd maguey-pass-lounge
supabase functions deploy stripe-webhook
supabase functions deploy check-availability

cd ../maguey-gate-scanner
supabase functions deploy event-availability
supabase functions deploy ticket-webhook
supabase functions deploy order-tickets
supabase functions deploy unified-capacity
supabase functions deploy door-counter-ingest
```

### 7.2 Set Edge Function Secrets

```bash
# Stripe webhook secret
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Email service (if using in edge functions)
supabase secrets set EMAIL_API_KEY=your-email-api-key
supabase secrets set EMAIL_FROM_ADDRESS=noreply@yourclub.com

# QR signing secret
supabase secrets set QR_SIGNING_SECRET=your-qr-secret
```

---

## 8. Monitoring Setup

### 8.1 Sentry (Error Tracking)

1. Sign up at [Sentry](https://sentry.io)
2. Create project for each site
3. Get DSN for each project
4. Add to environment variables:
   ```env
   VITE_SENTRY_DSN=https://...@sentry.io/...
   ```

### 8.2 Uptime Monitoring

1. Sign up at [UptimeRobot](https://uptimerobot.com) or [Pingdom](https://pingdom.com)
2. Add monitors for:
   - `https://yourclub.com`
   - `https://tickets.yourclub.com`
   - `https://scanner.yourclub.com`
3. Set alert contacts

### 8.3 Log Aggregation

Supabase provides built-in logs:
1. Go to **Logs** → **Edge Functions**
2. View function logs
3. Set up alerts for errors

For advanced logging, consider:
- [Logflare](https://logflare.app) (Supabase integration)
- [Datadog](https://datadoghq.com)
- [New Relic](https://newrelic.com)

---

## 9. Verification Checklist

After setup, verify:

- [ ] All three sites load correctly
- [ ] Environment variables are set
- [ ] Database migrations completed
- [ ] CORS origins configured
- [ ] OAuth redirect URLs configured
- [ ] Stripe webhook configured
- [ ] Email service working
- [ ] SSL certificates active
- [ ] Monitoring configured
- [ ] Admin account created

---

## 10. Post-Deployment Testing

### 10.1 Test Purchase Flow

1. Go to `https://tickets.yourclub.com`
2. Select an event
3. Choose tickets
4. Complete checkout
5. Verify payment processes
6. Verify email received
7. Verify ticket appears in scanner

### 10.2 Test Scanner Flow

1. Go to `https://scanner.yourclub.com`
2. Scan a ticket QR code
3. Verify ticket details display
4. Check in ticket
5. Verify status updates

### 10.3 Test Marketing Site

1. Go to `https://yourclub.com`
2. Verify events display
3. Click "Buy Tickets" links
4. Verify navigation to purchase site

---

## Troubleshooting

### Environment Variables Not Loading

- Verify variables are set in Vercel dashboard
- Restart deployment after adding variables
- Check variable names match exactly (case-sensitive)

### CORS Errors

- Verify CORS origins in Supabase Dashboard
- Check domain matches exactly
- Clear browser cache

### Webhook Not Working

- Verify webhook URL is correct
- Check webhook secret matches
- View webhook logs in Stripe Dashboard
- Check Supabase Edge Function logs

### Email Not Sending

- Verify email provider API key
- Check sender email is verified
- View email provider logs
- Check spam folder

---

## Support

For issues:
1. Check Supabase logs
2. Check Vercel deployment logs
3. Check error tracking (Sentry)
4. Review this guide
5. Contact support if needed
