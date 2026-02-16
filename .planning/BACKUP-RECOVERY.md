# Backup and Recovery Procedures

> **Purpose:** Document recovery procedures for disaster scenarios
> **Last Updated:** _______________
> **Reviewed By:** _______________

This document outlines backup configurations, verification procedures, and recovery steps for various failure scenarios affecting the Maguey ticketing system.

---

## 1. Backup Overview

### Supabase Backup Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| **Supabase Plan** | [ ] Free / [ ] Pro / [ ] Team | Verify in Dashboard |
| **Backup Type** | Daily automated backups | Standard for all paid plans |
| **Point-in-Time Recovery (PITR)** | Available for Pro/Team | Continuous backup with 7-day retention |
| **Backup Retention** | 7 days (Pro) / 14 days (Team) | Older backups automatically purged |

### Recovery Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| **Recovery Point Objective (RPO)** | 24 hours (daily) / Continuous (PITR) | Maximum acceptable data loss |
| **Recovery Time Objective (RTO)** | 1-4 hours | Depends on database size |

### What's Backed Up

| Component | Backup Method | Recovery Path |
|-----------|---------------|---------------|
| PostgreSQL Database | Supabase automated backups | Dashboard restore |
| Edge Function Code | Git repository | Redeploy from main branch |
| Edge Function Secrets | Manual documentation | Re-enter from ENVIRONMENT-AUDIT.md |
| Storage Buckets | Supabase automated (Pro+) | Dashboard restore |
| Stripe Transaction History | Stripe retains indefinitely | Export from Stripe Dashboard |
| Email Delivery History | Resend retains 30 days | Export from Resend Dashboard |

---

## 2. Current Backup Status

Complete this section during audit:

| Item | Status | Last Verified | Notes |
|------|:------:|:-------------:|-------|
| Automated backups enabled | [ ] | | |
| Last successful backup | [ ] | | |
| PITR enabled | [ ] | | Pro/Team plans only |
| Backup retention period | ____ days | | |
| Test restore performed | [ ] | | Recommended quarterly |

---

## 3. Backup Verification Procedure

### Step 1: Access Backup Settings

1. Log into **Supabase Dashboard**
2. Select the production project
3. Navigate to **Project Settings > Database**
4. Click on **Backups** section

### Step 2: Verify Backup Configuration

- [ ] "Automated backups" toggle is **enabled**
- [ ] Last backup timestamp is within 24 hours
- [ ] Note backup retention period: _____ days

### Step 3: Verify PITR (if available)

- [ ] PITR toggle is **enabled** (Pro/Team only)
- [ ] PITR retention period noted: _____ days
- [ ] Earliest recovery point available: _____

### Step 4: Document Verification

Record verification date and findings in Section 2 above.

---

## 4. Recovery Scenarios

### Scenario A: Database Corruption / Accidental Data Loss

**Symptoms:**
- Missing records in tickets, vip_reservations, or events tables
- Data inconsistencies after failed migration
- Accidental bulk deletion

**Recovery Steps:**

1. **Assess Scope**
   - Identify affected tables and time range
   - Estimate records impacted
   - Document current state before recovery

2. **Determine Recovery Point**
   - For PITR: Choose specific timestamp before corruption
   - For daily backups: Use most recent backup before incident

3. **Execute Recovery**

   **Option A: Point-in-Time Recovery (Pro/Team)**
   1. Go to Supabase Dashboard > Project Settings > Database > Backups
   2. Click "Restore to Point in Time"
   3. Select target timestamp
   4. Confirm restoration (creates new database)
   5. Update connection strings if needed

   **Option B: Daily Backup Restore**
   1. Contact Supabase support: support@supabase.com
   2. Request restoration from specific backup date
   3. Coordinate restoration window (may involve downtime)

4. **Post-Recovery Verification**
   - [ ] Verify affected records restored
   - [ ] Test ticket purchase flow
   - [ ] Test scanner validation
   - [ ] Verify email delivery working
   - [ ] Check revenue totals match Stripe

5. **Document Incident**
   - Record cause, impact, recovery time
   - Update procedures if needed

---

### Scenario B: Stripe Webhook Data Mismatch

**Symptoms:**
- Payments received in Stripe but no corresponding tickets
- Revenue discrepancies between Stripe and database
- Customers report payment but no confirmation email

**Recovery Steps:**

