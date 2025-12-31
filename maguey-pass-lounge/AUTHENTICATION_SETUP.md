# Authentication Setup Guide

## Overview

A complete authentication system has been implemented with:
- ✅ Email/Password login and signup
- ✅ Social authentication (Google, Facebook, Apple, GitHub)
- ✅ Protected routes
- ✅ User profile management
- ✅ Integration with checkout

## What's Been Created

### 1. Authentication Context
- **File:** `src/contexts/AuthContext.tsx`
- Provides authentication state and methods throughout the app
- Manages user session and auth state

### 2. Login Page
- **File:** `src/pages/Login.tsx`
- Email/password login
- Social login buttons (Google, Facebook, Apple, GitHub)
- "Forgot password" link
- Link to signup page

### 3. Signup Page
- **File:** `src/pages/Signup.tsx`
- Email/password signup with validation
- Password strength indicator
- Social signup buttons
- Terms and conditions acceptance

### 4. Forgot Password Page
- **File:** `src/pages/ForgotPassword.tsx`
- Password reset email request
- Success confirmation

### 5. Protected Route Component
- **File:** `src/components/ProtectedRoute.tsx`
- Redirects unauthenticated users to login
- Preserves intended destination

### 6. Auth Button Component
- **File:** `src/components/AuthButton.tsx`
- Shows login/signup buttons when logged out
- Shows user menu when logged in
- Dropdown with account options

### 7. Updated Account Page
- **File:** `src/pages/Account.tsx`
- Displays real user data from auth
- Shows social login provider
- Sign out functionality

### 8. Updated Checkout
- **File:** `src/pages/Checkout.tsx`
- Pre-fills form with user data if logged in
- Suggests login if not authenticated

## Setup Instructions

### Step 1: Configure Supabase

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Create a new project
   - Get your project URL and anon key

2. **Set Environment Variables**
   Create `.env` file:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Enable Authentication Providers**
   In Supabase Dashboard → Authentication → Providers:
   
   **Email/Password:**
   - ✅ Enable Email provider
   - ✅ Enable "Confirm email" (recommended)
   
   **Google:**
   - ✅ Enable Google provider
   - Get Client ID and Secret from Google Cloud Console
   - Add redirect URL: `https://your-project.supabase.co/auth/v1/callback`
   
   **Facebook:**
   - ✅ Enable Facebook provider
   - Get App ID and Secret from Facebook Developers
   - Add redirect URL: `https://your-project.supabase.co/auth/v1/callback`
   
   **Apple:**
   - ✅ Enable Apple provider
   - Get Service ID, Key ID, and Private Key from Apple Developer
   - Add redirect URL: `https://your-project.supabase.co/auth/v1/callback`
   
   **GitHub:**
   - ✅ Enable GitHub provider
   - Get Client ID and Secret from GitHub OAuth Apps
   - Add redirect URL: `https://your-project.supabase.co/auth/v1/callback`

### Step 2: Configure OAuth Providers

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Add authorized redirect URI:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```
6. Copy Client ID and Secret to Supabase

#### Facebook OAuth Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add Facebook Login product
4. Go to Settings → Basic
5. Add redirect URI:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```
6. Copy App ID and App Secret to Supabase

#### Apple OAuth Setup

1. Go to [Apple Developer](https://developer.apple.com/)
2. Create a Service ID
3. Configure Sign in with Apple
4. Add redirect URI:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```
5. Create a Private Key
6. Add credentials to Supabase

#### GitHub OAuth Setup

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Authorization callback URL:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```
4. Copy Client ID and Secret to Supabase

### Step 3: Configure Email Templates (Optional)

In Supabase Dashboard → Authentication → Email Templates:
- Customize confirmation email
- Customize password reset email
- Customize magic link email

### Step 4: Test Authentication

1. **Test Email/Password:**
   - Go to `/signup`
   - Create an account
   - Check email for confirmation
   - Login at `/login`

2. **Test Social Login:**
   - Click "Continue with Google" (or other provider)
   - Complete OAuth flow
   - Verify user is logged in

3. **Test Protected Routes:**
   - Try accessing `/account` without logging in
   - Should redirect to `/login`
   - After login, should redirect back to `/account`

## Features

### Authentication Methods

1. **Email/Password**
   - Sign up with email and password
   - Password strength validation
   - Email verification (optional)
   - Password reset

2. **Social Authentication**
   - Google - One-click sign in
   - Facebook - Social login
   - Apple - Sign in with Apple
   - GitHub - Developer-friendly login

### User Experience

- **Auto-fill checkout:** User data pre-filled if logged in
- **Protected routes:** Account page requires authentication
- **Session persistence:** Users stay logged in across page refreshes
- **Social provider badge:** Shows which provider user signed in with

### Security

- **Password requirements:** Minimum 8 characters, uppercase, lowercase, number
- **Email verification:** Optional but recommended
- **Secure sessions:** Managed by Supabase
- **OAuth security:** Handled by Supabase and providers

## Integration with Checkout

When a user is logged in:
- ✅ Checkout form is pre-filled with their name and email
- ✅ No need to re-enter information
- ✅ Faster checkout experience

When a user is not logged in:
- ✅ Can still checkout as guest
- ✅ Suggestion to sign in for faster checkout
- ✅ Can create account after purchase (future enhancement)

## User Flow

### New User:
1. Browse events
2. Select tickets
3. Click "Proceed to Checkout"
4. Option to sign up (or continue as guest)
5. Complete purchase
6. Receive tickets via email

### Returning User:
1. Sign in (or use social login)
2. Browse events
3. Select tickets
4. Checkout form pre-filled
5. Complete purchase
6. Tickets saved to account

## Files Created/Updated

### New Files:
- `src/contexts/AuthContext.tsx` - Auth context provider
- `src/pages/Login.tsx` - Login page
- `src/pages/Signup.tsx` - Signup page
- `src/pages/ForgotPassword.tsx` - Password reset
- `src/components/ProtectedRoute.tsx` - Route protection
- `src/components/AuthButton.tsx` - Auth navigation button
- `src/lib/supabase.ts` - Supabase client

### Updated Files:
- `src/App.tsx` - Added AuthProvider and routes
- `src/pages/Checkout.tsx` - Pre-fill user data
- `src/pages/Account.tsx` - Real user data
- `src/pages/Events.tsx` - Added AuthButton

## Next Steps

1. ✅ Set up Supabase project
2. ✅ Configure environment variables
3. ✅ Enable authentication providers
4. ✅ Set up OAuth apps (Google, Facebook, etc.)
5. ✅ Test authentication flow
6. ✅ Customize email templates (optional)

## Troubleshooting

### "Supabase not configured" error
- Check `.env` file has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart dev server after adding env variables

### Social login not working
- Verify OAuth app is configured correctly
- Check redirect URI matches Supabase callback URL
- Verify Client ID and Secret are correct in Supabase

### Email verification not working
- Check Supabase email settings
- Verify SMTP is configured (or use Supabase default)
- Check spam folder

### Protected route not redirecting
- Verify `AuthProvider` wraps your app
- Check `ProtectedRoute` component is used correctly

## Security Notes

- Never expose Supabase service role key in frontend
- Use anon key for client-side operations
- Enable Row Level Security (RLS) in Supabase
- Set up proper CORS rules
- Use HTTPS in production

## Support

For issues:
1. Check browser console for errors
2. Verify environment variables are set
3. Check Supabase dashboard for auth logs
4. Verify OAuth provider settings

