# 🔐 Login Account Fix

## Issue: "Login account not valid"

The account `demo@maguey.com` exists but may need email confirmation.

## ✅ Solution Options

### Option 1: Use Signup Page (Easiest)

1. Go to: **http://localhost:5173/signup**
2. Enter:
   - Email: `demo@maguey.com` (or use a different email)
   - Password: `demo1234` (or your preferred password)
   - Confirm Password: Same as password
3. Click **Create Account**
4. If email confirmation is required, check your email
5. Or use Option 2 below to confirm manually

### Option 2: Confirm Email in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Users**
3. Find `demo@maguey.com`
4. Click the three dots (⋯) → **Confirm Email**
5. Try logging in again

### Option 3: Create New Account

1. Go to: **http://localhost:5173/signup**
2. Use any email address (e.g., `test@example.com`)
3. Create password
4. Complete signup
5. Use this account to view tickets

### Option 4: Disable Email Confirmation (Development Only)

1. Go to Supabase Dashboard
2. Navigate to **Authentication** → **Settings**
3. Under **Email Auth**, disable **Confirm email**
4. Save changes
5. Try logging in again

---

## 📋 Current Account Status

- **Email**: `demo@maguey.com`
- **Status**: Created but may need email confirmation
- **User ID**: `ea00ba79-3e8c-439c-af5a-1e109656dd46`

---

## 🎯 Quick Test Steps

1. **Signup**: http://localhost:5173/signup
   - Create account with any email
   - Password: `demo1234` (or your choice)

2. **Login**: http://localhost:5173/login
   - Use the email/password you just created

3. **View Account**: http://localhost:5173/account
   - See your tickets (if any purchased)

4. **View Ticket**: http://localhost:5173/ticket/{ticketId}
   - See QR code for any ticket you have

---

## 🔍 Troubleshooting

### "Invalid login credentials"
- Account may not exist → Use signup page
- Email not confirmed → Confirm in Supabase Dashboard
- Wrong password → Reset password or create new account

### "Email already registered"
- Account exists → Try Option 2 (confirm email)
- Or use a different email address

### Still having issues?
- Check Supabase Dashboard → Authentication → Users
- Verify email confirmation settings
- Try creating a completely new account

---

**Ready to test!** Once logged in, you can purchase tickets and view QR codes.

