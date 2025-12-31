# Three-Site Ticketing System Architecture

**Generated:** December 9, 2025  
**Purpose:** System Architecture Review

---

## Overview

This is a three-site ticketing system for a nightclub, all connected via a shared Supabase database:

1. **maguey-nights** - Marketing/Public Website (event listing, redirects to purchase)
2. **maguey-pass-lounge** - Ticket Purchase Website (checkout, authentication, ticket delivery)
3. **maguey-gate-scanner** - Admin/Scanner Website (ticket scanning, event management, reporting)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SHARED SUPABASE DATABASE                         │
│                       (Single Source of Truth)                          │
│                                                                         │
│  Tables: events, orders, tickets, payments, ticket_types, scan_logs    │
│  Edge Functions: ticket-webhook, event-availability, check-availability │
└─────────────────────────────────────────────────────────────────────────┘
           ▲                    ▲                    ▲
           │                    │                    │
    ┌──────┴──────┐     ┌──────┴──────┐     ┌──────┴──────┐
    │maguey-nights│     │maguey-pass- │     │maguey-gate- │
    │  (Marketing)│     │   lounge    │     │   scanner   │
    │   READ-ONLY │     │ (Purchase)  │     │  (Admin)    │
    └─────────────┘     └─────────────┘     └─────────────┘
```

---

## 1. File Structure

### maguey-nights (Marketing Site)
```
src/
├── admin/
│   └── EventManager.tsx
├── api/
│   ├── checkout.ts
│   └── ticketValidation.ts
├── components/
│   ├── CinemaArchiveCarousel.tsx
│   ├── EventCalendar.tsx
│   ├── EventCard.tsx
│   ├── Footer.tsx
│   ├── GoogleAnalytics.tsx
│   ├── Hero.tsx
│   ├── InstagramFeed.tsx
│   ├── Navigation.tsx
│   ├── ScrollAnimation.tsx
│   ├── TicketGenerator.tsx
│   ├── VenueCard.tsx
│   └── ui/                    # shadcn/ui components
├── data/
│   └── events.ts
├── hooks/
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   └── useEvents.ts
├── lib/
│   ├── purchaseSiteConfig.ts  # Cross-site URL configuration
│   ├── supabase.ts            # Supabase client
│   └── utils.ts
├── pages/
│   ├── Index.tsx              # Homepage with events
│   ├── AboutUs.tsx
│   ├── Checkout.tsx
│   ├── Contact.tsx
│   ├── EventPage.tsx
│   ├── Gallery.tsx
│   ├── Restaurant.tsx
│   ├── RestaurantMenu.tsx
│   ├── TicketScanner.tsx
│   └── UpcomingEvents.tsx
├── services/
│   ├── adminService.ts
│   ├── emailService.ts
│   ├── eventService.ts
│   ├── inventoryService.ts
│   └── ticketScannerService.ts
├── App.tsx
└── main.tsx
```

### maguey-pass-lounge (Purchase Site)
```
src/
├── components/
│   ├── admin/
│   │   └── AdminSidebar.tsx
│   ├── auth/
│   │   ├── ActivityLogTable.tsx
│   │   ├── AvatarUpload.tsx
│   │   ├── BiometricPrompt.tsx
│   │   ├── EmailVerificationBanner.tsx
│   │   ├── MagicLinkButton.tsx
│   │   ├── PasswordStrengthMeter.tsx
│   │   ├── ProgressiveSignupWizard.tsx
│   │   └── ReferralCodeInput.tsx
│   ├── scanner/
│   │   └── ScannerTicketDisplay.tsx
│   ├── AuthButton.tsx
│   ├── ErrorBoundary.tsx
│   ├── EventHeroSlider.tsx
│   ├── ProtectedRoute.tsx
│   ├── WaitlistForm.tsx
│   └── ui/                    # shadcn/ui components
├── contexts/
│   └── AuthContext.tsx        # Authentication state management
├── data/
│   └── events.ts
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   ├── biometric-auth.ts
│   ├── csv.ts
│   ├── email-template.ts
│   ├── events-service.ts      # Event fetching & availability
│   ├── loyalty-service.ts
│   ├── orders-service.ts      # ORDER CREATION LOGIC
│   ├── organizer-service.ts
│   ├── password-breach.ts
│   ├── promotions-service.ts
│   ├── scanner-service.ts
│   ├── stripe.ts
│   ├── supabase.ts            # Supabase client + types
│   ├── ticket-generator.ts    # QR code generation
│   ├── waitlist-service.ts
│   └── utils.ts
├── pages/
│   ├── admin/
│   │   ├── AdminDashboard.tsx
│   │   ├── DashboardHome.tsx
│   │   ├── OrdersList.tsx
│   │   ├── Reports.tsx
│   │   └── TicketList.tsx
│   ├── Checkout.tsx           # Main checkout page
│   ├── CheckoutSuccess.tsx
│   ├── EventDetail.tsx
│   ├── Events.tsx
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── Profile.tsx
│   ├── Ticket.tsx             # Ticket display page
│   └── ForgotPassword.tsx
├── App.tsx
└── main.tsx

