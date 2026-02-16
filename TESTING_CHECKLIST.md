# Testing Checklist for Production Deployment

This document provides comprehensive testing checklists for all three sites before production deployment.

---

## Pre-Deployment Testing

### 1. Environment Validation

- [ ] All environment variables set correctly
- [ ] Supabase connection works
- [ ] Stripe keys configured (test mode)
- [ ] Email service configured
- [ ] CORS origins configured
- [ ] OAuth redirect URLs configured

### 2. Database Verification

- [ ] All migrations executed successfully
- [ ] RLS policies active
- [ ] Indexes created
- [ ] Test data removed
- [ ] Admin account created

---

## maguey-nights (Marketing Site) Testing

### Smoke Tests

- [ ] Homepage loads without errors
- [ ] Navigation menu works
- [ ] Events section displays events
- [ ] Event cards show correct information
- [ ] "Buy Tickets" links navigate to purchase site
- [ ] Footer links work
- [ ] Social media section displays
- [ ] Testimonials section displays
- [ ] Themed nights section displays
- [ ] Page is responsive on mobile

### Functional Tests

- [ ] Events load from Supabase
- [ ] Real-time updates work (if implemented)
- [ ] Loading states display correctly
- [ ] Error states display correctly
- [ ] No console errors
- [ ] No network errors

### Performance Tests

- [ ] Page loads in < 3 seconds
- [ ] Images load correctly
- [ ] No layout shift
- [ ] Smooth scrolling

---

## maguey-pass-lounge (Purchase Site) Testing

### Authentication Tests

- [ ] User can sign up with email/password
- [ ] User can sign in with email/password
- [ ] Social login works (Google, Facebook, Apple, GitHub)
- [ ] Password reset flow works
- [ ] Email verification works
- [ ] User session persists
- [ ] Protected routes redirect to login
- [ ] User can sign out

### Event Browsing Tests

- [ ] Events list loads
- [ ] Event detail page displays correctly
- [ ] Ticket types display correctly
- [ ] Availability shows correctly
- [ ] Sold out events show correctly
- [ ] Event filtering works (if implemented)
- [ ] Search works (if implemented)

### Checkout Flow Tests

- [ ] User can select tickets
- [ ] Quantity selector works
- [ ] Subtotal calculates correctly
- [ ] Service fees calculate correctly
- [ ] Total calculates correctly
- [ ] Promo code validation works
- [ ] Promo code applies discount correctly
- [ ] Form validation works
- [ ] User data pre-fills if logged in
- [ ] Checkout form submits correctly

### Payment Tests (After Implementation)

- [ ] Stripe checkout session creates
- [ ] Redirects to Stripe Checkout
- [ ] Payment processes successfully
- [ ] Payment success redirects correctly
- [ ] Payment failure handled correctly
- [ ] Order created in database
- [ ] Tickets generated correctly
- [ ] Email sent with tickets
- [ ] QR codes generated correctly

### Ticket Management Tests

- [ ] User can view their tickets
- [ ] Ticket details display correctly
- [ ] QR codes display correctly
- [ ] Ticket status updates correctly
- [ ] Expired tickets show correctly

### Profile Tests

- [ ] User can view profile
- [ ] User can update profile
- [ ] User can change password
- [ ] User can view order history

---

## maguey-gate-scanner (Admin/Scanner Site) Testing

### Authentication Tests

- [ ] Admin can sign in
- [ ] Staff can sign in
- [ ] Unauthorized users blocked
- [ ] Session management works
- [ ] Role-based access works

### Scanner Tests

- [ ] Scanner page loads
- [ ] QR code scanner activates
- [ ] Camera permission requested
- [ ] QR code scanning works
- [ ] Ticket lookup works
- [ ] Ticket details display correctly
- [ ] Event image displays
- [ ] Ticket validation works
- [ ] Invalid tickets rejected
- [ ] Used tickets detected
- [ ] Expired tickets detected
- [ ] Check-in works
- [ ] Status updates correctly
- [ ] Real-time sync works

### Event Management Tests

- [ ] Events list loads
- [ ] Can create new event
- [ ] Can edit event
- [ ] Can delete event
- [ ] Event details save correctly
- [ ] Ticket types configured correctly
- [ ] Capacity settings work
- [ ] Event status updates correctly

### Customer Management Tests

- [ ] Customer list loads
- [ ] Can search customers
- [ ] Can view customer details
- [ ] Can view customer tickets
- [ ] Can view customer orders

### Reporting Tests

- [ ] Reports page loads
- [ ] Can generate scan logs report
- [ ] Can generate revenue report
- [ ] Can generate staff performance report
- [ ] CSV export works
- [ ] PDF export works
- [ ] Excel export works
- [ ] Date filtering works
- [ ] Event filtering works

### Admin Functions Tests

- [ ] Staff management works
- [ ] Role assignment works
- [ ] Settings page works
- [ ] Audit logs display correctly

---

## Cross-Site Integration Tests

### Purchase → Scanner Flow

- [ ] Purchase ticket on purchase site
- [ ] Verify ticket appears in scanner immediately
- [ ] Scan ticket on scanner site
- [ ] Verify ticket details match
- [ ] Check in ticket
- [ ] Verify status updates on purchase site

