# What is a Webhook Handler?

## Overview

A **webhook handler** is a backend API endpoint that Stripe automatically calls after a payment is completed. This is where you generate tickets and send emails.

## Why Do You Need It?

Here's the flow:

```
Customer fills checkout form
    ↓
Frontend creates Stripe checkout session
    ↓
Customer pays on Stripe
    ↓
[WEBHOOK HANDLER] ← Stripe calls this automatically
    ↓
Generate tickets with unique IDs
    ↓
Save tickets to database
    ↓
Send email with tickets
    ↓
Customer receives email
```

## The Problem

Your **frontend** (React app) can't directly:
- Generate tickets (needs access to database)
- Send emails (needs API keys, not safe in frontend)
- Process webhooks securely (needs to verify Stripe signature)

So you need a **backend** that:
- Receives webhook from Stripe
- Generates tickets
- Sends emails
- Updates database

## Where to Create the Webhook Handler

You have several options:

### Option 1: Supabase Edge Functions (Recommended if using Supabase)

**Location:** `supabase/functions/stripe-webhook/index.ts`

**Steps:**
1. Create the function file
2. Deploy to Supabase
3. Get the function URL
4. Add URL to Stripe webhook settings

**Example:**
```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

serve(async (req) => {
  // Handle webhook here
  // Generate tickets
  // Send emails
});
```

### Option 2: Node.js/Express Server

**Location:** Your Express backend server

**Example:**
```javascript
// server.js or routes/webhook.js
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  // Handle webhook here
  // Generate tickets
  // Send emails
});
```

### Option 3: Vercel Serverless Function

**Location:** `api/stripe-webhook.js`

**Example:**
```javascript
// api/stripe-webhook.js
export default async function handler(req, res) {
  // Handle webhook here
  // Generate tickets
  // Send emails
}
```

### Option 4: Netlify Functions

**Location:** `netlify/functions/stripe-webhook.js`

## What the Webhook Handler Does

The webhook handler I created (`backend-example/stripe-webhook.ts`) does:

1. **Receives webhook** from Stripe when payment completes
2. **Verifies signature** (security check)
3. **Gets order data** from database
4. **Generates unique ticket IDs** (no duplicates)
5. **Creates QR codes** for each ticket
6. **Saves tickets** to database
7. **Sends email** to customer with tickets
8. **Updates order status** to "paid"

## Complete Setup Guide

### Step 1: Choose Your Backend

**Do you have a backend?**
- ✅ Yes → Use your existing backend
- ❌ No → You need to create one

**Recommended options:**
- **Supabase Edge Functions** (if using Supabase) - easiest
- **Vercel Serverless Functions** - good for Next.js
- **Netlify Functions** - good for static sites
- **Express/Node.js server** - traditional backend

### Step 2: Create the Webhook Endpoint

Copy the code from `backend-example/stripe-webhook.ts` and adapt it to your backend.

**Key parts:**
```typescript
// 1. Verify webhook signature (security)
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

// 2. Handle checkout.session.completed event
if (event.type === 'checkout.session.completed') {
  // 3. Get order from database
  const order = await getOrder(orderId);
  
  // 4. Generate tickets
  const tickets = await generateTickets(order);
  
  // 5. Send email
  await sendEmail(order, tickets);
}
```

### Step 3: Deploy Your Backend

Deploy your webhook handler to get a URL:
- Supabase: `https://your-project.supabase.co/functions/v1/stripe-webhook`
- Vercel: `https://your-app.vercel.app/api/stripe-webhook`
- Express: `https://your-api.com/api/stripe-webhook`

### Step 4: Configure Stripe Webhook

1. Go to Stripe Dashboard: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your webhook URL
4. Select event: `checkout.session.completed`
5. Copy the webhook signing secret
6. Add to your backend environment variables: `STRIPE_WEBHOOK_SECRET`

### Step 5: Test

1. Make a test purchase
2. Check Stripe Dashboard → Webhooks → See if webhook was called
3. Check your backend logs
4. Verify tickets were created in database
5. Check customer email

## Do You Currently Have a Backend?

**If NO**, here are your options:

### Quick Start: Supabase Edge Functions

1. Install Supabase CLI: `npm install -g supabase`
2. Initialize: `supabase init`
3. Create function: `supabase functions new stripe-webhook`
4. Copy code from `backend-example/stripe-webhook.ts`
5. Deploy: `supabase functions deploy stripe-webhook`
6. Get URL and add to Stripe

### Quick Start: Vercel Serverless

1. Create `api/stripe-webhook.ts` in your project
2. Copy and adapt the webhook code
3. Deploy to Vercel
4. Get URL and add to Stripe

## The Complete Flow

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │ 1. Create checkout session
       ↓
┌─────────────┐
│   Backend   │
│  API (/api/ │
│  create-    │
│  checkout)  │
└──────┬──────┘
       │ 2. Create Stripe session
       ↓
┌─────────────┐
│   Stripe    │
│  Checkout   │
└──────┬──────┘
       │ 3. Customer pays
       ↓
┌─────────────┐
│   Stripe    │
│  (calls)    │
└──────┬──────┘
       │ 4. Webhook event
       ↓
┌─────────────┐
│  Webhook    │ ← This is what you need to create!
│  Handler    │
│  (Backend)  │
└──────┬──────┘
       │ 5. Generate tickets
       │ 6. Send email
       ↓
┌─────────────┐
│  Database   │
│  + Email    │
└─────────────┘
```

## What You Need to Do

1. **Decide on backend platform** (Supabase, Vercel, Express, etc.)
2. **Create webhook endpoint** using code from `backend-example/stripe-webhook.ts`
3. **Deploy backend** and get URL
4. **Configure Stripe** to call your webhook URL
5. **Test** the complete flow

## Files You Have

- ✅ `backend-example/stripe-webhook.ts` - Complete webhook handler code
- ✅ `src/lib/ticket-generator.ts` - Ticket generation functions
- ✅ `src/lib/email-template.ts` - Email templates
- ✅ `EMAIL_SERVICE_SETUP.md` - Email service setup

## Questions?

**Q: Do I need to create a separate backend server?**
A: Not necessarily. You can use serverless functions (Supabase, Vercel, Netlify) which are easier.

**Q: Can I use the frontend for this?**
A: No, webhooks need a backend for security (verifying Stripe signatures) and accessing database/email APIs.

**Q: What's the easiest option?**
A: Supabase Edge Functions if you're using Supabase, or Vercel Serverless Functions if you want a simple backend.

**Q: How long does it take to set up?**
A: 30-60 minutes depending on your backend setup experience.

Need help setting up a specific backend? Let me know which platform you want to use!

