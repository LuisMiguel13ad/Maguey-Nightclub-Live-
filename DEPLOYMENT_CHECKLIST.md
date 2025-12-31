# Production Deployment Checklist

Complete checklist for deploying all three sites to production.

---

## Pre-Deployment Phase

### 1. Code Readiness

- [ ] All code reviewed and approved
- [ ] All critical bugs fixed
- [ ] No console errors in production build
- [ ] No TypeScript errors
- [ ] Linting passes
- [ ] All tests pass (if implemented)
- [ ] Code formatted consistently

### 2. Database Readiness

- [ ] All migrations reviewed
- [ ] Migration order documented
- [ ] Backup strategy defined
- [ ] Rollback plan created
- [ ] Test data removed
- [ ] Seed data prepared (if needed)
- [ ] Admin account created

### 3. Environment Configuration

- [ ] All environment variables documented
- [ ] Production values prepared
- [ ] Secrets management plan
- [ ] `.env.example` files updated
- [ ] Environment validation script created

### 4. Third-Party Services

- [ ] Supabase project created
- [ ] Stripe account configured (live mode)
- [ ] Email provider account created
- [ ] Domain names purchased/configured
- [ ] SSL certificates ready
- [ ] Monitoring accounts created (Sentry, etc.)

---

## Configuration Phase

### 1. Supabase Setup

- [ ] Project created
- [ ] Database migrations executed
- [ ] RLS policies verified
- [ ] CORS origins configured
- [ ] OAuth redirect URLs configured
- [ ] Edge functions deployed
- [ ] Edge function secrets set
- [ ] Storage buckets configured (if needed)

### 2. Stripe Configuration

- [ ] Live API keys obtained
- [ ] Webhook endpoint configured
- [ ] Webhook events selected
- [ ] Webhook secret obtained
- [ ] Test mode verified
- [ ] Payment methods configured
- [ ] Refund policy configured

### 3. Email Service Setup

- [ ] Email provider account created
- [ ] Domain verified
- [ ] Sender email verified
- [ ] API key obtained
- [ ] Email templates created
- [ ] Test emails sent
- [ ] Spam testing done

### 4. Domain Configuration

- [ ] DNS records configured
- [ ] CNAME records pointing to Vercel
- [ ] SSL certificates provisioned
- [ ] Domain verification complete
- [ ] Subdomains configured:
  - [ ] yourclub.com
  - [ ] tickets.yourclub.com
  - [ ] scanner.yourclub.com

---

## Deployment Phase

### 1. maguey-nights Deployment

- [ ] Repository connected to Vercel
- [ ] Root directory set: `maguey-nights`
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Environment variables added:
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
  - [ ] VITE_PURCHASE_SITE_URL
  - [ ] VITE_APP_NAME
  - [ ] VITE_APP_URL
- [ ] Domain assigned
- [ ] Deployment successful
- [ ] Site accessible

### 2. maguey-pass-lounge Deployment

- [ ] Repository connected to Vercel
- [ ] Root directory set: `maguey-pass-lounge`
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Environment variables added:
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
  - [ ] VITE_STRIPE_PUBLISHABLE_KEY
  - [ ] VITE_API_URL
  - [ ] VITE_EMAIL_PROVIDER
  - [ ] VITE_EMAIL_API_KEY
  - [ ] VITE_EMAIL_FROM_ADDRESS
  - [ ] VITE_QR_SIGNING_SECRET
  - [ ] VITE_FRONTEND_URL
- [ ] Domain assigned
- [ ] Deployment successful
- [ ] Site accessible

### 3. maguey-gate-scanner Deployment

- [ ] Repository connected to Vercel
- [ ] Root directory set: `maguey-gate-scanner`
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Environment variables added:
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
  - [ ] VITE_SUPABASE_SERVICE_ROLE_KEY
  - [ ] VITE_QR_SIGNING_SECRET
  - [ ] VITE_TWILIO_ACCOUNT_SID
  - [ ] VITE_TWILIO_AUTH_TOKEN
  - [ ] VITE_TWILIO_PHONE_NUMBER
  - [ ] VITE_SENDGRID_API_KEY
  - [ ] VITE_SENDGRID_FROM_EMAIL
  - [ ] VITE_APP_NAME
  - [ ] VITE_APP_URL
- [ ] Domain assigned
- [ ] Deployment successful
- [ ] Site accessible

### 4. Edge Functions Deployment

- [ ] `create-checkout-session` deployed
- [ ] `stripe-webhook` deployed
- [ ] `check-availability` deployed
- [ ] `event-availability` deployed
- [ ] `ticket-webhook` deployed
- [ ] `order-tickets` deployed
- [ ] `unified-capacity` deployed
- [ ] Edge function secrets set:
  - [ ] STRIPE_WEBHOOK_SECRET
  - [ ] EMAIL_API_KEY
  - [ ] EMAIL_FROM_ADDRESS
  - [ ] QR_SIGNING_SECRET

---

## Post-Deployment Phase

### 1. Immediate Verification

- [ ] All three sites load correctly
- [ ] No console errors
- [ ] No network errors
- [ ] SSL certificates active
- [ ] Domains resolve correctly
- [ ] Environment variables loaded

### 2. Functional Verification

**maguey-nights:**
- [ ] Homepage displays
- [ ] Events load
- [ ] Navigation works
- [ ] Links to purchase site work