1. **Identify Discrepancies**
   ```bash
   # Run verify-revenue Edge Function
   curl -X POST https://[project-ref].supabase.co/functions/v1/verify-revenue \
     -H "Authorization: Bearer [service-role-key]" \
     -H "Content-Type: application/json" \
     -d '{"startDate": "2024-01-01", "endDate": "2024-01-31"}'
   ```

2. **Query Stripe for Missing Transactions**
   - Log into Stripe Dashboard
   - Navigate to Payments > All payments
   - Filter by date range and status: succeeded
   - Export transaction list

3. **Compare with Database**
   ```sql
   -- Find tickets by Stripe session
   SELECT * FROM tickets
   WHERE stripe_checkout_session_id IN ('cs_xxx', 'cs_yyy');

   -- Find VIP reservations by payment intent
   SELECT * FROM vip_reservations
   WHERE stripe_payment_intent_id IN ('pi_xxx', 'pi_yyy');
   ```

4. **Manual Reconciliation**
   - For each missing payment, create ticket/reservation manually
   - Use Supabase Dashboard > Table Editor
   - Generate QR code and queue confirmation email

5. **Document in revenue_discrepancies Table**
   ```sql
   INSERT INTO revenue_discrepancies (
     event_id, discrepancy_type, expected_amount,
     actual_amount, details, resolved
   ) VALUES (
     'event-uuid', 'webhook_miss', 5000, 0,
     'Payment pi_xxx not processed', false
   );
   ```

6. **Investigate Root Cause**
   - Check webhook logs in Stripe Dashboard
   - Check Edge Function logs in Supabase Dashboard
   - Verify STRIPE_WEBHOOK_SECRET is correct

---

### Scenario C: Email Queue Failure

**Symptoms:**
- Customers report no confirmation emails
- email_queue table has many 'failed' status records
- Resend Dashboard shows no recent sends

**Recovery Steps:**

1. **Check Email Queue Status**
   ```sql
   -- Count emails by status
   SELECT status, COUNT(*)
   FROM email_queue
   GROUP BY status;

   -- Find stuck emails
   SELECT * FROM email_queue
   WHERE status IN ('pending', 'failed')
   AND created_at > NOW() - INTERVAL '24 hours';
   ```

2. **Verify Resend API Status**
   - Check https://status.resend.com for outages
   - Test API key validity:
     ```bash
     curl https://api.resend.com/emails \
       -H "Authorization: Bearer [RESEND_API_KEY]" \
       -H "Content-Type: application/json" \
       -d '{"from": "test@maguey.club", "to": "test@example.com", "subject": "Test", "text": "Test"}'
     ```

3. **Reset Failed Emails for Retry**
   ```sql
   -- Reset failed emails less than 24 hours old
   UPDATE email_queue
   SET status = 'pending',
       retry_count = 0,
       error_message = NULL,
       updated_at = NOW()
   WHERE status = 'failed'
   AND created_at > NOW() - INTERVAL '24 hours';
   ```

4. **Manually Trigger Queue Processor**
   ```bash
   curl -X POST https://[project-ref].supabase.co/functions/v1/process-email-queue \
     -H "Authorization: Bearer [service-role-key]"
   ```

5. **Monitor Recovery**
   - Watch email_queue for status changes
   - Check Resend Dashboard for successful deliveries
   - Verify customers receive emails

6. **If pg_cron Job Stopped**
   - Navigate to Supabase Dashboard > Database > Extensions
   - Verify pg_cron extension is enabled
   - Check cron.job table for process-email-queue schedule
   - Recreate job if missing:
     ```sql
     SELECT cron.schedule(
       'process-email-queue',
       '* * * * *',
       $$SELECT net.http_post(
         url := 'https://[project-ref].supabase.co/functions/v1/process-email-queue',
         headers := '{"Authorization": "Bearer [service-role-key]"}'::jsonb
       )$$
     );
     ```

---

### Scenario D: Complete Environment Recovery

**Symptoms:**
- Supabase project compromised or deleted
- Need to migrate to new infrastructure
- Complete rebuild required

**Recovery Steps:**

1. **Create New Supabase Project**
   - Log into Supabase Dashboard
   - Create new project in same region
   - Note new project URL and keys

2. **Request Backup Restoration**
   - Email support@supabase.com with:
     - Original project reference
     - New project reference
     - Requested backup date
   - Pro/Team plans have priority support

3. **Apply Database Migrations** (if not restoring)
   ```bash
   cd maguey-pass-lounge
   npx supabase db push --linked
   ```

