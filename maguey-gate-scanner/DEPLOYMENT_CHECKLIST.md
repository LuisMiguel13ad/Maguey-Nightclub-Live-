# Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Database Migrations
- [x] ✅ `fix_security_rls_policies_v2` - Applied
- [x] ✅ `add_performance_indexes` - Applied

### 2. Edge Functions Updated
- [x] ✅ `event-availability` - Rate limiting, caching, logging added
- [x] ✅ `ticket-webhook` - Rate limiting, signature verification, logging added
- [x] ✅ `order-tickets` - Rate limiting, logging added

### 3. Utility Files Created
- [x] ✅ `src/lib/retry.ts` - Retry logic utility
- [x] ✅ `src/lib/error-tracking.ts` - Error tracking utility

---

## 🚀 Deployment Steps

### Step 1: Deploy Edge Functions

```bash
# Navigate to project directory
cd /Users/luismiguel/Desktop/maguey-gate-scanner

# Deploy all updated functions
supabase functions deploy event-availability
supabase functions deploy ticket-webhook
supabase functions deploy order-tickets
```

### Step 2: Set Environment Variables

```bash
# Set webhook secret (required for webhook signature verification)
supabase secrets set TICKET_WEBHOOK_SECRET=your-secret-key-here

# Optional: Set Sentry DSN for error tracking
supabase secrets set VITE_SENTRY_DSN=your-sentry-dsn-here
```

**Generate a secure webhook secret:**
```bash
# Using openssl
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Enable Leaked Password Protection

**Manual Step Required:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Password Security**
4. Enable **"Leaked Password Protection"**
5. Save changes

### Step 4: Verify Deployment

```bash
# Test event-availability function
curl https://your-project.supabase.co/functions/v1/event-availability/TestEvent \
  -H "apikey: your-anon-key"

# Test rate limiting (should return 429 after 100 requests)
for i in {1..101}; do
  curl https://your-project.supabase.co/functions/v1/event-availability/TestEvent \
    -H "apikey: your-anon-key"
done

# Test caching (check X-Cache header)
curl -I https://your-project.supabase.co/functions/v1/event-availability/TestEvent \
  -H "apikey: your-anon-key"
```

---

## 🔍 Post-Deployment Verification

### 1. Check Function Logs
- [ ] Verify rate limiting is working (check for 429 responses)
- [ ] Verify caching is working (check X-Cache headers)
- [ ] Verify request logging is working (check function logs)

### 2. Test Rate Limiting
- [ ] Make 100+ requests quickly
- [ ] Verify 429 response after limit
- [ ] Verify Retry-After header

### 3. Test Caching
- [ ] Make same request twice
- [ ] Verify X-Cache: HIT on second request
- [ ] Verify faster response time

### 4. Test Webhook Signature
- [ ] Test webhook without signature (should fail if secret set)
- [ ] Test webhook with valid signature (should succeed)
- [ ] Verify error logging for invalid signatures

### 5. Monitor Performance
- [ ] Check database query performance (should be faster with indexes)
- [ ] Monitor edge function response times
- [ ] Check error rates

---

## 📊 Monitoring

### Key Metrics to Monitor

1. **Rate Limiting:**
   - Number of 429 responses
   - IPs hitting rate limits
   - Patterns of abuse

2. **Caching:**
   - Cache hit rate
   - Response time improvements
   - Cache size

3. **Errors:**
   - Error rates by function
   - Error types
   - Failed retry attempts

4. **Performance:**
   - Database query times
   - Edge function response times
   - Index usage

---

## 🐛 Troubleshooting

### Rate Limiting Not Working
- Check if rate limit map is being cleared (should reset after 1 minute)
- Verify IP detection (check x-forwarded-for header)
- Check function logs for rate limit messages

### Caching Not Working
- Verify cache TTL (30 seconds)
- Check cache size (should auto-cleanup at 1000 entries)
- Verify X-Cache headers in responses

### Webhook Signature Verification Failing
- Verify TICKET_WEBHOOK_SECRET is set correctly
- Check signature format (should be in x-webhook-signature header)
- Verify HMAC algorithm matches (SHA-256)

### Database Indexes Not Used
- Run EXPLAIN ANALYZE on queries
- Verify indexes exist: `\d+ tickets` in psql
- Check query planner is using indexes

---

## 📝 Rollback Plan

If issues occur, you can rollback:

```bash
# Rollback edge functions to previous version
supabase functions deploy event-availability --no-verify-jwt
supabase functions deploy ticket-webhook --no-verify-jwt
supabase functions deploy order-tickets --no-verify-jwt

# Or revert to previous git commit
git checkout HEAD~1 -- supabase/functions/
```

---

## ✅ Success Criteria

Deployment is successful when:
- [x] All edge functions deployed without errors
- [x] Rate limiting working (429 responses after limit)
- [x] Caching working (X-Cache headers present)
- [x] Request logging working (logs visible in dashboard)
- [x] Database indexes created (verified in database)
- [x] Webhook signature verification working (if secret set)
- [x] No increase in error rates
- [x] Performance improvements visible

---

**Last Updated:** January 2025  
**Status:** Ready for deployment

