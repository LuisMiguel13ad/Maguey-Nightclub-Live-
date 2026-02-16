# Technology Stack

**Analysis Date:** 2026-01-29

## Languages

**Primary:**
- TypeScript 5.8.3 - All frontend applications use ES modules with strict typing
- TSX/JSX - React component development across all three apps

## Runtime

**Environment:**
- Node.js >= 20.0.0 (required for development)
- npm >= 10.0.0 (package manager)
- Deno (server-side, used in Supabase Edge Functions)

**Package Manager:**
- npm with lockfiles for all projects
- Lockfile: `package-lock.json` present in root and all three apps

## Frameworks

**Core UI:**
- React 18.3.1 - All three web applications
- React Router 6.30.1 - Client-side routing (gate-scanner, pass-lounge, nights)
- Vite 5.4.19 - Build tool and dev server across all projects

**Component Library:**
- Radix UI - Headless component primitives (extensive suite of ~30 components)
- shadcn/ui patterns - Built on Radix UI for consistent UI design

**Form Management:**
- React Hook Form 7.61.1 - Form state and validation
- Zod 3.25.76 - Schema validation
- @hookform/resolvers 3.10.0 - Integration layer

**Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- tailwindcss-animate 1.0.7 - Animation utilities
- tailwind-merge 2.6.0 - Merge Tailwind classes
- PostCSS 8.5.6 - CSS transformation
- Autoprefixer 10.4.21 - Browser vendor prefixes

**Testing:**
- Vitest 2.1.8 - Unit and integration test runner (maguey-pass-lounge, maguey-gate-scanner)
- @testing-library/react 16.1.0 - React component testing
- @testing-library/jest-dom 6.6.3 - DOM matchers
- @testing-library/user-event 14.6.1 - User interaction simulation
- @playwright/test 1.45.3 - E2E testing (maguey-pass-lounge)

**Build/Dev:**
- @vitejs/plugin-react-swc 3.11.0 - SWC-based React plugin for fast compilation
- ESLint 9.32.0 - Linting
- @typescript-eslint 8.38.0 - TypeScript ESLint support
- eslint-plugin-react-hooks 5.2.0 - React Hooks rules
- eslint-plugin-react-refresh 0.4.20 - Fast Refresh support

## Key Dependencies

**Critical - Payment Processing:**
- @stripe/stripe-js 8.3.0 (pass-lounge), 4.4.0 (nights) - Stripe client SDK
- @stripe/react-stripe-js 5.4.1 (pass-lounge), 2.4.0 (nights) - React Stripe integration
- stripe 20.0.0 (pass-lounge) - Server-side Stripe SDK (used in Edge Functions)

**Critical - Database/Backend:**
- @supabase/supabase-js 2.78.0 (all projects) - Supabase client for PostgreSQL database
- firebase-admin 13.6.0 (gate-scanner) - Firebase Admin SDK for server-side operations

**QR Code & Scanning:**
- qrcode 1.5.4 - QR code generation
- qrcode.react 4.2.0 - React QR code component
- react-qr-code 2.0.18 - Alternative QR component
- html5-qrcode 2.3.8 (gate-scanner) - Browser-based QR scanning
- @noble/hashes 1.8.0 - Cryptographic hashing (signature verification)

**UI Components & Animation:**
- framer-motion 12.23.24 (pass-lounge, nights) - Animation library
- embla-carousel-react 8.6.0 - Carousel component
- react-easy-crop 5.5.3 (pass-lounge) - Image cropping
- react-colorful 5.6.1 (gate-scanner) - Color picker
- react-resizable-panels 2.1.9 - Resizable panel layout
- three 0.182.0 (pass-lounge), 0.160.0 (nights) - 3D graphics library
- @react-three/fiber 8.15.19 (nights) - React renderer for Three.js
- @react-three/drei 9.88.17 (nights) - Useful helpers for React Three Fiber
- vanta 0.5.24 (nights) - Background effects
- lucide-react 0.462.0 - Icon library

