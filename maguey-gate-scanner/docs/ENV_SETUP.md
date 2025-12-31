# Environment Variables Setup Guide

## Overview

This document describes all environment variables needed for the three-site ticket system. Each site has different requirements based on its functionality.

## Scanner Site (Admin)

**Location**: `.env` or `.env.local`

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here

# QR Code Signing (for secure QR codes)
VITE_QR_SIGNING_SECRET=your-random-secret-key-here

# Twilio (SMS notifications for staff)
VITE_TWILIO_ACCOUNT_SID=your-twilio-account-sid
VITE_TWILIO_AUTH_TOKEN=your-twilio-auth-token
VITE_TWILIO_PHONE_NUMBER=+1234567890

# SendGrid (Email notifications)
VITE_SENDGRID_API_KEY=your-sendgrid-api-key
VITE_SENDGRID_FROM_EMAIL=noreply@yourclub.com

# Optional: Notification Templates
VITE_SENDGRID_TEMPLATE_CAPACITY=your-template-id
VITE_SENDGRID_TEMPLATE_FRAUD=your-template-id
VITE_SENDGRID_TEMPLATE_OFFLINE=your-template-id

# App Configuration
VITE_APP_NAME=Maguey Scanner
VITE_APP_URL=https://scanner.yourclub.com
```

## Main Website (Marketing)

**Location**: `.env` or `.env.local`

```env
# Supabase Configuration (same project as Scanner Site)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Purchase Site URL (for "Buy Tickets" links)
VITE_PURCHASE_SITE_URL=https://tickets.yourclub.com

# App Configuration
VITE_APP_NAME=Maguey Club
VITE_APP_URL=https://yourclub.com
```

**Note**: Main Website only needs Supabase read access. The anon key is safe to use client-side because RLS policies protect your data.

## Purchase Website (Sales)

**Location**: `.env` or `.env.local` (client-side) and `.env` (server-side)

### Client-Side Variables

```env
# Supabase Configuration (same project as Scanner Site)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Stripe (client-side)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...  # or pk_live_... for production

# Purchase Site URL
VITE_PURCHASE_SITE_URL=https://tickets.yourclub.com

# App Configuration
VITE_APP_NAME=Maguey Tickets
VITE_APP_URL=https://tickets.yourclub.com
```

### Server-Side Variables (API Routes / Edge Functions)

```env
# Stripe (server-side only - NEVER expose client-side!)
STRIPE_SECRET_KEY=sk_test_...  # or sk_live_... for production
STRIPE_WEBHOOK_SECRET=whsec_...

# Email Service (choose one)
# Option 1: SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=tickets@yourclub.com

# Option 2: Resend
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=tickets@yourclub.com

# Supabase (for server-side operations)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only!
```

**⚠️ WARNING**: Never expose `STRIPE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` client-side!

## Supabase Edge Functions

If you're using Supabase Edge Functions, set these in Supabase Dashboard → Settings → Edge Functions:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email Service
SENDGRID_API_KEY=your-key
# OR
RESEND_API_KEY=your-key

# Purchase Site URL (for redirects)
PURCHASE_SITE_URL=https://tickets.yourclub.com

# Frontend URL (for CORS)
FRONTEND_URL=https://tickets.yourclub.com
```

## Getting Your Keys

### Supabase Keys

1. Go to Supabase Dashboard → Your Project
2. Settings → API
3. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-side only!)

### Stripe Keys

1. Go to Stripe Dashboard
2. Developers → API keys
3. Copy:
   - **Publishable key** → `VITE_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** → `STRIPE_SECRET_KEY` (server-side only!)
4. For webhooks:
   - Developers → Webhooks
   - Create endpoint
   - Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### Twilio Keys

1. Go to Twilio Console
2. Account → API Keys & Tokens
3. Copy:
   - **Account SID** → `VITE_TWILIO_ACCOUNT_SID`
   - **Auth Token** → `VITE_TWILIO_AUTH_TOKEN`
   - **Phone Number** → `VITE_TWILIO_PHONE_NUMBER`

### SendGrid Keys

1. Go to SendGrid Dashboard
2. Settings → API Keys
3. Create API Key
4. Copy → `SENDGRID_API_KEY`

### Resend Keys

1. Go to Resend Dashboard
2. API Keys
3. Create API Key
4. Copy → `RESEND_API_KEY`

## Environment-Specific Setup

### Development

```env
# Use test keys
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

### Production

```env
# Use live keys
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

## Security Checklist

- [ ] Never commit `.env` files to git
- [ ] Add `.env` to `.gitignore`
- [ ] Use different keys for dev/prod
- [ ] Never expose service keys client-side
- [ ] Rotate keys regularly
- [ ] Use environment-specific keys
- [ ] Store production keys securely (use secrets manager)

## Example .gitignore

```
# Environment variables
.env
.env.local
.env.production
.env.development

# But commit example file
.env.example
```

## Example .env.example

Create a `.env.example` file (safe to commit) with placeholder values:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Add other variables with placeholder values
```

## Verifying Setup

### Test Supabase Connection

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Test connection
const { data, error } = await supabase.from('events').select('count')
console.log('Supabase connected:', !error)
```

### Test Stripe Connection

```typescript
import { loadStripe } from '@stripe/stripe-js'

const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
console.log('Stripe loaded:', !!stripe)
```

## Troubleshooting

### "Missing environment variable"

**Solution**: Check variable name matches exactly (case-sensitive)

### "Invalid API key"

**Solution**: 
1. Verify key is correct
2. Check for extra spaces
3. Ensure using correct environment (test vs live)

### CORS Errors

**Solution**: Add your domain to Supabase Dashboard → Settings → API → Allowed CORS origins

## Summary

- **Scanner Site**: Needs Supabase, QR signing, Twilio, SendGrid
- **Main Website**: Only needs Supabase (read-only)
- **Purchase Website**: Needs Supabase, Stripe, Email service
- **All Sites**: Use same Supabase project (same URL and anon key)
- **Security**: Never expose service keys client-side

