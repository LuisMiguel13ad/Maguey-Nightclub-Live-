# Deployment Tasks & Reminders

## Pre-Launch Checklist

### Ticket Scanner - RLS Policies Required
The scanner currently fails because RLS policies block UPDATE/INSERT operations. Run these SQL commands in Supabase to fix:

```sql
-- Allow authenticated users to update tickets (for scanning)
CREATE POLICY "Allow staff to update tickets for scanning"
ON public.tickets
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert scan logs
CREATE POLICY "Allow staff to insert scan logs"
ON public.scan_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to read scan logs
CREATE POLICY "Allow staff to read scan logs"
ON public.scan_logs
FOR SELECT
TO authenticated
USING (true);
```

**Test tickets already created:**
- `MAGUEY-001` - John Doe (john@test.com) - General Admission
- `MAGUEY-002` - Jane Smith (jane@test.com) - VIP
- `MAGUEY-003` - Bob Wilson (bob@test.com) - General Admission

**To test scanner:**
1. Run the SQL above in Supabase
2. Go to `/scanner`
3. Manual Entry → ID tab → Enter `MAGUEY-001` → Verify

---

### Staff / Invitation System
- [ ] **Create real owner account** - The quick access "Owner" button uses a mock user (`test-owner-1`) that can't create invitations. Before going live:
  1. Sign up with a real email/password in Supabase
  2. Set that account's role to `owner` in Supabase Dashboard → Authentication → Users → Edit user metadata: `{"role": "owner"}`
  3. Use that account to create staff invitations

### Database Tables Required
- [x] `invitations` table - Created (required for Staff invitation system)
- [ ] `user_profiles` table - May need to verify exists for team member listing

### Environment Variables
- [ ] Verify `VITE_SUPABASE_URL` is set to production URL
- [ ] Verify `VITE_SUPABASE_ANON_KEY` is set to production key

### Security
- [ ] Remove or disable quick access test buttons on Auth page for production
- [ ] Review RLS policies are properly configured

---

## Notes
- Invitation links format: `https://yourdomain.com/auth?invite=TOKEN`
- Invitations expire based on selected time (default 7 days)
- Roles: Owner (full access), Promoter (view analytics), Employee (scanner only)
