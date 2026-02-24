import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

import QRCode from "https://esm.sh/qrcode@1.5.3";
import { createLogger, getRequestId } from "../_shared/logger.ts";
import { initSentry, captureError, setRequestContext } from "../_shared/sentry.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

// Initialize Sentry at module level (before serve)
initSentry();

// ============================================
// Retry with Exponential Backoff
// ============================================

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries - 1) {
        throw lastError;
      }

      // Exponential backoff with jitter (capped at 10 seconds to stay within webhook timeout)
      const delay = Math.min(
        (baseDelayMs * Math.pow(2, attempt)) + (Math.random() * 500),
        10000
      );
      // Note: Using console.log here since logger is not available in this utility function
      console.log(JSON.stringify({ level: 'warn', message: `Retry attempt ${attempt + 1}/${maxRetries}`, context: { error: lastError.message, delayMs: Math.round(delay) } }));
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================
// Payment Failure Notification
// ============================================

interface PaymentFailureData {
  stripeEventId: string;
  stripePaymentIntentId: string;
  customerEmail: string;
  amountCents: number;
  errorMessage: string;
  paymentType: 'ga_ticket' | 'vip_reservation';
  eventId?: string;
  eventName?: string;
  metadata?: Record<string, unknown>;
}

async function notifyPaymentFailure(data: PaymentFailureData): Promise<void> {
  try {
    // Call the notification Edge Function
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-payment-failure`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      console.log(JSON.stringify({ level: 'error', message: 'Failed to notify payment failure', context: { response: await response.text() } }));
    } else {
      console.log(JSON.stringify({ level: 'info', message: 'Payment failure notification sent successfully' }));
    }
  } catch (error) {
    console.log(JSON.stringify({ level: 'error', message: 'Error calling notify-payment-failure', context: { error: error.message } }));
    // Don't throw - notification failure should not affect webhook response
  }
}

// ============================================
// QR Code Signing (via database RPC — secret stored in Supabase Vault)
// ============================================

/**
 * Sign a QR token using the server-side secret stored in Supabase Vault.
 * Calls the sign_qr_token RPC which reads the HMAC key from vault.secrets.
 * The secret never leaves the database.
 */
async function signQrToken(
  supabase: ReturnType<typeof createClient>,
  token: string
): Promise<string> {
  const { data, error } = await supabase.rpc("sign_qr_token", {
    p_token: token,
  });
  if (error) {
    console.error("[stripe-webhook] Failed to sign QR token via RPC:", error.message);
    return "";
  }
  return data as string;
}

/**
 * Generate a QR code as a base64 data URL
 * Creates a scannable QR code image from pass data
 */
async function generateQrCodeDataUrl(
  token: string,
  signature: string,
  meta: { reservationId?: string; guestNumber?: number }
): Promise<string> {
  try {
    // Create the QR payload that the scanner expects
    const qrPayload = JSON.stringify({
      token,
      signature,
      meta,
    });

    // Generate QR code as data URL
    const dataUrl = await QRCode.toDataURL(qrPayload, {
      width: 200,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    });

    return dataUrl;
  } catch (error) {
    console.log(JSON.stringify({ level: 'error', message: 'Error generating QR code', context: { error: error.message } }));
    // Return empty string if QR generation fails - template will fall back to text
    return "";
  }
}

// ============================================
// Email Queue Helper
// ============================================

interface QueueEmailParams {
  emailType: 'ga_ticket' | 'vip_confirmation';
  recipientEmail: string;
  subject: string;
  htmlBody: string;
  relatedId?: string;
}

async function queueEmail(
  supabase: ReturnType<typeof createClient>,
  params: QueueEmailParams
): Promise<void> {
  const { error } = await supabase
    .from('email_queue')
    .insert({
      email_type: params.emailType,
      recipient_email: params.recipientEmail,
      subject: params.subject,
      html_body: params.htmlBody,
      related_id: params.relatedId,
      status: 'pending',
      attempt_count: 0,
      max_attempts: 5,
      next_retry_at: new Date().toISOString(),
    });

  if (error) {
    console.log(JSON.stringify({
      level: 'error',
      message: 'Failed to queue email',
      context: {
        error: error.message,
        emailType: params.emailType,
        recipient: params.recipientEmail,
        relatedId: params.relatedId,
      }
    }));
    // Don't throw - webhook must return 200 to Stripe
    // Email will need manual intervention if queue insert fails
  } else {
    console.log(JSON.stringify({
      level: 'info',
      message: 'Email queued successfully',
      context: {
        emailType: params.emailType,
        recipient: params.recipientEmail,
        relatedId: params.relatedId,
      }
    }));
  }
}

// ============================================
// Email Service (HTML Generation)
// ============================================

interface TicketEmailData {
  ticketId: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  ticketType: string;
  customerName: string;
  qrToken: string;
}

// ============================================
// VIP Confirmation Email
// ============================================

interface VipEmailData {
  reservationId: string;
  eventId: string;
  reservationNumber: string;
  customerName: string;
  customerEmail: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress?: string;
  eventImageUrl?: string;
  tableName: string;
  tableNumber: number;
  tier: string;
  guestCount: number;
  bottlesIncluded: number;
  totalAmount: number;
  inviteCode?: string;
  guestPasses: Array<{
    passNumber: number;
    qrToken: string;
    qrSignature: string;
    qrImageDataUrl?: string; // Base64 QR code image
  }>;
}

async function sendVipConfirmationEmail(
  supabase: ReturnType<typeof createClient>,
  data: VipEmailData
): Promise<void> {
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://tickets.magueynightclub.com";

  const formattedDate = new Date(data.eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const tierLabel = {
    premium: 'Premium',
    front_row: 'Front Row',
    standard: 'Standard',
    regular: 'Regular',
  }[data.tier] || 'VIP';

  const tierColor = {
    premium: '#EAB308',
    front_row: '#A855F7',
    standard: '#3B82F6',
    regular: '#6366f1',
  }[data.tier] || '#6366f1';

  // Generate QR code sections for all guest passes with actual QR images
  const qrCodeSections = data.guestPasses.map((pass) => `
    <div style="display: inline-block; width: 220px; margin: 10px; text-align: center; vertical-align: top;">
      <div style="background-color: white; border-radius: 8px; padding: 15px; border: 2px solid #e0e0e0;">
        ${pass.qrImageDataUrl ? `
          <div style="margin-bottom: 10px;">
            <img src="${pass.qrImageDataUrl}" alt="QR Code for Guest ${pass.passNumber}" style="width: 180px; height: 180px; display: block; margin: 0 auto;" />
          </div>
        ` : `
          <div style="background: #f0f0f0; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
            <p style="font-size: 11px; color: #666; margin: 0;">Present this code at entry</p>
            <p style="font-size: 10px; font-family: monospace; color: #333; margin: 5px 0 0 0; word-break: break-all;">${pass.qrToken}</p>
          </div>
        `}
        <div style="font-weight: bold; color: #333; font-size: 14px; margin-bottom: 4px;">Guest ${pass.passNumber}</div>
        <p style="font-size: 10px; color: #666; margin: 0 0 8px 0;">Scan QR code at entry</p>
        <a href="${frontendUrl}/vip-pass/${pass.qrToken}" style="display: inline-block; padding: 6px 12px; background: ${tierColor}; color: white; text-decoration: none; border-radius: 4px; font-size: 11px;">
          View Pass Online
        </a>
      </div>
    </div>
  `).join('');

  // Build invite link section if invite code exists
  const inviteLinkSection = data.inviteCode ? `
    <div style="background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); border-radius: 8px; padding: 20px; margin: 20px 0; color: white;">
      <h3 style="margin: 0 0 10px 0;">🎉 Invite Your Guests</h3>
      <p style="margin: 0 0 15px 0; font-size: 14px; opacity: 0.9;">
        Share this link with your guests so they can purchase their GA tickets and be linked to your VIP table.
      </p>
      <div style="background: rgba(255,255,255,0.2); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; word-break: break-all;">
        ${frontendUrl}/checkout?event=${data.eventId}&vip=${data.inviteCode}
      </div>
      <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.8;">
        Table capacity: ${data.guestCount} guests
      </p>
    </div>
  ` : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VIP Table Reservation - ${data.eventName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%); color: white; text-align: center; padding: 30px;">
      <div style="font-size: 40px; margin-bottom: 10px;">👑</div>
      <h1 style="color: ${tierColor}; margin: 0 0 10px 0; font-size: 28px;">VIP TABLE RESERVATION</h1>
      <p style="margin: 0; opacity: 0.9;">Your exclusive table is confirmed</p>
    </div>

    <div style="background-color: #10b981; color: white; padding: 20px; text-align: center; font-size: 18px; font-weight: bold;">
      ✅ Payment Successful - Your VIP Table is Reserved!
    </div>

    ${data.eventImageUrl ? `<img src="${data.eventImageUrl}" alt="${data.eventName}" style="width: 100%; max-height: 250px; object-fit: cover;" />` : ''}

    <div style="padding: 30px;">
      <p>Dear ${data.customerName.split(' ')[0]},</p>
      <p>Thank you for your VIP table reservation! Your exclusive table for <strong>${data.eventName}</strong> is confirmed.</p>

      <div style="background: linear-gradient(135deg, ${tierColor}15 0%, ${tierColor}05 100%); border-left: 4px solid ${tierColor}; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-size: 12px; color: #666;">RESERVATION</div>
            <div style="font-size: 24px; font-weight: bold; color: ${tierColor}; font-family: monospace;">${data.reservationNumber || data.reservationId.substring(0, 8).toUpperCase()}</div>
          </div>
          <span style="display: inline-block; padding: 6px 16px; background-color: ${tierColor}20; color: ${tierColor}; border-radius: 20px; font-weight: bold; font-size: 14px; border: 2px solid ${tierColor};">
            ${tierLabel} Table
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
          <div style="padding: 10px; background-color: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 12px; color: #666; text-transform: uppercase;">Event</div>
            <div style="font-size: 16px; font-weight: 600; color: #333; margin-top: 4px;">${data.eventName}</div>
          </div>
          <div style="padding: 10px; background-color: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 12px; color: #666; text-transform: uppercase;">Date</div>
            <div style="font-size: 16px; font-weight: 600; color: #333; margin-top: 4px;">${formattedDate}</div>
          </div>
          <div style="padding: 10px; background-color: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 12px; color: #666; text-transform: uppercase;">Time</div>
            <div style="font-size: 16px; font-weight: 600; color: #333; margin-top: 4px;">${data.eventTime || 'Doors at 9 PM'}</div>
          </div>
          <div style="padding: 10px; background-color: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 12px; color: #666; text-transform: uppercase;">Table</div>
            <div style="font-size: 16px; font-weight: 600; color: #333; margin-top: 4px;">${data.tableName || `Table ${data.tableNumber}`}</div>
          </div>
          <div style="padding: 10px; background-color: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 12px; color: #666; text-transform: uppercase;">Guests</div>
            <div style="font-size: 16px; font-weight: 600; color: #333; margin-top: 4px;">${data.guestCount} people</div>
          </div>
          <div style="padding: 10px; background-color: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 12px; color: #666; text-transform: uppercase;">Bottles Included</div>
            <div style="font-size: 16px; font-weight: 600; color: #333; margin-top: 4px;">${data.bottlesIncluded} bottle(s)</div>
          </div>
        </div>

        <div style="text-align: right; padding-top: 15px; border-top: 1px solid ${tierColor}30;">
          <div style="font-size: 14px; color: #666;">Total Paid</div>
          <div style="font-size: 28px; font-weight: bold; color: #10b981;">$${data.totalAmount.toFixed(2)}</div>
        </div>
      </div>

      ${inviteLinkSection}
    </div>

    <div style="text-align: center; padding: 30px; background-color: #fafafa; border-top: 1px solid #e0e0e0; border-bottom: 1px solid #e0e0e0;">
      <h2 style="color: #333; margin-bottom: 10px;">🎫 Guest Entry Passes</h2>
      <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
        Each guest needs their own pass to enter. Share these with your guests or show them from your phone at the door.
      </p>
      <div style="text-align: center;">
        ${qrCodeSections}
      </div>
    </div>

    <div style="padding: 30px;">
      <div style="background-color: #fef3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #856404;">⚠️ Important Information</h3>
        <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
          <li><strong>Arrive 30 minutes early</strong> for table setup and VIP check-in</li>
          <li>Valid <strong>government-issued ID required</strong> for all guests</li>
          <li>Each guest <strong>presents their own pass</strong> at entry</li>
          <li>Your table will be held for 1 hour after doors open</li>
        </ul>
      </div>

      <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px 20px; margin: 20px 0; border-radius: 4px; color: #991b1b; font-weight: 500;">
        ⛔ <strong>No Refunds:</strong> All VIP table reservations are final and non-refundable.
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${frontendUrl}/vip-confirmation/${data.reservationId}" style="display: inline-block; padding: 14px 28px; background-color: ${tierColor}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
          View Reservation Online
        </a>
      </div>
    </div>

    <div style="padding: 30px; text-align: center; color: #666; font-size: 14px; border-top: 1px solid #e0e0e0;">
      <p><strong>Venue:</strong> ${data.venueName}${data.venueAddress ? ` • ${data.venueAddress}` : ''}</p>
      <p style="margin-top: 20px; font-size: 12px; color: #999;">
        If you have any questions, please contact us at support@magueynightclub.com<br>
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Queue email instead of sending directly
  await queueEmail(supabase, {
    emailType: 'vip_confirmation',
    recipientEmail: data.customerEmail,
    subject: `VIP Table Confirmed - ${data.eventName}`,
    htmlBody: html,
    relatedId: data.reservationId,
  });
}

async function sendTicketEmail(
  supabase: ReturnType<typeof createClient>,
  to: string,
  customerName: string,
  orderId: string,
  tickets: TicketEmailData[]
): Promise<void> {
  // Skip if no tickets
  if (!tickets.length) {
    console.log(JSON.stringify({ level: 'warn', message: 'sendTicketEmail called with no tickets' }));
    return;
  }

  const eventName = tickets[0]?.eventName || "Event";

  // Generate email HTML (same as before)
  const ticketHtml = tickets.map((ticket, index) => `
    <div style="border: 2px solid #6366f1; border-radius: 8px; padding: 20px; margin: 15px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <h3 style="color: white; margin: 0 0 15px 0;">Ticket ${index + 1}: ${ticket.ticketType}</h3>
      <div style="background: white; padding: 15px; border-radius: 6px;">
        <p style="margin: 5px 0;"><strong>Event:</strong> ${ticket.eventName}</p>
        <p style="margin: 5px 0;"><strong>Date:</strong> ${ticket.eventDate}</p>
        <p style="margin: 5px 0;"><strong>Time:</strong> ${ticket.eventTime}</p>
        <p style="margin: 5px 0;"><strong>Venue:</strong> ${ticket.venueName}</p>
        <p style="margin: 5px 0;"><strong>Ticket ID:</strong> <code>${ticket.ticketId}</code></p>
        <p style="margin: 15px 0 5px 0; font-size: 12px; color: #666;">
          Present this ticket at the venue. A QR code will be available in your account.
        </p>
      </div>
    </div>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Your Maguey Tickets</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
      <div style="background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 20px;">
          <h1 style="color: #6366f1; margin: 0;">MAGUEY</h1>
        </div>

        <div style="background: #10b981; color: white; padding: 15px; border-radius: 6px; text-align: center; margin-bottom: 30px;">
          Payment Successful! Your tickets are confirmed.
        </div>

        <p>Hi ${customerName},</p>
        <p>Thank you for your purchase! Your digital tickets for <strong>${eventName}</strong> are ready.</p>

        ${ticketHtml}

        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #856404;">Important Information</h3>
          <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
            <li>Valid government-issued ID required at entrance</li>
            <li>Arrive 30 minutes before event time</li>
            <li>Your QR code will be in your account dashboard</li>
            <li>Tickets are non-transferable and non-refundable</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://tickets.magueynightclub.com/account" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
            View My Tickets
          </a>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 14px;">
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p>Questions? Contact us at support@magueynightclub.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Queue email instead of sending directly
  await queueEmail(supabase, {
    emailType: 'ga_ticket',
    recipientEmail: to,
    subject: `Your Maguey Tickets - Order Confirmed`,
    htmlBody: html,
    relatedId: orderId,
  });
}

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = signature.split(",");
    const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
    const v1Signature = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

    if (!timestamp || !v1Signature) {
      console.log(JSON.stringify({ level: 'error', message: 'Missing timestamp or signature in Stripe webhook' }));
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    );

    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison to prevent timing attacks
    if (expectedSignature.length !== v1Signature.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      result |= expectedSignature.charCodeAt(i) ^ v1Signature.charCodeAt(i);
    }
    return result === 0;
  } catch (error) {
    console.log(JSON.stringify({ level: 'error', message: 'Signature verification error', context: { error: error.message } }));
    return false;
  }
}