supabase/
├── functions/
│   ├── stripe-webhook/
│   │   └── index.ts           # Stripe webhook handler
│   └── check-availability/
│       └── index.ts
└── migrations/
    ├── 20250115000000_create_ticket_system.sql
    ├── 20250201000000_add_rls_policies.sql
    └── ... (16 migration files)
```

### maguey-gate-scanner (Admin/Scanner Site)
```
src/
├── components/
│   ├── ActivityFeed.tsx
│   ├── EventSelector.tsx
│   ├── QRScanner.tsx
│   ├── ScanResult.tsx
│   ├── StaffList.tsx
│   ├── TicketDetails.tsx
│   └── ui/                    # shadcn/ui components
├── contexts/
│   ├── AuthContext.tsx
│   └── BrandingContext.tsx
├── hooks/
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   └── useUserManagement.ts
├── integrations/
│   └── supabase/
│       ├── client.ts          # Supabase client
│       └── types.ts           # Generated TypeScript types
├── lib/
│   ├── analytics-service.ts
│   ├── audit-service.ts
│   ├── batch-scan-service.ts
│   ├── capacity-service.ts
│   ├── cross-site-sync.ts     # Cross-site synchronization
│   ├── email-service.ts
│   ├── error-tracking.ts
│   ├── fraud-detection-service.ts
│   ├── id-verification-service.ts
│   ├── nfc-service.ts
│   ├── notification-service.ts
│   ├── offline-queue-service.ts
│   ├── photo-capture-service.ts
│   ├── purchase-site-integration.ts
│   ├── queue-management-service.ts
│   ├── re-entry-service.ts
│   ├── realtime-sync-service.ts
│   ├── refund-service.ts
│   ├── report-service.ts
│   ├── retry.ts               # Retry logic utility
│   ├── scanner-service.ts     # TICKET SCANNING LOGIC
│   ├── shift-service.ts
│   ├── supabase.ts
│   ├── tier-service.ts
│   ├── transfer-service.ts
│   └── waitlist-service.ts
├── pages/
│   ├── AdvancedAnalytics.tsx
│   ├── AuditLog.tsx
│   ├── Auth.tsx
│   ├── CustomerManagement.tsx
│   ├── Dashboard.tsx
│   ├── DeviceManagement.tsx
│   ├── EventManagement.tsx
│   ├── QueueManagement.tsx
│   ├── Scanner.tsx            # Main scanner page
│   ├── StaffScheduling.tsx
│   ├── TeamManagement.tsx
│   └── WaitlistManagement.tsx
├── App.tsx
└── main.tsx

supabase/
├── functions/
│   ├── ticket-webhook/
│   │   └── index.ts           # Ticket creation webhook
│   ├── event-availability/
│   │   └── index.ts
│   ├── order-tickets/
│   │   └── index.ts
│   └── unified-capacity/
│       └── index.ts
└── migrations/
    ├── 20250115000000_ticket_system_integration.sql
    ├── 20250116000000_add_scanner_columns.sql
    └── ... (38 migration files)
```

---

## 2. Database Schema

### Core Tables (SQL Schema)

```sql
-- ============================================
-- EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  genre VARCHAR,
  image_url VARCHAR NOT NULL,
  venue_name VARCHAR NOT NULL,
  venue_address VARCHAR NOT NULL,
  city VARCHAR,
  description TEXT,
  status VARCHAR DEFAULT 'draft',  -- draft, published, archived
  is_active BOOLEAN DEFAULT true,
  venue_capacity INTEGER,
  ticket_types JSONB,  -- For legacy compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TICKET_TYPES TABLE (Normalized)
