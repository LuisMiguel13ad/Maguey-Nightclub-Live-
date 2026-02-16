# 🚀 Quick Test Reference Card

## Test Credentials
- **Email:** `demo@maguey.com`
- **Password:** `demo1234`
- **Stripe Test Card:** `4242 4242 4242 4242`

## Event Details
- **Name:** `PRE THANKSGIVING BASH`
- **Date:** `2025-11-26`
- **Time:** `21:00`
- **Venue:** `Maguey Delaware`

## Ticket Types
1. Women - Before 10 PM: $0.00 (200 capacity)
2. Men - Before 10 PM: $35.00 (300 capacity)
3. General Admission - After 10 PM: $50.00 (200 capacity)

## URLs
- **Dashboard:** http://localhost:5175/dashboard
- **Events:** http://localhost:5175/events
- **Scanner:** http://localhost:5175/scanner
- **Main Site:** http://localhost:3000
- **Purchase Site:** http://localhost:5173
- **Purchase Login:** http://localhost:5173/login

## Quick Test Flow
1. Create event → Dashboard `/events`
2. Verify on sites → Main & Purchase sites
3. Buy ticket → Purchase site (login first)
4. Check dashboard → Recent Purchases
5. Scan ticket → Scanner page
6. Verify scan → Activity Feed

## Screenshots Needed (21 total)
See `COMPLETE_EVENT_TEST_GUIDE.md` for full list

## Run Verification Script
```bash
cd maguey-gate-scanner
npx tsx test-complete-event-flow.ts
```