/**
 * Parse VIP table information from ticketTypeId
 * Format: vip_table_{tier}_{tableId}
 */
function parseVipTableInfo(ticketTypeId: string): { tier: string; tableId: string } | null {
  if (!ticketTypeId.startsWith("vip_table_")) {
    return null;
  }
  // Format: vip_table_front_row_sample-4 or vip_table_standard_sample-11
  const parts = ticketTypeId.replace("vip_table_", "").split("_");
  // Handle tiers with underscores like "front_row"
  if (parts.length >= 2) {
    const tableId = parts[parts.length - 1]; // Last part is tableId
    const tier = parts.slice(0, -1).join("_"); // Rest is tier
    return { tier, tableId };
  }
  return null;
}

/**
 * Extract table number from displayName
 * Format: "VIP Table 11 - Standard (6 guests, 1 bottle)"
 */
function extractTableNumber(displayName: string): number | null {
  const match = displayName.match(/VIP Table (\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

serve(async (req) => {
  // Handle CORS preflight with stripe-signature header
  const corsResponse = handleCorsPreFlight(req, "stripe-signature");
  if (corsResponse) return corsResponse;

  // Use dynamic CORS headers with stripe-signature for all responses
  const dynamicCorsHeaders = getCorsHeaders(req, "stripe-signature");

  // Create request-bound logger for correlation
  const requestId = getRequestId(req);
  const logger = createLogger(requestId);

  // Set Sentry request context for error correlation
  setRequestContext(req, requestId);

  // Variable to track idempotency record for later update
  let idempotencyRecordId: string | null = null;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

    // Parse event first to get event ID for idempotency check
    const event = JSON.parse(body);
    const stripeEventId = event.id;

    // Check idempotency BEFORE signature verification
    // This prevents replay attacks and reduces processing load
    const { data: idempotencyCheck, error: idempotencyError } = await supabase
      .rpc('check_webhook_idempotency', {
        p_idempotency_key: stripeEventId,
        p_webhook_type: 'stripe'
      })
      .single();

    if (idempotencyError) {
      logger.error('Idempotency check failed', { error: idempotencyError.message });
      // Continue processing if idempotency check fails (fail-open for availability)
    } else if (idempotencyCheck?.is_duplicate) {
      logger.info('Duplicate webhook event, returning cached response', { stripeEventId });
      return new Response(
        JSON.stringify(idempotencyCheck.cached_response || { received: true }),
        {
          status: idempotencyCheck.cached_status || 200,
          headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Store record_id for later update
    idempotencyRecordId = idempotencyCheck?.record_id || null;

    // Verify Stripe webhook signature - MANDATORY in all environments
    if (!webhookSecret) {
      logger.error("STRIPE_WEBHOOK_SECRET not configured - rejecting webhook", { stripeEventId });
      return new Response(JSON.stringify({ error: "Webhook secret not configured", requestId }), { status: 500, headers: dynamicCorsHeaders });
    }
    if (!signature) {
      logger.error("Missing stripe-signature header", { stripeEventId });
      return new Response(JSON.stringify({ error: "Missing signature", requestId }), { status: 401, headers: dynamicCorsHeaders });
    }

    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      logger.error("Invalid Stripe webhook signature", { stripeEventId });
      // Update idempotency record with error if we have one
      if (idempotencyRecordId) {
        supabase.rpc('update_webhook_idempotency', {
          p_record_id: idempotencyRecordId,
          p_response_data: { error: 'Invalid signature', requestId },
          p_response_status: 401
        }).catch(() => { }); // Silent fail
      }
      return new Response(JSON.stringify({ error: "Invalid signature", requestId }), { status: 401, headers: dynamicCorsHeaders });
    }
    logger.info("Webhook signature verified", { stripeEventId });

    logger.info("Webhook event received", { eventType: event.type, stripeEventId });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      logger.info("Checkout session completed", { sessionId: session.id });

      const orderId = session.metadata?.orderId;
      const eventId = session.metadata?.eventId;
      const customerEmail = session.metadata?.customerEmail || session.customer_email;
      const customerName = session.metadata?.customerName || "Guest";
      const ticketsData = session.metadata?.tickets;
      const vipInviteCode = session.metadata?.vipInviteCode; // For linking GA tickets to VIP reservations

      if (!orderId) {
        logger.error("No orderId in session metadata", { sessionId: session.id });
        return new Response(JSON.stringify({ error: "Missing orderId", requestId }), { status: 400, headers: dynamicCorsHeaders });
      }

      // Update order status to paid
      const { error: orderError } = await supabase
        .from("orders")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (orderError) {
        logger.error("Error updating order", { orderId, error: orderError.message });
      } else {
        logger.info("Order updated to paid", { orderId });
      }

      // Process tickets/VIP tables
      if (ticketsData && eventId) {
        try {
          const tickets = JSON.parse(ticketsData);
          logger.info("Processing tickets", { ticketCount: tickets.length, eventId });

          // Fetch event details for email
          const { data: eventData } = await supabase
            .from("events")
            .select("name, event_date, event_time, venue_name")
            .eq("id", eventId)
            .single();

          const createdTickets: TicketEmailData[] = [];

          for (const ticket of tickets) {
            // Check if this is a VIP table reservation
            // Prefer structured metadata if available (from secure create-checkout-session)
            // Otherwise fall back to parsing ticketTypeId (legacy/client-initiated)
            let vipInfo = null;

            if (ticket.is_vip === true || ticket.is_vip === "true") {
              vipInfo = {
                tier: ticket.tier || "standard",
                tableId: ticket.table_number ? String(ticket.table_number) : null
              };
            } else {
              vipInfo = parseVipTableInfo(ticket.ticketTypeId);
            }

            if (vipInfo) {
              // This is a VIP table reservation
              logger.info("Processing VIP table reservation", { tier: vipInfo.tier, tableId: vipInfo.tableId, structured: !!ticket.is_vip });

              // Extract table number: use structured data -> regex -> null
              const tableNumber = ticket.table_number
                ? parseInt(String(ticket.table_number), 10)
                : extractTableNumber(ticket.displayName);

              const nameParts = customerName.split(" ");
              const firstName = nameParts[0] || "Guest";
              const lastName = nameParts.slice(1).join(" ") || "";

              // Extract guest count: use structured data -> regex -> default 6
              let guestCount = 6;
              if (ticket.guest_count) {
                guestCount = parseInt(String(ticket.guest_count), 10);
              } else {
                const guestMatch = ticket.displayName.match(/\((\d+) guests/);
                if (guestMatch) guestCount = parseInt(guestMatch[1], 10);
              }

              // Find the event_vip_table record to get the ID
              const { data: eventVipTable, error: tableError } = await supabase
                .from("event_vip_tables")
                .select("id")
                .eq("event_id", eventId)
                .eq("table_number", tableNumber)
                .single();

              if (tableError) {
                logger.warn("Error finding event_vip_table", { eventId, tableNumber, error: tableError.message });
                // Continue anyway - we'll create the reservation without the foreign key
              }

              // Generate QR code token for the reservation
              const qrCodeToken = `VIP-${crypto.randomUUID().substring(0, 12).toUpperCase()}`;

              // Create VIP reservation
              const reservationData = {
                event_id: eventId,
                event_vip_table_id: eventVipTable?.id || null,
                table_number: tableNumber,
                purchaser_name: customerName,
                purchaser_email: customerEmail,
                purchaser_phone: "", // Not available in checkout session
                stripe_payment_intent_id: session.payment_intent,
                amount_paid_cents: Math.round(ticket.unitPrice * 100),
                status: "confirmed",
                qr_code_token: qrCodeToken,
                package_snapshot: {
                  tier: vipInfo.tier,
                  tableNumber,
                  guestCount,
                  price: ticket.unitPrice,
                  displayName: ticket.displayName,
                  orderId,
                  sessionId: session.id,
                  firstName: nameParts[0] || "",
                  lastName: nameParts.slice(1).join(" ") || "",
                },
                special_requests: null,
                disclaimer_accepted_at: new Date().toISOString(),
                refund_policy_accepted_at: new Date().toISOString(),
                checked_in_guests: 0,
              };

              logger.info("Creating VIP reservation", { tableNumber, tier: vipInfo.tier, guestCount });

              let reservation: { id: string } | null = null;
              try {
                // Retry VIP reservation creation up to 5 times with exponential backoff
                reservation = await retryWithBackoff(async () => {
                  const { data, error: reservationError } = await supabase
                    .from("vip_reservations")
                    .insert(reservationData)
                    .select()
                    .single();

                  if (reservationError) {
                    throw new Error(reservationError.message);
                  }
                  return data;
                }, 5, 500);

                logger.info("VIP reservation created", { reservationId: reservation.id });

                // Generate guest passes for VIP reservation
                const guestPasses = [];
                for (let i = 1; i <= guestCount; i++) {
                  const passToken = `VIP-PASS-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

                  // Sign VIP guest pass via database RPC (secret in Supabase Vault)
                  const signatureData = `${passToken}|${reservation.id}|${i}`;
                  const { data: passSignature, error: signError } = await supabase.rpc("sign_vip_pass", { p_data: signatureData });
                  if (signError) {
                    logger.error("Failed to sign VIP pass via RPC", { error: signError.message });
                  }

                  guestPasses.push({
                    reservation_id: reservation.id,
                    guest_number: i,
                    qr_code_token: passToken,
                    qr_signature: passSignature,
                    status: "issued",
                  });
                }

                if (guestPasses.length > 0) {
                  const { error: passesError } = await supabase
                    .from("vip_guest_passes")
                    .insert(guestPasses);

                  if (passesError) {
                    logger.error("Error creating guest passes", { reservationId: reservation.id, error: passesError.message });
                  } else {
                    logger.info("Guest passes created", { reservationId: reservation.id, passCount: guestPasses.length });
                  }
                }

                // Mark the table as unavailable
                if (eventVipTable?.id) {
                  const { error: updateTableError } = await supabase
                    .from("event_vip_tables")
                    .update({ is_available: false })
                    .eq("id", eventVipTable.id);

                  if (updateTableError) {
                    logger.error("Error updating table availability", { tableNumber, error: updateTableError.message });
                  } else {
                    logger.info("Table marked as unavailable", { tableNumber });
                  }
                }

                // Send VIP confirmation email with QR codes
                // Extract bottles from displayName: "VIP Table 11 - Standard (6 guests, 1 bottle)"
                const bottlesMatch = ticket.displayName.match(/(\d+) bottle/);
                const bottlesIncluded = bottlesMatch ? parseInt(bottlesMatch[1], 10) : 1;

                // Prepare guest passes for email with QR code images
                const emailGuestPasses = await Promise.all(
                  guestPasses.map(async (pass) => {
                    const qrImageDataUrl = await generateQrCodeDataUrl(
                      pass.qr_code_token,
                      pass.qr_signature,
                      { reservationId: reservation.id, guestNumber: pass.guest_number }
                    );
                    return {
                      passNumber: pass.guest_number,
                      qrToken: pass.qr_code_token,
                      qrSignature: pass.qr_signature,
                      qrImageDataUrl,
                    };
                  })
                );

                // Queue VIP confirmation email (non-blocking)
                // Email is queued for processing by the email queue processor
                sendVipConfirmationEmail(supabase, {
                  reservationId: reservation.id,
                  eventId,
                  reservationNumber: reservation.id.substring(0, 8).toUpperCase(),
                  customerName,
                  customerEmail,
                  eventName: eventData?.name || "Event",
                  eventDate: eventData?.event_date || "",
                  eventTime: eventData?.event_time || "9:00 PM",
                  venueName: eventData?.venue_name || "Maguey Nightclub",
                  tableName: `Table ${tableNumber}`,
                  tableNumber: tableNumber || 0,
                  tier: vipInfo.tier,
                  guestCount,
                  bottlesIncluded,
                  totalAmount: ticket.unitPrice,
                  guestPasses: emailGuestPasses,
                }).catch(err => {
                  logger.error('Failed to queue VIP email', {
                    error: err.message,
                    reservationId: reservation.id,
                    email: customerEmail
                  });
                });
              } catch (vipCreateError) {
              // All retries failed - notify owner
              logger.error("All VIP reservation creation retries failed", { error: vipCreateError.message, tableNumber });

              // Fire-and-forget notification (don't block webhook response)
              notifyPaymentFailure({
                stripeEventId: event.id,
                stripePaymentIntentId: session.payment_intent || '',
                customerEmail: customerEmail || '',
                amountCents: Math.round((ticket.unitPrice || 0) * 100),
                errorMessage: vipCreateError.message || 'Unknown error',
                paymentType: 'vip_reservation',
                eventId,
                eventName: eventData?.name,
                metadata: {
                  orderId,
                  sessionId: session.id,
                  tier: vipInfo.tier,
                  tableNumber,
                }
              }).catch(err => {
                logger.error('Failed to send payment failure notification', { error: err.message });
              });

              // Continue processing - payment succeeded, we've logged the failure for manual resolution
            }
          } else {
            // This is a regular ticket - create ticket records with retry
            for (let i = 0; i < ticket.quantity; i++) {
              const ticketId = `MGY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
              const qrToken = crypto.randomUUID();

              // Sign QR token via database RPC (secret in Supabase Vault)
              const qrSignature = await signQrToken(supabase, qrToken);

              const ticketData = {
                order_id: orderId,
                event_id: eventId,
                ticket_type_id: ticket.ticketTypeId,
                attendee_email: customerEmail,
                attendee_name: customerName,
                status: "issued",
                price: ticket.unitPrice,
                fee_total: ticket.unitFee || 0,
                ticket_id: ticketId,
                qr_token: qrToken,
                qr_signature: qrSignature,
                issued_at: new Date().toISOString(),
              };

              try {
                // Retry ticket creation up to 5 times with exponential backoff
                await retryWithBackoff(async () => {
                  const { error: ticketError } = await supabase
                    .from("tickets")
                    .insert(ticketData);

                  if (ticketError) {
                    throw new Error(ticketError.message);
                  }
                }, 5, 500);

                logger.info("Ticket created", { ticketId, eventId, email: customerEmail });

                // Add to email list
                createdTickets.push({
                  ticketId,
                  eventName: eventData?.name || "Event",
                  eventDate: eventData?.event_date || "",
                  eventTime: eventData?.event_time || "",
                  venueName: eventData?.venue_name || "Maguey Nightclub",
                  ticketType: ticket.displayName,
                  customerName,
                  qrToken,
                });
              } catch (ticketCreateError) {
                // All retries failed - notify owner
                logger.error("All ticket creation retries failed", { error: ticketCreateError.message, ticketId });

                // Fire-and-forget notification (don't block webhook response)
                notifyPaymentFailure({
                  stripeEventId: event.id,
                  stripePaymentIntentId: session.payment_intent || '',
                  customerEmail: customerEmail || '',
                  amountCents: Math.round((ticket.unitPrice || 0) * 100),
                  errorMessage: ticketCreateError.message || 'Unknown error',
                  paymentType: 'ga_ticket',
                  eventId,
                  eventName: eventData?.name,
                  metadata: {
                    orderId,
                    sessionId: session.id,
                    ticketTypeId: ticket.ticketTypeId,
                    ticketId,
                  }
                }).catch(err => {
                  logger.error('Failed to send payment failure notification', { error: err.message });
                });

                // Continue processing other tickets - don't fail entire webhook
                // Payment succeeded, we've logged the failure for manual resolution
              }
            }
          }
        }

          // Link tickets to VIP reservation if vipInviteCode is present
          if (vipInviteCode && createdTickets.length > 0) {
          logger.info("Linking GA tickets to VIP reservation", { vipInviteCode, ticketCount: createdTickets.length });

          // Look up VIP reservation by invite code
          const { data: vipReservation, error: vipLookupError } = await supabase
            .from("vip_reservations")
            .select("id, event_vip_tables(capacity)")
            .eq("invite_code", vipInviteCode)
            .eq("event_id", eventId)
            .single();

          if (vipLookupError) {
            logger.error("Error looking up VIP reservation by invite code", { vipInviteCode, error: vipLookupError.message });
          } else if (vipReservation) {
            logger.info("Found VIP reservation", { reservationId: vipReservation.id });

            // Check current linked ticket count vs capacity
            const { count: linkedCount } = await supabase
              .from("vip_linked_tickets")
              .select("*", { count: "exact", head: true })
              .eq("vip_reservation_id", vipReservation.id);

            const capacity = vipReservation.event_vip_tables?.capacity || 6;
            const remainingCapacity = capacity - (linkedCount || 0);

            // Get ticket IDs for the tickets just created
            const { data: justCreatedTickets } = await supabase
              .from("tickets")
              .select("id")
              .eq("order_id", orderId);

            if (justCreatedTickets && justCreatedTickets.length > 0) {
              // Only link up to remaining capacity
              const ticketsToLink = justCreatedTickets.slice(0, remainingCapacity);

              for (const ticket of ticketsToLink) {
                const { error: linkError } = await supabase
                  .from("vip_linked_tickets")
                  .insert({
                    vip_reservation_id: vipReservation.id,
                    order_id: orderId,
                    ticket_id: ticket.id,
                    purchased_by_email: customerEmail,
                    purchased_by_name: customerName,
                    is_booker_purchase: false, // These are invited guests
                  });

                if (linkError) {
                  logger.error("Error linking ticket to VIP reservation", { ticketId: ticket.id, error: linkError.message });
                } else {
                  logger.info("Linked ticket to VIP reservation", { ticketId: ticket.id, reservationId: vipReservation.id });
                }
              }

              if (ticketsToLink.length < justCreatedTickets.length) {
                logger.warn("VIP table capacity reached", {
                  linked: ticketsToLink.length,
                  total: justCreatedTickets.length,
                  reservationId: vipReservation.id
                });
              }
            }
          } else {
            logger.warn("VIP reservation not found for invite code", { vipInviteCode });
          }
        }

        // Queue ticket confirmation email (non-blocking)
        // Email is queued for processing by the email queue processor
        if (createdTickets.length > 0 && customerEmail) {
          console.log("Queueing ticket email to:", customerEmail);
          sendTicketEmail(supabase, customerEmail, customerName, orderId, createdTickets).catch(err => {
            console.error('Failed to queue ticket email:', {
              error: err.message,
              orderId,
              email: customerEmail,
              ticketCount: createdTickets.length
            });
          });
        }
      } catch (parseError) {
        console.error("Error parsing tickets:", parseError);
      }
    }
  }

    // Handle VIP Table Payment Intent Succeeded
    if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const metadata = paymentIntent.metadata || {};

    // Check if this is a VIP table reservation
    if (metadata.type === "vip_table_reservation" && metadata.reservationId) {
      console.log("VIP table payment succeeded:", paymentIntent.id);

      const reservationId = metadata.reservationId;
      const eventId = metadata.eventId;
      const customerEmail = metadata.customerEmail;
      const customerName = metadata.customerName;
      const gaTicketCount = parseInt(metadata.gaTicketCount || "0");
      const gaTicketTypeId = metadata.gaTicketTypeId;
      const gaTicketPrice = parseFloat(metadata.gaTicketPrice || "0");
      const tableCapacity = parseInt(metadata.tableCapacity || "6");

      // Generate invite code
      const inviteCode = crypto.randomUUID().substring(0, 8).toUpperCase();

      // Update reservation to confirmed with invite code
      // Update reservation with retry
      try {
        await retryWithBackoff(async () => {
          const { error: updateError } = await supabase
            .from("vip_reservations")
            .update({
              status: "confirmed",
              invite_code: inviteCode,
              updated_at: new Date().toISOString(),
            })
            .eq("id", reservationId);

          if (updateError) {
            throw new Error(updateError.message);
          }
        }, 5, 500);

        console.log("VIP reservation confirmed with invite code:", inviteCode);
      } catch (updateError) {
        console.error("All VIP reservation update retries failed:", updateError);

        // Notify owner of failure
        notifyPaymentFailure({
          stripeEventId: event.id,
          stripePaymentIntentId: paymentIntent.id,
          customerEmail: customerEmail || '',
          amountCents: paymentIntent.amount || 0,
          errorMessage: updateError.message || 'Failed to confirm VIP reservation',
          paymentType: 'vip_reservation',
          eventId,
          metadata: {
            reservationId,
            action: 'confirm_reservation',
          }
        }).catch(err => {
          console.error('Failed to send payment failure notification:', err);
        });
        // Continue - payment succeeded, failure logged for manual resolution
      }

      // Get reservation details for guest passes
      const { data: reservation, error: reservationError } = await supabase
        .from("vip_reservations")
        .select("*, event_vip_tables(capacity)")
        .eq("id", reservationId)
        .single();

      if (!reservationError && reservation) {
        // Generate guest passes if not already created
        const { data: existingPasses } = await supabase
          .from("vip_guest_passes")
          .select("id")
          .eq("reservation_id", reservationId);

        if (!existingPasses || existingPasses.length === 0) {
          const capacity = reservation.event_vip_tables?.capacity || tableCapacity || 6;
          const guestPasses = [];

          for (let i = 1; i <= capacity; i++) {
            const passToken = `VIP-PASS-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

            // Generate consistent SHA-256 signature matching database format
            const signatureData = `${passToken}|${reservationId}|${i}`;
            const encoder = new TextEncoder();
            const data = encoder.encode(signatureData);
            const hashBuffer = await crypto.subtle.digest("SHA-256", data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const passSignature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

            guestPasses.push({
              reservation_id: reservationId,
              guest_number: i,
              qr_code_token: passToken,
              qr_signature: passSignature,
              status: "issued",
            });
          }

          const { error: passesError } = await supabase
            .from("vip_guest_passes")
            .insert(guestPasses);

          if (passesError) {
            console.error("Error creating guest passes:", passesError);
          } else {
            console.log(`Created ${guestPasses.length} guest passes for VIP reservation`);
          }
        }
      }

      // Handle GA tickets if included in the purchase
      if (gaTicketCount > 0 && gaTicketTypeId && eventId) {
        console.log(`Creating ${gaTicketCount} GA tickets for VIP reservation`);

        // Create order for GA tickets
        const { data: gaOrder, error: orderError } = await supabase
          .from("orders")
          .insert({
            event_id: eventId,
            customer_email: customerEmail,
            customer_name: customerName,
            status: "paid",
            total_amount: gaTicketCount * gaTicketPrice,
            stripe_session_id: paymentIntent.id,
          })
          .select()
          .single();

        if (orderError) {
          console.error("Error creating GA order:", orderError);
        } else {
          console.log("GA order created:", gaOrder.id);

          // Create individual GA tickets with retry
          for (let i = 0; i < gaTicketCount; i++) {
            const ticketId = `MGY-VIP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const qrToken = crypto.randomUUID();

            // Sign QR token via database RPC (secret in Supabase Vault)
            const qrSignature = await signQrToken(supabase, qrToken);

            const ticketData = {
              order_id: gaOrder.id,
              event_id: eventId,
              ticket_type_id: gaTicketTypeId,
              attendee_email: customerEmail,
              attendee_name: customerName,
              status: "issued",
              price: gaTicketPrice,
              fee_total: 0,
              ticket_id: ticketId,
              qr_token: qrToken,
              qr_signature: qrSignature,
              issued_at: new Date().toISOString(),
            };

            try {
              // Retry ticket creation with exponential backoff
              const ticket = await retryWithBackoff(async () => {
                const { data, error: ticketError } = await supabase
                  .from("tickets")
                  .insert(ticketData)
                  .select()
                  .single();

                if (ticketError) {
                  throw new Error(ticketError.message);
                }
                return data;
              }, 5, 500);

              console.log("GA ticket created:", ticket.id);

              // Link ticket to VIP reservation
              const { error: linkError } = await supabase
                .from("vip_linked_tickets")
                .insert({
                  vip_reservation_id: reservationId,
                  order_id: gaOrder.id,
                  ticket_id: ticket.id,
                  purchased_by_email: customerEmail,
                  purchased_by_name: customerName,
                  is_booker_purchase: true,
                });

              if (linkError) {
                console.error("Error linking ticket to VIP:", linkError);
              } else {
                console.log("Ticket linked to VIP reservation:", ticket.id);
              }
            } catch (ticketCreateError) {
              console.error("All GA ticket creation retries failed:", ticketCreateError);

              // Notify owner of failure
              notifyPaymentFailure({
                stripeEventId: event.id,
                stripePaymentIntentId: paymentIntent.id,
                customerEmail: customerEmail || '',
                amountCents: Math.round(gaTicketPrice * 100),
                errorMessage: ticketCreateError.message || 'Failed to create GA ticket',
                paymentType: 'ga_ticket',
                eventId,
                metadata: {
                  reservationId,
                  ticketIndex: i,
                  ticketId,
                  gaOrderId: gaOrder.id,
                }
              }).catch(err => {
                console.error('Failed to send payment failure notification:', err);
              });
              // Continue processing other tickets
            }
          }

          // Update ticket_types sold count
          const { error: countError } = await supabase
            .rpc("increment_tickets_sold", {
              p_ticket_type_id: gaTicketTypeId,
              p_count: gaTicketCount,
            });

          if (countError) {
            console.error("Error updating sold count:", countError);
          }
        }
      }

      // Send VIP confirmation email with invite link and GA tickets
      // Fetch event details for email
      const { data: eventData } = await supabase
        .from("events")
        .select("name, event_date, event_time, venue_name")
        .eq("id", eventId)
        .single();

      // Fetch full reservation details with table info
      const { data: fullReservation } = await supabase
        .from("vip_reservations")
        .select("*, event_vip_tables(table_number, tier, capacity, bottles_included)")
        .eq("id", reservationId)
        .single();

      // Fetch guest passes for this reservation
      const { data: guestPassesData } = await supabase
        .from("vip_guest_passes")
        .select("guest_number, qr_token, qr_signature")
        .eq("reservation_id", reservationId)
        .order("guest_number", { ascending: true });

      if (fullReservation && guestPassesData && guestPassesData.length > 0) {
        // Generate QR code images for each guest pass
        const emailGuestPasses = await Promise.all(
          guestPassesData.map(async (pass) => {
            const qrImageDataUrl = await generateQrCodeDataUrl(
              pass.qr_token,
              pass.qr_signature,
              { reservationId, guestNumber: pass.guest_number }
            );
            return {
              passNumber: pass.guest_number,
              qrToken: pass.qr_token,
              qrSignature: pass.qr_signature,
              qrImageDataUrl,
            };
          })
        );

        const tableInfo = fullReservation.event_vip_tables;
        const totalAmount = (fullReservation.amount_paid_cents || 0) / 100;

        // Queue VIP confirmation email (non-blocking)
        // Email is queued for processing by the email queue processor
        sendVipConfirmationEmail(supabase, {
          reservationId,
          eventId,
          reservationNumber: reservationId.substring(0, 8).toUpperCase(),
          customerName,
          customerEmail,
          eventName: eventData?.name || "Event",
          eventDate: eventData?.event_date || "",
          eventTime: eventData?.event_time || "9:00 PM",
          venueName: eventData?.venue_name || "Maguey Nightclub",
          tableName: `Table ${tableInfo?.table_number || fullReservation.table_number}`,
          tableNumber: tableInfo?.table_number || fullReservation.table_number || 0,
          tier: tableInfo?.tier || "standard",
          guestCount: tableInfo?.capacity || tableCapacity,
          bottlesIncluded: tableInfo?.bottles_included || 1,
          totalAmount,
          inviteCode,
          guestPasses: emailGuestPasses,
        }).catch(err => {
          console.error('Failed to queue VIP email:', {
            error: err.message,
            reservationId,
            email: customerEmail
          });
        });

        console.log("VIP confirmation email queued for:", customerEmail);
      } else {
        console.warn("Could not send VIP email - missing reservation or guest passes data");
      }
    }
  }

  // Update idempotency record with success response (non-blocking)
  if (idempotencyRecordId) {
    const responseData = { received: true, eventType: event.type };
    supabase.rpc('update_webhook_idempotency', {
      p_record_id: idempotencyRecordId,
      p_response_data: responseData,
      p_response_status: 200,
      p_metadata: {
        event_type: event.type,
        processed_at: new Date().toISOString()
      }
    }).catch(err => {
      // Log but don't fail - idempotency update is not critical path
      console.error('Failed to update idempotency record:', err);
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
} catch (error) {
  console.error("Webhook error:", error);

  // Report error to Sentry with context
  await captureError(error instanceof Error ? error : new Error(String(error)), {
    webhook_type: "stripe",
    requestId,
  });

  // Update idempotency record with error response (non-blocking)
  if (idempotencyRecordId) {
    // Need to access supabase in catch block
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );
    supabase.rpc('update_webhook_idempotency', {
      p_record_id: idempotencyRecordId,
      p_response_data: { error: error.message },
      p_response_status: 500
    }).catch(() => { }); // Silent fail
  }

  return new Response(JSON.stringify({ error: error.message }), {
    headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
    status: 500,
  });
}
});