-- ============================================
CREATE TABLE IF NOT EXISTS ticket_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id VARCHAR NOT NULL REFERENCES events(id),
  code VARCHAR NOT NULL,           -- 'GA', 'VIP', etc.
  name VARCHAR NOT NULL,           -- 'General Admission', 'VIP Entry'
  price DECIMAL(10, 2) NOT NULL,
  fee DECIMAL(10, 2) DEFAULT 0,
  limit_per_order INTEGER DEFAULT 10,
  total_inventory INTEGER,         -- NULL = unlimited
  description TEXT,
  category VARCHAR DEFAULT 'general',  -- general, vip, service, section
  section_name VARCHAR,
  section_description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  event_id VARCHAR NOT NULL REFERENCES events(id),
  purchaser_email VARCHAR NOT NULL,
  purchaser_name VARCHAR,
  purchaser_phone VARCHAR,
  subtotal DECIMAL(10, 2) NOT NULL,
  fees_total DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',  -- pending, paid, cancelled, refunded
  payment_provider VARCHAR,
  payment_reference VARCHAR,
  stripe_payment_intent_id VARCHAR,
  stripe_session_id VARCHAR,
  promo_code_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TICKETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id VARCHAR UNIQUE NOT NULL,  -- Human-readable: MGY-PF-20251115-ABC123
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_id VARCHAR NOT NULL REFERENCES events(id),
  ticket_type_id UUID REFERENCES ticket_types(id),
  
  -- Attendee info
  attendee_name VARCHAR,
  attendee_email VARCHAR,
  
  -- QR Code security
  qr_token UUID UNIQUE NOT NULL,      -- Scanner searches by THIS (UUID)
  qr_signature VARCHAR NOT NULL,       -- HMAC signature
  qr_code_url TEXT,                    -- Base64 QR image
  qr_code_value VARCHAR,               -- Legacy field
  
  -- NFC support
  nfc_tag_id VARCHAR,
  nfc_signature VARCHAR,
  
  -- Status & tracking
  status VARCHAR NOT NULL DEFAULT 'issued',  -- issued, scanned, used, expired, cancelled
  is_used BOOLEAN DEFAULT false,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scanned_at TIMESTAMP WITH TIME ZONE,
  scanned_by VARCHAR,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Pricing
  price DECIMAL(10, 2) NOT NULL,
  fee_total DECIMAL(10, 2) DEFAULT 0,
  
  -- Photo capture (scanner feature)
  photo_url VARCHAR,
  photo_captured_at TIMESTAMP WITH TIME ZONE,
  photo_captured_by VARCHAR,
  photo_consent BOOLEAN,
  
  -- Tier for VIP handling
  tier VARCHAR,
  
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR UNIQUE NOT NULL,
  stripe_charge_id VARCHAR,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR DEFAULT 'usd',
  status VARCHAR NOT NULL,  -- succeeded, failed, refunded, pending
  refund_amount DECIMAL(10, 2) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SCAN_LOGS TABLE (Scanner Site)
