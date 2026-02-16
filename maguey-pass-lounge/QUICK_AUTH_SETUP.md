# Quick Authentication Setup

## What You Need to Do

### 1. Set Up Supabase (5 minutes)

1. Go to https://supabase.com and create a free account
2. Create a new project
3. Go to Settings → API
4. Copy your project URL and anon key

### 2. Add Environment Variables (1 minute)

Create a `.env` file in your project root:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Enable Authentication Providers (10 minutes)

In Supabase Dashboard → Authentication → Providers:

#### Email/Password (Required)
- ✅ Enable "Email" provider
- ✅ Enable "Confirm email" (recommended)

#### Google OAuth (Optional but Recommended)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase

#### Facebook OAuth (Optional)
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create app and get App ID/Secret
3. Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Add to Supabase

#### Apple OAuth (Optional)
1. Go to [Apple Developer](https://developer.apple.com/)
2. Create Service ID and configure
3. Add redirect URI
4. Add credentials to Supabase

#### GitHub OAuth (Optional)
1. Go to [GitHub OAuth Apps](https://github.com/settings/developers)
2. Create OAuth App
3. Set callback URL: `https://your-project.supabase.co/auth/v1/callback`
4. Add to Supabase

### 4. Restart Dev Server (1 minute)

```bash
# Stop server (Ctrl+C)
npm run dev
```

## That's It! 🎉

Your authentication system is now ready:
- ✅ Email/password login and signup
- ✅ Social login (once OAuth apps are configured)
- ✅ Protected routes
- ✅ User profile management
- ✅ Checkout integration

## Test It

1. Go to `/signup` - Create an account
2. Go to `/login` - Sign in
3. Go to `/account` - View your profile (protected)
4. Try social login buttons

## Features Available

- **Login:** `/login`
- **Signup:** `/signup`
- **Forgot Password:** `/forgot-password`
- **Account:** `/account` (protected, requires login)
- **Social Login:** Google, Facebook, Apple, GitHub
- **Auto-fill Checkout:** User data pre-filled when logged in

## Troubleshooting

**Error: "Supabase not configured"**
- Check `.env` file exists
- Verify environment variables are correct
- Restart dev server

**Social login not working**
- Verify OAuth app is configured
- Check redirect URI matches exactly
- Verify credentials in Supabase

**Email not sending**
- Check Supabase email settings
- Verify SMTP is configured (or use Supabase default)
- Check spam folder

See `AUTHENTICATION_SETUP.md` for detailed setup instructions.

