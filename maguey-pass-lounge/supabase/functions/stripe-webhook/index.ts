import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// ============================================
// QR Code Signing (HMAC-SHA256)
// ============================================

async function generateQrSignature(token: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(token)
  );
  return base64Encode(signatureBuffer);
}

// ============================================
// Email Service (Resend)
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

async function sendTicketEmail(
  to: string,
  customerName: string,
  orderId: string,
  tickets: TicketEmailData[]
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY") || Deno.env.get("VITE_EMAIL_API_KEY");
  const fromEmail = Deno.env.get("EMAIL_FROM_ADDRESS") || Deno.env.get("VITE_EMAIL_FROM_ADDRESS") || "tickets@magueynightclub.com";

  if (!resendApiKey) {
    console.warn("No Resend API key configured, skipping email");
    return;
  }

  const eventName = tickets[0]?.eventName || "Event";

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
          <h1 style="color: #6366f1; margin: 0;">🎫 MAGUEY</h1>
        </div>

        <div style="background: #10b981; color: white; padding: 15px; border-radius: 6px; text-align: center; margin-bottom: 30px;">
          ✅ Payment Successful! Your tickets are confirmed.
        </div>

        <p>Hi ${customerName},</p>
        <p>Thank you for your purchase! Your digital tickets for <strong>${eventName}</strong> are ready.</p>

        ${ticketHtml}

        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #856404;">⚠️ Important Information</h3>
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

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `Your Maguey Tickets - Order Confirmed`,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to send email:", response.status, errorText);
    } else {
      console.log("Ticket email sent successfully to:", to);
    }
  } catch (error) {
    console.error("Error sending email:", error);
  }
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
      console.error("Missing timestamp or signature");
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

    return expectedSignature === v1Signature;
  } catch (error) {
    console.error("Signature verification error:", error);
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

    // Verify Stripe webhook signature in production
    if (webhookSecret && signature) {
      const isValid = await verifyStripeSignature(body, signature, webhookSecret);
      if (!isValid) {
        console.error("Invalid Stripe webhook signature");
        return new Response("Invalid signature", { status: 401 });
      }
      console.log("Webhook signature verified successfully");
    } else {
      console.warn("Webhook signature verification skipped (no secret or signature)");
    }

    const event = JSON.parse(body);
    console.log("Webhook event received:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      console.log("Checkout session completed:", session.id);

      const orderId = session.metadata?.orderId;
      const eventId = session.metadata?.eventId;
      const customerEmail = session.metadata?.customerEmail || session.customer_email;
      const customerName = session.metadata?.customerName || "Guest";
      const ticketsData = session.metadata?.tickets;

      if (!orderId) {
        console.error("No orderId in session metadata");
        return new Response("Missing orderId", { status: 400 });
      }

      // Update order status to paid
      const { error: orderError } = await supabase
        .from("orders")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (orderError) {
        console.error("Error updating order:", orderError);
      } else {
        console.log("Order updated to paid:", orderId);
      }

      // Process tickets/VIP tables
      if (ticketsData && eventId) {
        try {
          const tickets = JSON.parse(ticketsData);
          console.log("Processing tickets:", tickets);

          // Fetch event details for email
          const { data: eventData } = await supabase
            .from("events")
            .select("name, event_date, event_time, venue_name")
            .eq("id", eventId)
            .single();

          const qrSigningSecret = Deno.env.get("QR_SIGNING_SECRET") || Deno.env.get("VITE_QR_SIGNING_SECRET") || "";
          const createdTickets: TicketEmailData[] = [];

          for (const ticket of tickets) {
            // Check if this is a VIP table reservation
            const vipInfo = parseVipTableInfo(ticket.ticketTypeId);

            if (vipInfo) {
              // This is a VIP table reservation
              console.log("Processing VIP table reservation:", vipInfo);

              const tableNumber = extractTableNumber(ticket.displayName);
              const nameParts = customerName.split(" ");
              const firstName = nameParts[0] || "Guest";
              const lastName = nameParts.slice(1).join(" ") || "";

              // Extract guest count from displayName: "VIP Table 11 - Standard (6 guests, 1 bottle)"
              const guestMatch = ticket.displayName.match(/\((\d+) guests/);
              const guestCount = guestMatch ? parseInt(guestMatch[1], 10) : 6;

              // Find the event_vip_table record to get the ID
              const { data: eventVipTable, error: tableError } = await supabase
                .from("event_vip_tables")
                .select("id")
                .eq("event_id", eventId)
                .eq("table_number", tableNumber)
                .single();

              if (tableError) {
                console.error("Error finding event_vip_table:", tableError);
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
                stripe_charge_id: null,
                amount_paid_cents: Math.round(ticket.unitPrice * 100),
                status: "confirmed",
                confirmed_at: new Date().toISOString(),
                qr_code_token: qrCodeToken,
                package_snapshot: {
                  tier: vipInfo.tier,
                  tableNumber,
                  guestCount,
                  price: ticket.unitPrice,
                  displayName: ticket.displayName,
                  orderId,
                  sessionId: session.id,
                },
                disclaimer_accepted_at: new Date().toISOString(),
                refund_policy_accepted_at: new Date().toISOString(),
              };

              console.log("Creating VIP reservation:", reservationData);

              const { data: reservation, error: reservationError } = await supabase
                .from("vip_reservations")
                .insert(reservationData)
                .select()
                .single();

              if (reservationError) {
                console.error("Error creating VIP reservation:", reservationError);
              } else {
                console.log("VIP reservation created:", reservation.id);

                // Mark the table as unavailable
                if (eventVipTable?.id) {
                  const { error: updateTableError } = await supabase
                    .from("event_vip_tables")
                    .update({ is_available: false })
                    .eq("id", eventVipTable.id);

                  if (updateTableError) {
                    console.error("Error updating table availability:", updateTableError);
                  } else {
                    console.log("Table marked as unavailable:", tableNumber);
                  }
                }
              }
            } else {
              // This is a regular ticket - create ticket records
              for (let i = 0; i < ticket.quantity; i++) {
                const ticketId = `MGY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                const qrToken = crypto.randomUUID();

                // Generate HMAC signature for QR token (required for scanner verification)
                let qrSignature = "";
                if (qrSigningSecret) {
                  qrSignature = await generateQrSignature(qrToken, qrSigningSecret);
                }

                const { error: ticketError } = await supabase
                  .from("tickets")
                  .insert({
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
                  });

                if (ticketError) {
                  console.error("Error creating ticket:", ticketError);
                } else {
                  console.log("Ticket created with signature:", ticketId);

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
                }
              }
            }
          }

          // Send ticket confirmation email
          if (createdTickets.length > 0 && customerEmail) {
            console.log("Sending ticket email to:", customerEmail);
            await sendTicketEmail(customerEmail, customerName, orderId, createdTickets);
          }
        } catch (parseError) {
          console.error("Error parsing tickets:", parseError);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