-- ============================================
CREATE TABLE IF NOT EXISTS scan_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id),
  scan_result VARCHAR NOT NULL,        -- valid, invalid, used, expired
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scanned_by VARCHAR,
  scan_duration_ms INTEGER,
  scan_method VARCHAR,                 -- qr, nfc, manual
  override_used BOOLEAN DEFAULT false,
  override_reason VARCHAR,
  metadata JSONB
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_tickets_qr_token ON tickets(qr_token);
CREATE INDEX idx_tickets_ticket_id ON tickets(ticket_id);
CREATE INDEX idx_tickets_order_id ON tickets(order_id);
CREATE INDEX idx_tickets_event_id ON tickets(event_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_orders_event_id ON orders(event_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_email ON orders(purchaser_email);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_status ON events(status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;

-- Events: Public read access
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT USING (true);

-- Orders: Users see own orders, service role sees all
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid()::text = purchaser_email OR auth.role() = 'service_role');

-- Tickets: Users see own tickets, service role sees all
CREATE POLICY "Users can view their own tickets"
  ON tickets FOR SELECT
  USING (attendee_email = auth.jwt()->>'email' OR auth.role() = 'service_role');

-- Scan logs: Authenticated users (staff) can read/write
CREATE POLICY "Staff can manage scan logs"
  ON scan_logs FOR ALL
  TO authenticated USING (true);
```

---

## 3. TypeScript Types

### maguey-pass-lounge/src/lib/supabase.ts (Core Types)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Event = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  genre: string | null
  venue_name: string | null
  venue_address: string | null
  city: string | null
  event_date: string
  event_time: string
  status?: 'draft' | 'published' | 'archived' | null
  created_at: string
  updated_at: string
}

export type TicketType = {
  id: string
  event_id: string
  code: string
  name: string
  price: number
  fee: number
  limit_per_order: number
  total_inventory: number | null
  description: string | null
  category: 'general' | 'vip' | 'service' | 'section'
  section_name: string | null
  section_description: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export type Order = {
  id: string
  user_id: string | null
  purchaser_email: string
  purchaser_name: string | null
  event_id: string
  subtotal: number
  fees_total: number
  total: number
  payment_provider: string | null
  payment_reference: string | null
  status: string
  created_at: string
  updated_at: string
}

export type Ticket = {
  id: string
  order_id: string
  ticket_type_id: string
  event_id: string
  attendee_name: string
  attendee_email: string | null
  seat_label: string | null
  qr_code_value: string | null
  qr_token: string
  qr_signature: string
  qr_code_url: string | null
  price: number
  fee_total: number
  status: string
  issued_at: string
  scanned_at: string | null
  created_at: string
  updated_at: string
  metadata: Record<string, unknown> | null
}
```

### maguey-gate-scanner/src/integrations/supabase/types.ts (Generated Types)

```typescript
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      scan_logs: {
        Row: {
          id: string
          metadata: Json | null
          scan_result: string
          scanned_at: string
          scanned_by: string | null
          ticket_id: string | null
          scan_duration_ms: number | null
          scan_method: string | null
          override_used: boolean | null
          override_reason: string | null
        }
        Insert: { /* ... */ }
        Update: { /* ... */ }
        Relationships: [
          {
            foreignKeyName: "scan_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          }
        ]
      }
      tickets: {
        Row: {
          created_at: string
          event_name: string
          guest_email: string | null
          guest_name: string | null
          id: string
          is_used: boolean
          issued_at: string | null
          metadata: Json | null
          nfc_signature: string | null
          nfc_tag_id: string | null
          order_id: string | null
          qr_signature: string | null
          qr_token: string | null
          purchase_date: string
          scanned_at: string | null
          scanned_by: string | null
          status: string | null
          ticket_id: string
          ticket_type: string
          tier: string | null
          photo_url: string | null
          photo_captured_at: string | null
        }
        Insert: { /* ... */ }
        Update: { /* ... */ }
      }
      ticket_tiers: {
        Row: {
          id: string
          name: string
          color: string
          sound_profile: string
          perks_description: string | null
          priority_level: number
          is_active: boolean
        }
      }
      emergency_override_logs: {
        Row: {
          id: string
          ticket_id: string | null
          user_id: string | null
          override_type: string
          reason: string
          notes: string | null
        }
      }
      scanner_devices: {
        Row: {
          id: string
          device_id: string
          device_name: string | null
          battery_level: number | null
          is_online: boolean
          last_seen: string
        }
      }
    }
    Functions: {
      get_tier_info: {
        Args: { tier_name: string }
        Returns: { id: string; name: string; color: string; /* ... */ }[]
      }
      get_override_stats: {
        Args: { start_date?: string; end_date?: string }
        Returns: { total_overrides: number; /* ... */ }[]
      }
    }
  }
}
```

---

## 4. Key Logic

### 4.1 Order Creation (maguey-pass-lounge/src/lib/orders-service.ts)

```typescript
export interface CreateOrderInput {
  eventId: string;
  purchaserEmail: string;
  purchaserName: string;
  purchaserUserId?: string | null;
  lineItems: OrderLineItem[];
  metadata?: Record<string, unknown>;
  ticketHolderName?: string;
  promoCodeId?: string | null;
}

export interface OrderLineItem {
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
  unitFee: number;
  displayName: string;
}

export async function createOrderWithTickets(
  input: CreateOrderInput,
  options: CreateOrderOptions = {}
): Promise<CreatedOrderResult> {
  const client = options.client ?? supabase;

  // 1. Validate input
  if (!input.lineItems.length) {
    throw new Error("createOrderWithTickets: no line items provided.");
  }

  // 2. Load event details
  const { data: event, error: eventError } = await client
    .from("events")
    .select("id, name, description, image_url, event_date, event_time, venue_name, venue_address, city")
    .eq("id", input.eventId)
    .single();

  if (eventError || !event) {
    throw new Error(`Failed to load event ${input.eventId}`);
  }

  // 3. Check inventory availability (CRITICAL: prevents overselling)
  for (const line of input.lineItems) {
    const { data: ticketType } = await client
      .from("ticket_types")
      .select("total_inventory, name")
      .eq("id", line.ticketTypeId)
      .single();

    const { count: soldCount } = await client
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("ticket_type_id", line.ticketTypeId)
      .in("status", ["issued", "used", "scanned"]);

    const available = (ticketType?.total_inventory || 0) - (soldCount || 0);
    if (line.quantity > available) {
      throw new Error(`Not enough tickets available for ${line.displayName}`);
    }
  }

  // 4. Calculate totals
  const totals = input.lineItems.reduce(
    (acc, line) => {
      acc.subtotal += line.unitPrice * line.quantity;
      acc.fees += line.unitFee * line.quantity;
      acc.total += (line.unitPrice + line.unitFee) * line.quantity;
      return acc;
    },
    { subtotal: 0, fees: 0, total: 0 }
  );

  // 5. Create order record
  const { data: order, error: orderError } = await client
    .from("orders")
    .insert({
      event_id: input.eventId,
      purchaser_email: input.purchaserEmail,
      purchaser_name: input.purchaserName,
      user_id: input.purchaserUserId ?? null,
      subtotal: totals.subtotal,
      fees_total: totals.fees,
      total: totals.total,
      status: "paid",
      promo_code_id: input.promoCodeId ?? null,
    })
    .select()
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to create order: ${orderError?.message}`);
  }

  // 6. Generate tickets for each line item
  const ticketEmailPayloads: TicketData[] = [];
  for (const line of input.lineItems) {
    const { ticketEmailPayloads: ticketPayloads } = await insertTicketsForOrder({
      order,
      event,
      ticketTypeId: line.ticketTypeId,
      displayName: line.displayName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      unitFee: line.unitFee,
      attendeeName: input.ticketHolderName ?? input.purchaserName,
      attendeeEmail: input.purchaserEmail,
      client,
    });
    ticketEmailPayloads.push(...ticketPayloads);
  }

  // 7. Auto-convert waitlist entry if applicable
  try {
    const { autoConvertWaitlistEntry } = await import('./waitlist-service');
    await autoConvertWaitlistEntry(event.name, input.purchaserEmail);
  } catch (error) {
    console.warn('Failed to convert waitlist entry:', error);
  }

  return { order, lineItems: input.lineItems, ticketEmailPayloads };
}