**maguey-pass-lounge:**
- [ ] Events load
- [ ] Authentication works
- [ ] Checkout form works
- [ ] Payment flow works (test mode)
- [ ] Email sending works

**maguey-gate-scanner:**
- [ ] Admin login works
- [ ] Scanner page loads
- [ ] QR scanning works
- [ ] Reports generate

### 3. Integration Verification

- [ ] Purchase → Scanner: Tickets appear
- [ ] Scanner → Purchase: Status updates
- [ ] Marketing → Purchase: Links work
- [ ] User identity shared across sites

### 4. Monitoring Setup

- [ ] Sentry configured and active
- [ ] Error tracking working
- [ ] Uptime monitors configured
- [ ] Performance monitoring active
- [ ] Log aggregation working
- [ ] Alerts configured

---

## Testing Phase

### 1. Smoke Tests

- [ ] All smoke tests pass (see TESTING_CHECKLIST.md)
- [ ] Critical flows work
- [ ] No critical errors

### 2. Payment Testing

- [ ] Test payment successful
- [ ] Webhook receives event
- [ ] Tickets created
- [ ] Email sent
- [ ] Order confirmation displayed

### 3. Scanner Testing

- [ ] Ticket scan works
- [ ] Validation works
- [ ] Check-in works
- [ ] Status updates

### 4. Email Testing

- [ ] Order confirmation sent
- [ ] Ticket email sent
- [ ] Emails arrive in inbox
- [ ] QR codes display correctly

---

## Monitoring Phase

### 1. First Hour

- [ ] Monitor error rates
- [ ] Monitor performance
- [ ] Check email delivery
- [ ] Verify payment processing
- [ ] Watch for critical errors

### 2. First Day

- [ ] Review error logs
- [ ] Review performance metrics
- [ ] Check user feedback
- [ ] Verify all systems operational
- [ ] Document any issues

### 3. First Week

- [ ] Weekly error review
- [ ] Performance analysis
- [ ] User feedback review
- [ ] Identify improvements
- [ ] Plan optimizations

---

## Rollback Plan

### If Critical Issues Found

1. **Immediate Actions:**
   - [ ] Identify issue severity
   - [ ] Notify team
   - [ ] Assess impact

2. **Rollback Decision:**
   - [ ] Determine if rollback needed
   - [ ] Choose rollback method:
     - [ ] Vercel deployment rollback
     - [ ] Database migration rollback
     - [ ] Feature flag disable

3. **Execute Rollback:**
   - [ ] Rollback deployment
   - [ ] Verify rollback successful
   - [ ] Test critical flows
   - [ ] Communicate to users

4. **Post-Rollback:**
   - [ ] Investigate root cause
   - [ ] Fix issues
   - [ ] Plan re-deployment
   - [ ] Update documentation

---

## Communication Plan

### Pre-Deployment

- [ ] Notify team of deployment
- [ ] Schedule deployment window
- [ ] Prepare status page (if needed)
- [ ] Prepare user communication (if needed)

### During Deployment

- [ ] Update team on progress
- [ ] Document any issues
- [ ] Keep stakeholders informed

### Post-Deployment

- [ ] Announce successful deployment
- [ ] Share monitoring dashboard
- [ ] Document any issues
- [ ] Plan follow-up

---

## Documentation Updates

- [ ] Update deployment guide
- [ ] Update environment setup guide
- [ ] Document any issues encountered
- [ ] Update troubleshooting guide
- [ ] Create runbook for common issues

---

## Sign-Off

### Technical Lead

- [ ] Code reviewed and approved
- [ ] All tests passed
- [ ] Deployment verified
- [ ] Monitoring configured

**Signature:** _________________ **Date:** _________

### Product Owner

- [ ] Features verified
- [ ] User flows tested
- [ ] Ready for users

**Signature:** _________________ **Date:** _________

### DevOps/Infrastructure

- [ ] Infrastructure ready
- [ ] Monitoring configured
- [ ] Rollback plan ready

**Signature:** _________________ **Date:** _________

---

## Post-Deployment Tasks

### Week 1

- [ ] Daily error review
- [ ] Performance monitoring
- [ ] User feedback collection
- [ ] Issue triage
- [ ] Quick wins implementation

### Week 2-4

- [ ] Weekly reviews
- [ ] Performance optimization
- [ ] Feature enhancements
- [ ] Documentation updates
- [ ] Team retrospective

---

## Success Criteria

Deployment considered successful when:

- [ ] All three sites accessible
- [ ] No critical errors
- [ ] Payment processing works
- [ ] Email delivery works
- [ ] Scanner functionality works
- [ ] Performance acceptable
- [ ] Monitoring active
- [ ] Team trained
- [ ] Documentation complete

---

## Emergency Contacts

**Technical Lead:**  
**Phone:** _____________  
**Email:** _____________

**DevOps:**  
**Phone:** _____________  
**Email:** _____________

**Product Owner:**  
**Phone:** _____________  
**Email:** _____________

**Stripe Support:** https://support.stripe.com  
**Supabase Support:** https://supabase.com/support  
**Vercel Support:** https://vercel.com/support

---

## Notes

Use this section to document:
- Issues encountered
- Solutions applied
- Lessons learned
- Improvements for next deployment

---

**Deployment Date:** _____________  
**Deployed By:** _____________  
**Version:** _____________
