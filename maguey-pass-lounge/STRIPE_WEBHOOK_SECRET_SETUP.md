# Stripe Webhook Secret Configuration

## ✅ Added to .env File

Your Stripe webhook secret has been added to `maguey-pass-lounge/.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_f197ecfd94f013585e98bfa4d2c5fdcdf0d59d23bf738ad07001ea3abcd26284
```

---

## 🔐 Add to Supabase Edge Functions (Required)

**Important:** The webhook secret also needs to be added to Supabase Edge Functions secrets for the webhook handler to work in production.

### Steps:

1. Go to Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
4. Add a new secret:
   - **Name:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** `whsec_f197ecfd94f013585e98bfa4d2c5fdcdf0d59d23bf738ad07001ea3abcd26284`

---

## 📋 Complete Stripe Configuration

### Frontend (.env):
- ✅ `VITE_STRIPE_PUBLISHABLE_KEY` - Configured
- ✅ `STRIPE_WEBHOOK_SECRET` - Added (for local reference)

### Backend (Supabase Edge Functions Secrets):
- ✅ `STRIPE_SECRET_KEY` - You mentioned it's already added
- ⏳ `STRIPE_WEBHOOK_SECRET` - **Add this now** (see steps above)

---

## 🧪 Testing Webhook

After adding the secret to Supabase:

1. **Set up webhook endpoint in Stripe:**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Select events: `checkout.session.completed`
   - Copy the signing secret (you already have it)

2. **Test webhook:**
   - Use Stripe CLI: `stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Or use Stripe Dashboard webhook testing

---

## ✅ Status

- ✅ Webhook secret added to `.env`
- ⏳ **Action Required:** Add webhook secret to Supabase Edge Functions secrets

Once you add it to Supabase, your webhook handler will be fully configured!