// Ticket generation with secure QR codes
async function insertTicketsForOrder(params: InsertTicketsParams) {
  const ticketRows = [];
  const ticketEmailPayloads: TicketData[] = [];

  for (let i = 0; i < params.quantity; i++) {
    // Generate secure QR token and signature
    const ticketData = await createTicketData({
      eventId: params.event.id,
      eventName: params.event.name,
      eventDate: params.event.event_date,
      ticketType: params.displayName,
      ticketHolderName: params.attendeeName,
      orderId: params.order.id,
      price: params.unitPrice + params.unitFee,
    });

    // Human-readable ticket ID (for display)
    const humanReadableTicketId = generateHumanReadableTicketId(
      params.event.id, params.order.id, i
    );

    ticketRows.push({
      qr_token: ticketData.qrToken,           // UUID - Scanner searches by THIS
      event_id: params.event.id,               // UUID foreign key
      ticket_type_id: params.ticketTypeId,     // UUID foreign key
      attendee_name: params.attendeeName,
      attendee_email: params.attendeeEmail,
      order_id: params.order.id,
      status: "issued",
      issued_at: new Date().toISOString(),
      price: params.unitPrice,
      fee_total: params.unitFee,
      qr_signature: ticketData.qrSignature,
      qr_code_url: ticketData.qrCodeDataUrl,
      qr_code_value: ticketData.qrToken,
      ticket_id: humanReadableTicketId,        // Display ID only
    });

    ticketEmailPayloads.push(ticketData);
  }

  await client.from("tickets").insert(ticketRows);
  return { ticketEmailPayloads };
}
```

### 4.2 Ticket Webhook (maguey-gate-scanner/supabase/functions/ticket-webhook/index.ts)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (limit.count >= 50) return false;
  limit.count++;
  return true;
}

// Webhook signature verification
async function verifyWebhookSignature(body: string, signature: string | null, secret: string | null): Promise<boolean> {
  if (!signature || !secret) return true;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Constant-time comparison
  return signature.length === computedSignature.length &&
    [...signature].every((c, i) => c === computedSignature[i]);
}

interface TicketData {
  ticket_id: string;
  event_name: string;
  ticket_type: string;
  guest_name?: string;
  guest_email?: string;
  qr_code_data?: string;
  order_id?: string;
  price_paid?: number;
  stripe_payment_id?: string;
}

serve(async (req) => {
  // Rate limiting
  const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  const bodyText = await req.text();
  const body = JSON.parse(bodyText);

  // Verify webhook signature
  const webhookSecret = Deno.env.get('TICKET_WEBHOOK_SECRET');
  const signature = req.headers.get('x-webhook-signature');
  if (webhookSecret && !await verifyWebhookSignature(bodyText, signature, webhookSecret)) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
  }

  const tickets: TicketData[] = Array.isArray(body.tickets) ? body.tickets : [body];

  // Validate required fields
  for (const ticket of tickets) {
    if (!ticket.ticket_id || !ticket.event_name || !ticket.ticket_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      );
    }
  }

  // Insert tickets
  const ticketsToInsert = tickets.map(ticket => ({
    ticket_id: ticket.ticket_id,
    event_name: ticket.event_name,
    ticket_type: ticket.ticket_type,
    guest_name: ticket.guest_name || null,
    guest_email: ticket.guest_email || null,
    qr_code_data: ticket.qr_code_data || ticket.ticket_id,
    order_id: ticket.order_id || null,
    price_paid: ticket.price_paid || null,
    status: 'issued',
    is_used: false,
    purchase_date: new Date().toISOString(),
  }));

  const { data: insertedTickets, error } = await supabase
    .from('tickets')
    .insert(ticketsToInsert)
    .select();

  if (error) {
    if (error.code === '23505') {
      return new Response(JSON.stringify({ error: 'Duplicate ticket_id' }), { status: 409 });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({
    success: true,
    tickets_created: insertedTickets?.length || 0,
    tickets: insertedTickets,
  }), { status: 201 });
});
```

