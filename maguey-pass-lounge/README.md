# Maguey Pass Lounge – Ticketing Frontend

React + Vite single-page application that powers the Maguey nightclub ticket purchase experience, checkout, and promoter dashboard. This repo only contains the frontend; Supabase, Stripe, webhooks, and email services are integrated via environment variables and external services.

## Tech Stack

- React 18 + TypeScript
- Vite build tooling
- Tailwind CSS + shadcn/ui components
- Supabase client SDK (events, orders, tickets)
- Stripe JS helper (checkout session redirect)
- React Router & React Query

## Local Development

```bash
pnpm install   # or npm install / yarn install
pnpm run dev   # starts Vite on http://localhost:5173 by default
```

Create a `.env` file (or copy from `.env.example`) before starting the dev server.

## Required Environment Variables

These are the frontend-facing values that must exist in every environment:

| Key | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key used by the browser |
| `VITE_QR_SIGNING_SECRET` | HMAC secret for signing ticket QR payloads (must match scanner/backend) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for Checkout |
| `VITE_API_URL` | Base URL to your backend API (used for checkout session creation, etc.) |
| `VITE_EMAIL_PROVIDER` | Identifier for your email provider (e.g. sendgrid, resend) |
| `VITE_EMAIL_API_KEY` | API key for sending transactional emails (used later in resend/refund flows) |
| `VITE_EMAIL_FROM_ADDRESS` | Default "from" address for ticket emails |
| `VITE_FRONTEND_URL` | Public URL of this frontend (used in emails/runbook) |
| `VITE_APP_BASE_PATH` | Optional. Set when deploying under a subfolder (`/tickets`). Default `/`. |
| `VITE_SCANNER_API_URL` | Optional. Base URL to scanner website API for real-time availability checks (e.g., `https://scanner-api.com`) |

See `.env.example` for placeholder values you can copy.

## Production Builds

```bash
pnpm run build   # generates production bundle in dist/
pnpm run preview # serve the production build locally
```

## Deployment Guides

### Vercel

1. Import the repository into Vercel.
2. Set the environment variables listed above in **Project Settings → Environment Variables**.
3. Optional: copy `vercel.json` (or `vercel.example.json`) into the project and adjust:
   - `rewrites` → point to your backend API domain if you proxy `/api/*`.
   - `env` → replace the `@` secrets with the names you create in Vercel.
   - Remove the file if you prefer the Vercel dashboard configuration.
4. Build command: `npm run build` (already in `package.json`)
5. Output directory: `dist`

Deploying with Vercel CLI:

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Netlify

1. Create a new site from Git in Netlify.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add the environment variables from the table above under **Site Settings → Build & deploy → Environment**.
5. If you deploy under a subpath, set `VITE_APP_BASE_PATH` accordingly and update any Netlify redirects/rewrites.

Optional example for `netlify.toml` (create if needed):

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "https://your-backend.example.com/api/:splat"
  status = 200
```

### Static Hosting (S3/CloudFront, etc.)

- Run `npm run build`
- Upload the `dist/` directory
- Configure your hosting provider for single-page apps (all routes rewrite to `/index.html`)
- Make sure environment variables are inlined at build time

## Deployment Runbook

1. **Pre-flight checklist**
   - Apply Supabase migrations: `supabase db push` (includes ticket security columns and RLS policies).
   - Verify promoter/scanner roles exist in Supabase (`app_metadata.role` set via Admin API).
   - Confirm `.env` is populated with the variables listed above (including `VITE_FRONTEND_URL`).
2. **Backend readiness**
   - Expose a backend API that serves `/api/create-checkout-session`, `/orders/:id/refund`, and `/api/stripe/webhook`.
   - Set `STRIPE_WEBHOOK_SECRET` and Stripe secret key on the backend.
   - In Stripe dashboard, create a webhook pointing to `https://your-backend.example.com/api/stripe/webhook` listening for `checkout.session.completed`.
3. **Vercel deployment**
   - Import the Git repo, set build command `npm run build`, output `dist`.
   - Add environment variables (Supabase, Stripe, QR secret, email provider, backend URL, frontend URL).
   - Ensure `vercel.json` rewrite routes `/api/*` to your backend host.
   - Run `vercel --prod` or trigger CI.
4. **Netlify deployment** (if applicable)
   - Build command `npm run build`, publish `dist`.
   - Configure the same environment variables and add redirects in `netlify.toml`.
5. **Post-deploy verification**
   - Hit `/health` or homepage to confirm build.
   - Create a test checkout, verify tickets are issued and email is sent to the configured address.
   - Scan the QR with the scanner app to ensure status updates succeed.

### Secret rotation & QR signing

- To rotate `VITE_QR_SIGNING_SECRET`:
  1. Generate a new random string (at least 32 characters).
  2. Update the value in frontend `.env`, backend secrets, and scanner `.env`.
  3. Redeploy frontend and backend, release an updated scanner build.
  4. Optionally invalidate older tickets (or continue accepting existing signatures until migration completes).
- Rotate Stripe keys and email provider keys directly in Vercel/Netlify settings; redeploy after updating `.env.example` so future developers inherit the changes.

## Vite Configuration Notes

`vite.config.ts` now respects an optional `VITE_APP_BASE_PATH`. During production builds the `base` option is set to that value, allowing you to deploy the SPA under a subdirectory (`/tickets`, `/app`, etc.). Leave it unset or `/` for root deployments.

## Webhook & Backend TODOs

- **Checkout Webhooks**: Stripe fulfillment webhook (e.g., `/api/stripe/webhook`) still needs to be implemented on your backend. Document the chosen path in your API server before going live.
- **Ticket issuance API**: Frontend calls to create orders currently expect a backend endpoint (`POST /api/create-checkout-session`) which must be hosted separately.
- **Email delivery**: `resendTicket`/`requestRefund` stubs should call your email service. Configure credentials once the backend is ready.

## Supabase & Auth Setup

- Run the SQL migrations in `supabase/migrations/` (schema + RLS + promotions).
- Ensure Supabase Auth `app_metadata.role` is set to `promoter` for dashboard access.
- See `DATABASE_SETUP.md` for detailed instructions and role management.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start Vite development server |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview the production build locally |

## Troubleshooting

- If QR signing fails, double-check `VITE_QR_SIGNING_SECRET` is identical between frontend, backend, and scanner app.
- 404s on deep links usually mean the hosting platform isn’t rewriting to `index.html`; configure rewrites/redirects accordingly.
- Demo login (`demo@maguey.com` / `demo1234`) only works when Supabase env vars are missing (pure demo mode). In production you must use real Supabase auth users.

## Testing

- Unit tests: `npm run test` (Vitest)
- Playwright E2E tests:  
  1. Install browsers once: `npx playwright install`  
  2. Run suite: `npx playwright test`  
  The config spins up `npm run dev` automatically and runs tests against `http://localhost:5173`.