4. **Reconfigure Edge Function Secrets**
   - Reference ENVIRONMENT-AUDIT.md
   - Enter each secret in new project:
     - Supabase Dashboard > Project Settings > Edge Functions > Secrets

5. **Deploy Edge Functions**
   ```bash
   cd maguey-pass-lounge
   npx supabase functions deploy --all
   ```

6. **Update Frontend Environment Variables**
   - Update Vercel/Netlify with new:
     - VITE_SUPABASE_URL
     - VITE_SUPABASE_ANON_KEY
   - Trigger redeployment

7. **Update Webhook URLs**
   - **Stripe Dashboard > Developers > Webhooks**
     - Update endpoint to new Supabase function URL
     - Regenerate webhook secret, update STRIPE_WEBHOOK_SECRET
   - **Resend Dashboard > Webhooks**
     - Update endpoint to new Supabase function URL
     - Regenerate webhook secret, update RESEND_WEBHOOK_SECRET

8. **Verify Recovery**
   - [ ] Run health check endpoint
   - [ ] Test ticket purchase flow
   - [ ] Test scanner validation
   - [ ] Verify email delivery
   - [ ] Test VIP reservation flow
   - [ ] Verify dashboard loads correctly

9. **Redirect Traffic**
   - Update DNS if using custom domain
   - Update any hardcoded URLs in external systems

---

## 5. Rollback Procedure (Deployment Failure)

### Frontend Rollback (Vercel)

1. Log into Vercel Dashboard
2. Navigate to project > Deployments
3. Find last known working deployment
4. Click three-dot menu > "Promote to Production"
5. Verify site loads correctly

### Edge Functions Rollback

1. Identify last working commit:
   ```bash
   git log --oneline supabase/functions/ | head -10
   ```

2. Deploy from specific commit:
   ```bash
   git checkout [commit-hash] -- supabase/functions/
   npx supabase functions deploy --all
   git checkout main -- supabase/functions/
   ```

### Database Migration Rollback

**Warning:** Schema changes may not be easily reversible. Always test migrations in staging first.

1. Document current schema state
2. Write reversal SQL for each migration change
3. Execute reversal in Supabase SQL Editor
4. Verify application still functions

**Example rollback for adding column:**
```sql
-- Forward migration added: ALTER TABLE tickets ADD COLUMN new_field TEXT;
-- Rollback:
ALTER TABLE tickets DROP COLUMN new_field;
```

---

## 6. Emergency Contacts

| Service | Contact | Priority | Notes |
|---------|---------|:--------:|-------|
| **Supabase Support** | support@supabase.com | Pro/Team | Include project ref in subject |
| **Supabase Discord** | discord.supabase.com | All | Community support, faster for common issues |
| **Stripe Support** | https://support.stripe.com | All | Use dashboard chat for fastest response |
| **Resend Support** | https://resend.com/support | All | Email or Discord |
| **Vercel Support** | https://vercel.com/help | Pro | Dashboard chat available |
| **Developer** | [Add owner contact] | N/A | Primary escalation |
| **Venue Manager** | [Add contact] | N/A | Business decisions |

### Escalation Path

1. **Severity 1 (Site Down):** Developer + Supabase Support immediately
2. **Severity 2 (Payment Issues):** Developer + Stripe Support
3. **Severity 3 (Email Issues):** Developer + Resend Support
4. **Severity 4 (Minor Issues):** Developer, resolve next business day

---

## 7. Recovery Testing

### Test Schedule

| Test Type | Frequency | Last Performed | Next Scheduled |
|-----------|:---------:|:--------------:|:--------------:|
| Backup verification | Monthly | | |
| PITR restore (staging) | Quarterly | | |
| Full recovery drill | Annually | | |
| Rollback procedure | Per release | | |

### Recovery Test Procedure

1. **Create Test Environment**
   - Create new Supabase project for testing
   - Do NOT use production credentials

2. **Request Test Restore**
   - Contact Supabase support
   - Request production backup restore to test project
   - Document restore time

3. **Verify Restored Data**
   - Check record counts match expectations
   - Verify recent transactions present
   - Test application against restored database

4. **Document Results**
   - Record restore success/failure
   - Note any data gaps
   - Update RTO/RPO estimates if needed

5. **Clean Up**
   - Delete test project after verification
   - Update this document with findings

### Recovery Test Log

| Date | Test Type | Result | Notes | Performed By |
|------|-----------|:------:|-------|--------------|
| | | | | |
| | | | | |

---

## 8. Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-01 | Initial creation | System |
| | | |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Operations | | | |
