# Resend Email Service Setup Guide

## ✅ Frontend Configuration (Complete)

Your Resend API key has been added to `.env`:

```env
VITE_EMAIL_API_KEY=re_jH2HNEMf_KDN2W97nHbt3qgziwxntBhex
VITE_EMAIL_FROM_ADDRESS=tickets@maguey.com
```

**Note:** The FROM address is set to `tickets@maguey.com` as a default. You should:
1. Verify this domain in your Resend account
2. Update it if you have a different verified domain
3. Or use Resend's default domain (e.g., `onboarding@resend.dev` for testing)

---

## 🔐 Backend Configuration (Required)

Your Resend API key also needs to be added to **Supabase Edge Functions** for the webhook handler.

### Step 1: Add Resend API Key to Supabase Edge Functions

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
4. Add a new secret:
   - **Name:** `RESEND_API_KEY`
   - **Value:** `re_jH2HNEMf_KDN2W97nHbt3qgziwxntBhex`

### Step 2: Verify Your Email Domain in Resend

1. Go to Resend Dashboard: https://resend.com/domains
2. Add and verify your domain (e.g., `maguey.com`)
3. Update `VITE_EMAIL_FROM_ADDRESS` in `.env` to use your verified domain:
   ```env
   VITE_EMAIL_FROM_ADDRESS=tickets@yourdomain.com
   ```

**For Testing:** You can use Resend's default domain:
```env
VITE_EMAIL_FROM_ADDRESS=onboarding@resend.dev
```

---

## 📋 Edge Functions That Use Resend

The following Edge Function requires the `RESEND_API_KEY`:

1. **`stripe-webhook`** - Sends ticket emails after successful payment

The function automatically uses the `RESEND_API_KEY` environment variable once it's configured in Supabase.

---

## 📧 Email Features

Your email service will handle:

1. **Ticket Delivery Emails** - Sent automatically after Stripe payment
   - Includes QR codes for each ticket
   - Event details and instructions
   - Order confirmation

2. **Ticket Resend** - Available in admin dashboard
   - Resend tickets to customers
   - Useful if email was lost or not received

3. **Order Confirmations** - Sent with ticket emails

---

## ✅ Verification

After adding the API key to Supabase, test the integration:

1. **Test Email Sending (Frontend):**
   - Go to Admin Dashboard → Orders
   - Click "Resend Tickets" on an order
   - Check that email is sent successfully

2. **Test Webhook Email (Backend):**
   - Complete a test purchase with Stripe
   - Check that ticket email is sent automatically
   - Verify email contains QR codes

---

## 🔒 Security Notes

- ✅ **Frontend API Key:** Used for admin resend functionality (client-side)
- 🔐 **Backend API Key:** Must be in Supabase Edge Functions secrets (server-side)
- ⚠️ **Security Warning:** Frontend API keys are exposed to users. For production, consider:
  - Proxying email sends through your backend
  - Using Supabase Edge Functions for all email operations
  - Keeping API keys server-side only

---

## 📝 Email Template

The system uses email templates from `src/lib/email-template.ts`:
- HTML email with ticket QR codes
- Responsive design
- Event details and instructions
- Order information

---

## 🧪 Testing

1. **Test with Resend Dashboard:**
   - Go to Resend Dashboard → Emails
   - View sent emails and delivery status

2. **Test Email Addresses:**
   - Use your own email for testing
   - Check spam folder if emails don't arrive
   - Verify QR codes load correctly in email

---

## 📝 Summary

✅ **Frontend:** Configured with API key and FROM address  
⏳ **Backend:** Add `RESEND_API_KEY` to Supabase Edge Functions secrets  
⏳ **Domain:** Verify your email domain in Resend (or use `onboarding@resend.dev` for testing)

Once you add the API key to Supabase, your email service will be fully functional!

---

## 🔗 Related Documentation

- `EMAIL_SERVICE_SETUP.md` - Complete email service documentation
- `STRIPE_CREDENTIALS_SETUP.md` - Stripe setup guide