### 4.3 Ticket Scanning (maguey-gate-scanner/src/lib/scanner-service.ts)

```typescript
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { supabase } from './supabase';

const qrSigningSecret = import.meta.env.VITE_QR_SIGNING_SECRET;

// Validate QR signature using HMAC SHA-256
export const validateQRSignature = async (qrToken: string, signature: string): Promise<boolean> => {
  if (!qrToken || !signature) return false;
  
  const keyBytes = utf8ToBytes(qrSigningSecret);
  const tokenBytes = utf8ToBytes(qrToken);
  const expectedSignature = bytesToHex(hmac(sha256, keyBytes, tokenBytes));
  
  // Constant-time comparison
  return signature.toLowerCase() === expectedSignature.toLowerCase();
};

// Look up ticket by QR token
export const lookupTicketByQR = async (qrToken: string): Promise<TicketWithRelations | null> => {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      id, order_id, event_id, ticket_type_id,
      attendee_name, qr_token, qr_signature, status, scanned_at, issued_at,
      events (id, name, event_date, event_time, venue_name, city),
      ticket_types (id, name, price)
    `)
    .eq('qr_token', qrToken)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
};

// Scan and validate a ticket
export const scanTicket = async (
  qrData: string,
  scannedBy: string,
  options?: { scanMethod?: 'qr' | 'nfc' | 'manual' }
): Promise<ScanResult> => {
  const startTime = Date.now();
  
  try {
    // 1. Look up ticket
    const ticket = await lookupTicketByQR(qrData);
    if (!ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    // 2. Validate signature
    if (ticket.qr_signature) {
      const isValid = await validateQRSignature(ticket.qr_token, ticket.qr_signature);
      if (!isValid) {
        return { success: false, error: 'Invalid QR signature' };
      }
    }

    // 3. Check status
    if (ticket.status === 'scanned' || ticket.status === 'used') {
      return { success: false, error: 'Ticket already used', ticket };
    }
    if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
      return { success: false, error: 'Ticket cancelled', ticket };
    }

    // 4. Update ticket status
    await supabase
      .from('tickets')
      .update({
        status: 'scanned',
        scanned_at: new Date().toISOString(),
        scanned_by: scannedBy,
        is_used: true,
      })
      .eq('id', ticket.id);

    // 5. Log the scan
    const durationMs = Date.now() - startTime;
    await supabase.from('scan_logs').insert({
      ticket_id: ticket.id,
      scan_result: 'valid',
      scanned_by: scannedBy,
      scan_duration_ms: durationMs,
      scan_method: options?.scanMethod || 'qr',
    });

    return { success: true, ticket, durationMs };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Check in a ticket (mark as used)
export const checkInTicket = async (ticketId: string, scannedBy: string): Promise<boolean> => {
  const { error } = await supabase
    .from('tickets')
    .update({
      status: 'used',
      is_used: true,
      scanned_at: new Date().toISOString(),
      scanned_by: scannedBy,
    })
    .eq('id', ticketId);

  return !error;
};
```

### 4.4 Order Status Update

```typescript
// Update order status (used after payment confirmation or cancellation)
export async function updateOrderStatus(
  orderId: string,
  status: 'pending' | 'paid' | 'cancelled' | 'refunded',
  additionalData?: { paid_at?: string; payment_reference?: string }
): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .update({
      status,
      ...additionalData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update order status:', error);
    return null;
  }

  // If cancelled/refunded, also update tickets
  if (status === 'cancelled' || status === 'refunded') {
    await supabase
      .from('tickets')
      .update({ status })
      .eq('order_id', orderId);
  }

  return data;
}
```

---

## 5. Cross-Site Data Flow

### Purchase Flow
```
1. Customer selects tickets on maguey-pass-lounge
2. createOrderWithTickets() validates inventory & creates order
3. Tickets created with secure QR tokens (HMAC-signed)
4. Email sent with ticket QR codes
5. Order & tickets visible in maguey-gate-scanner immediately (shared DB)
```

### Scanner Flow
```
1. Staff scans QR code on maguey-gate-scanner
2. lookupTicketByQR() finds ticket by qr_token
3. validateQRSignature() verifies HMAC signature
4. scanTicket() updates status to 'scanned'
5. scan_logs entry created for audit trail
6. Ticket status reflected on maguey-pass-lounge immediately
```

### Real-time Sync
```typescript
// maguey-gate-scanner subscribes to ticket updates
const channel = supabase
  .channel('ticket-updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tickets',
  }, (payload) => {
    // Update UI when tickets change
    handleTicketUpdate(payload.new);
  })
  .subscribe();
```

---

## 6. Environment Variables

All three sites share these Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Site-specific variables:
```env
# maguey-pass-lounge (Purchase)
VITE_STRIPE_PUBLISHABLE_KEY=pk_...
VITE_EMAIL_API_KEY=re_...
VITE_QR_SIGNING_SECRET=your-secret

# maguey-gate-scanner (Admin)
VITE_QR_SIGNING_SECRET=your-secret  # Same as purchase site
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-key  # Server-side only
```

---

## 7. Security Features

1. **QR Code Signing:** HMAC-SHA256 signatures prevent ticket forgery
2. **Row Level Security:** Users only see their own orders/tickets
3. **Webhook Verification:** HMAC signature validation on webhooks
4. **Rate Limiting:** 50 req/min on webhooks, 100 req/min on APIs
5. **Inventory Protection:** Race condition prevention via count checks
6. **Service Role Isolation:** Admin operations use service role key

---

**Document End**
