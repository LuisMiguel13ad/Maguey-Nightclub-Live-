# Troubleshooting Checkout Errors

## "Failed to process checkout" Error

If you're seeing this error when clicking "Proceed to Payment", here's how to fix it:

### Step 1: Check Browser Console

Open your browser's developer console (F12 or Cmd+Option+I) and look for the error message. The improved error handling will now show you exactly what's wrong.

### Step 2: Common Issues and Solutions

#### Issue 1: Backend API Not Found (404 Error)

**Error Message:** "Backend API endpoint not found"

**Solution:** You need to create a backend API endpoint. The frontend is trying to call:
```
POST http://localhost:3000/api/create-checkout-session
```

**Quick Fix Options:**

**Option A: Create a Simple Backend (Recommended)**
1. Create a new Node.js/Express server or use Supabase Edge Functions
2. See `STRIPE_SETUP.md` for complete implementation guide
3. The endpoint should create a Stripe checkout session and return `{ sessionId: "..." }`

**Option B: Use a Mock/Test Mode (For Development)**
You can temporarily modify the checkout to skip the API call for testing. However, for real payments, you'll need the backend.

#### Issue 2: Cannot Connect to Backend (Network Error)

**Error Message:** "Network error: Cannot connect to backend API"

**Solutions:**
1. **Start your backend server** - Make sure it's running on the port specified in `VITE_API_URL`
2. **Check VITE_API_URL** - Create a `.env` file with:
   ```env
   VITE_API_URL=http://localhost:3000/api
   ```
3. **Enable CORS** - Your backend needs to allow requests from your frontend
4. **Check the URL** - Make sure the backend is accessible at the URL specified

#### Issue 3: Stripe Not Configured

**Error Message:** "Stripe is not configured"

**Solution:**
1. Create a `.env` file in the project root
2. Add your Stripe publishable key:
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
   ```
3. Get your key from: https://dashboard.stripe.com/apikeys
4. Restart your dev server after adding the `.env` file

### Step 3: Create .env File

Create a `.env` file in the project root (`/Users/luismiguel/Desktop/maguey-pass-lounge/.env`):

```env
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51...

# Backend API URL
VITE_API_URL=http://localhost:3000/api

# Environment
VITE_ENV=development
```

**Important:** After creating/updating `.env`, restart your dev server:
```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 4: Quick Test - Check Environment Variables

Add this temporarily to your checkout page to see what's configured:

```typescript
console.log('API URL:', import.meta.env.VITE_API_URL);
console.log('Stripe Key:', import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? 'Set' : 'Not set');
```

### Step 5: Create Backend API

The backend API is required for Stripe checkout. You have two options:

#### Option A: Supabase Edge Function (Recommended if using Supabase)

1. Create a Supabase Edge Function
2. See `STRIPE_SETUP.md` for the complete code
3. Deploy it to Supabase
4. Update `VITE_API_URL` to point to your Supabase function

#### Option B: Node.js/Express Server

1. Create a simple Express server
2. Add the Stripe checkout session endpoint
3. See `STRIPE_SETUP.md` for the complete code
4. Run it on port 3000 (or update `VITE_API_URL`)

### Still Having Issues?

1. **Check the browser console** - The error message will tell you exactly what's wrong
2. **Check the Network tab** - See what request is being made and what response you're getting
3. **Verify environment variables** - Make sure they're loaded (restart dev server)
4. **Check backend logs** - If you have a backend, check its logs for errors

### Next Steps

Once you have the backend API set up:
1. ✅ Frontend will call your API
2. ✅ API creates Stripe checkout session
3. ✅ Customer is redirected to Stripe
4. ✅ After payment, Stripe webhook creates tickets
5. ✅ Customer redirected to success page

See `STRIPE_SETUP.md` for complete setup instructions.