**Data & State Management:**
- @tanstack/react-query 5.83.0 - Server state management and caching
- sonner 1.7.4 - Toast notifications
- recharts 2.15.4 - Charts and graphs

**Utilities:**
- date-fns 3.6.0 - Date manipulation
- libphonenumber-js 1.12.27 - Phone number validation
- simplex-noise 4.0.3 (pass-lounge) - Noise generation
- lodash-es 4.17.21 (nights) - Utility functions
- next-themes 0.3.0 - Dark mode support
- input-otp 1.4.2 - OTP input component
- cmdk 1.1.1 - Command menu
- class-variance-authority 0.7.1 - Component variants
- clsx 2.1.1 - Conditional className builder
- vaul 0.9.9 - Drawer component

**Email & Notifications:**
- resend 6.4.2 (pass-lounge) - Email sending service
- @sendgrid/mail 8.1.6 (gate-scanner) - SendGrid email SDK
- twilio 5.10.5 (gate-scanner) - SMS and communications

**Monitoring & Error Tracking:**
- @sentry/react 10.32.0 (pass-lounge) - Error tracking and performance monitoring
- react-ga4 2.1.0 (pass-lounge, nights) - Google Analytics 4 integration

**PDF & Document Generation:**
- jspdf 3.0.3 (pass-lounge), 2.5.2 (nights) - PDF generation
- html2canvas 1.4.1 (pass-lounge) - HTML to canvas (for PDF screenshots)

**Data Processing & Storage:**
- papaparse 5.5.3 (gate-scanner) - CSV parsing
- xlsx 0.18.5 (gate-scanner) - Excel file handling
- dexie 4.2.1 (gate-scanner) - IndexedDB wrapper for offline data

**Rich Text Editing:**
- @tiptap/starter-kit 3.10.8 (gate-scanner) - WYSIWYG editor
- @tiptap/react 3.10.8 (gate-scanner) - React integration
- @tiptap/extension-image 3.10.8 (gate-scanner) - Image extension

**File Handling:**
- react-dropzone 14.3.8 (gate-scanner) - Drag-drop file upload

**Development Utilities:**
- dotenv 17.2.3 - Environment variable loading
- tsx 4.20.6 - TypeScript execution
- jsdom 25.0.1 - DOM implementation for testing
- lovable-tagger 1.1.11 - Component tagging utility
- @vitejs/plugin-basic-ssl 1.1.0 (root) - HTTPS for local dev

## Configuration

**Environment:**
- Vite environment variables with VITE_ prefix for client-side exposure
- .env files at project roots: `maguey-pass-lounge/.env`, `maguey-gate-scanner/.env`, `maguey-nights/.env`
- Critical configs:
  - `VITE_SUPABASE_URL` - Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
  - `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe public key
  - `VITE_EMAIL_API_KEY` - Resend or SendGrid API key
  - `VITE_QR_SIGNING_SECRET` - HMAC secret for QR code signing
  - `VITE_GA_MEASUREMENT_ID` - Google Analytics measurement ID

**Build:**
- Vite config: `vite.config.ts` (Vite 5 with SWC React plugin)
- TypeScript configs: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- ESLint config: `eslint.config.js`
- PostCSS config: `postcss.config.js`
- Tailwind config: `tailwind.config.ts`
- Vitest config: `vitest.config.ts` (maguey-pass-lounge only)
- Playwright config: `playwright.config.ts` (maguey-pass-lounge only)

## Platform Requirements

**Development:**
- Node.js >= 20.0.0
- npm >= 10.0.0
- Modern browser with WebGL support (for Three.js backgrounds)
- HTTPS for local dev (provided by Vite SSL plugin)

**Production:**
- Deployment to Vercel, Netlify, or similar Node-compatible platform
- Supabase PostgreSQL database (cloud or self-hosted)
- Stripe account with API keys
- Email service (Resend or SendGrid) for transactional emails
- Optional: Sentry account for error tracking
- Optional: Firebase project for admin operations
- Optional: Google Analytics account

---

*Stack analysis: 2026-01-29*