### Marketing → Purchase Flow

- [ ] Click "Buy Tickets" on marketing site
- [ ] Verify navigation to purchase site
- [ ] Verify event ID passed correctly
- [ ] Verify correct event loads

### User Identity Flow

- [ ] Sign up on purchase site
- [ ] Verify can access account on purchase site
- [ ] Verify user data consistent
- [ ] Sign in on different device
- [ ] Verify session works

---

## Performance Testing

### Load Testing

- [ ] Homepage handles 100 concurrent users
- [ ] Checkout handles 50 concurrent checkouts
- [ ] Scanner handles 20 concurrent scans
- [ ] Database queries optimized
- [ ] No memory leaks
- [ ] No performance degradation over time

### Stress Testing

- [ ] System handles peak traffic
- [ ] Database handles high query volume
- [ ] API endpoints handle rate limits
- [ ] Error handling under load

---

## Security Testing

### Authentication Security

- [ ] Passwords hashed correctly
- [ ] Session tokens secure
- [ ] OAuth redirects secure
- [ ] CSRF protection works
- [ ] XSS protection works

### Data Security

- [ ] RLS policies enforced
- [ ] Service role key not exposed
- [ ] API keys not exposed
- [ ] Sensitive data encrypted
- [ ] SQL injection prevented

### Payment Security

- [ ] Stripe webhook signature verified
- [ ] Payment data not stored
- [ ] PCI compliance maintained
- [ ] Refund security verified

---

## Browser Compatibility Testing

### Desktop Browsers

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers

- [ ] iOS Safari
- [ ] Chrome Mobile
- [ ] Samsung Internet

### Responsive Design

- [ ] Mobile (< 768px)
- [ ] Tablet (768px - 1024px)
- [ ] Desktop (> 1024px)

---

## Error Handling Testing

### Network Errors

- [ ] Handles network timeout
- [ ] Handles network disconnection
- [ ] Retries failed requests
- [ ] Shows user-friendly errors

### API Errors

- [ ] Handles 400 errors
- [ ] Handles 401 errors
- [ ] Handles 404 errors
- [ ] Handles 500 errors
- [ ] Shows appropriate error messages

### Validation Errors

- [ ] Form validation works
- [ ] Error messages display
- [ ] Invalid input rejected
- [ ] User can correct errors

---

## Email Testing

### Email Delivery

- [ ] Order confirmation emails sent
- [ ] Ticket emails sent
- [ ] Password reset emails sent
- [ ] Email verification emails sent
- [ ] Emails arrive in inbox (not spam)
- [ ] Email content correct
- [ ] QR codes display in emails

### Email Templates

- [ ] Order confirmation template correct
- [ ] Ticket email template correct
- [ ] All links in emails work
- [ ] Email formatting correct
- [ ] Mobile email rendering correct

---

## Monitoring & Logging Tests

### Error Tracking

- [ ] Errors logged to Sentry
- [ ] Error context captured
- [ ] User information captured
- [ ] Stack traces captured

### Performance Monitoring

- [ ] Page load times tracked
- [ ] API response times tracked
- [ ] Database query times tracked
- [ ] Performance metrics visible

### Uptime Monitoring

- [ ] Uptime monitors configured
- [ ] Alerts sent on downtime
- [ ] Recovery notifications sent

---

## Post-Deployment Testing

### Immediate Checks

- [ ] All sites accessible
- [ ] No critical errors in logs
- [ ] Monitoring active
- [ ] Emails sending
- [ ] Payments processing

### First 24 Hours

- [ ] Monitor error rates
- [ ] Monitor performance
- [ ] Check email delivery rates
- [ ] Verify payment success rates
- [ ] Check user feedback

### First Week

- [ ] Review error logs
- [ ] Review performance metrics
- [ ] Gather user feedback
- [ ] Identify issues
- [ ] Plan improvements

---

## Test Data Cleanup

After testing:

- [ ] Remove test orders
- [ ] Remove test tickets
- [ ] Remove test users (except admin)
- [ ] Remove test events (if any)
- [ ] Clean up test data

---

## Sign-Off Checklist

Before going live:

- [ ] All critical tests passed
- [ ] All high-priority tests passed
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Monitoring configured
- [ ] Team trained
- [ ] Documentation complete
- [ ] Rollback plan ready

---

## Test Execution Log

Document test execution:

| Test | Date | Tester | Result | Notes |
|------|------|--------|--------|-------|
| Homepage load | | | | |
| Checkout flow | | | | |
| Scanner scan | | | | |
| ... | | | | |

---

## Automated Testing (Future)

Consider implementing:

- [ ] Unit tests (Vitest)
- [ ] Component tests (React Testing Library)
- [ ] E2E tests (Playwright)
- [ ] API tests
- [ ] Visual regression tests
- [ ] Performance tests (Lighthouse CI)

---

## Resources

- [Playwright Documentation](https://playwright.dev)
- [React Testing Library](https://testing-library.com/react)
- [Vitest Documentation](https://vitest.dev)
- [Sentry Testing Guide](https://docs.sentry.io/product/testing)
