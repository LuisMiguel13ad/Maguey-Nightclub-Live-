# Stripe Credentials Setup Guide

## ✅ Frontend Configuration (Complete)

Your Stripe **publishable key** has been added to `.env`:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SdKwiK9xNUVZKDuAzJsTllAGm5ZshO9WsNjD9EvNqYL6KX65FpnIpG23FSXbOHmMvXyNavlPpCOKvUchgFyhraB00TkmKNBqx
```

This key is safe to use in frontend code and is already configured.

---

## 🔐 Backend Configuration (Required)

Your Stripe **secret key** needs to be added to Supabase Edge Functions as an environment variable.

### Your Secret Key:
```
sk_test_51SdKwiK9xNUVZKDukmYheWf07z1vgS2dc5pqB35BhHxd90QRwJqblqxPtMprzyyUOfvcc162KrDV1o8ce6gsx3nZ009X7wd543
```

### Step 1: Add Secret Key to Supabase Edge Functions

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Edge Functions** → **Settings** (or **Project Settings** → **Edge Functions**)
4. Find the **Secrets** section
5. Add a new secret:
   - **Name:** `STRIPE_SECRET_KEY`
   - **Value:** `sk_test_51SdKwiK9xNUVZKDukmYheWf07z1vgS2dc5pqB35BhHxd90QRwJqblqxPtMprzyyUOfvcc162KrDV1o8ce6gsx3nZ009X7wd543`

### Step 2: Add Webhook Secret (Optional but Recommended)

For webhook signature verification, you'll also need to add your Stripe webhook secret:

1. In Stripe Dashboard → **Developers** → **Webhooks**
2. Create a webhook endpoint pointing to: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Copy the **Signing Secret** (starts with `whsec_`)
4. Add it to Supabase Edge Functions secrets:
   - **Name:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** `whsec_your_webhook_secret_here`

---

## 📋 Edge Functions That Use Stripe

The following Edge Functions require the `STRIPE_SECRET_KEY`:

1. **`create-checkout-session`** - Creates Stripe checkout sessions
2. **`stripe-webhook`** - Handles Stripe webhook events

Both functions will automatically use the `STRIPE_SECRET_KEY` environment variable once it's configured in Supabase.

---

## ✅ Verification

After adding the secret key, test the integration:

1. **Test Checkout Session Creation:**
   ```bash
   # The frontend will call the create-checkout-session function
   # Check browser console for any errors
   ```

2. **Test Webhook (if configured):**
   - Use Stripe CLI: `stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Or use Stripe Dashboard webhook testing

---

## 🔒 Security Notes

- ✅ **Publishable Key (pk_test_...):** Safe for frontend, already in `.env`
- 🔐 **Secret Key (sk_test_...):** Must be in Supabase Edge Functions secrets only
- 🔐 **Webhook Secret (whsec_...):** Must be in Supabase Edge Functions secrets only

**Never commit secret keys to git!** They should only exist in:
- Supabase Edge Functions secrets (for server-side)
- `.env` file (for publishable key only, and `.env` should be in `.gitignore`)

---

## 🧪 Testing

Use Stripe test cards:
- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **3D Secure:** `4000 0025 0000 3155`

Any future expiry date and any CVC will work in test mode.

---

## 📝 Summary

✅ **Frontend:** Configured with publishable key  
⏳ **Backend:** Add secret key to Supabase Edge Functions secrets  
⏳ **Webhook:** Add webhook secret (optional but recommended)

Once you add the secret key to Supabase, your payment flow will be fully functional!
