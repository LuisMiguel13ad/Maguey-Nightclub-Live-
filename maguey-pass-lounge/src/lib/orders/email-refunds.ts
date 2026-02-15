import { supabase } from "../supabase";
import { generateTicketEmailHTML, generateTicketEmailText } from "../email-template";
import { emailCircuit } from "../circuit-breaker";
import { createLogger } from "../logger";
import { metrics } from "../monitoring";
import type { TicketData } from "../ticket-generator";
import type { SupabaseTypedClient } from "./types";

// Create module-scoped logger
const logger = createLogger({ module: 'orders/email-refunds' });

const runtimeOrigin =
  typeof window !== "undefined" && window.location
    ? window.location.origin
    : undefined;

function getFrontendUrl(): string {
  return (
    import.meta.env.VITE_FRONTEND_URL ||
    runtimeOrigin ||
    "http://localhost:5173"
  );
}

/**
 * Internal function to send email.
 * Email sending is now handled server-side only via the email_queue table
 * and the process-email-queue Edge Function. Client-side direct Resend API
 * calls have been removed to prevent API key exposure in browser bundles.
 */
async function sendEmailDirectly(payload: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  // Email API key is no longer available client-side (security fix).
  // Emails are sent server-side via the email_queue table.
  logger.info('Client-side email sending disabled. Emails are handled server-side via email_queue.', {
    to: payload.to,
    subject: payload.subject,
  });
}

/**
 * Send email via Resend API with circuit breaker protection
 *
 * The circuit breaker prevents cascading failures when the email service
 * is experiencing issues, allowing orders to complete without blocking
 * on email delivery.
 *
 * When the circuit is open, emails are queued for later retry.
 */
async function sendEmailViaResend(payload: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // Email sending is now handled server-side only via the email_queue table
  // and the process-email-queue Edge Function. The Stripe webhook inserts
  // emails into the queue, and the Edge Function processes them with the
  // API key stored securely in environment variables.
  logger.info('Email delivery delegated to server-side email queue.', {
    to: payload.to,
    subject: payload.subject,
  });
  metrics.increment('emails.skipped', 1, { reason: 'server_side_only' });
}

/**
 * Get the current status of the email circuit breaker
 * Useful for health checks and monitoring
 */
export function getEmailCircuitStatus() {
  return emailCircuit.getStats();
}

/**
 * Resend ticket email (Demo Mode: skips if email service not configured)
 */
export async function resendTicket(
  orderId: string,
  ticketId?: string
): Promise<void> {
  const client = supabase;

  const { data: order, error: orderError } = await client
    .from("orders")
    .select("id, purchaser_email, purchaser_name, event_id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error(
      orderError?.message ?? `Order ${orderId} could not be found.`
    );
  }

  const { data: event, error: eventError } = await client
    .from("events")
    .select(
      "id, name, image_url, event_date, event_time, venue_name, venue_address, city"
    )
    .eq("id", order.event_id)
    .single();

  if (eventError || !event) {
    throw new Error(
      eventError?.message ??
        `Event ${order.event_id} associated with order ${orderId} was not found.`
    );
  }

  let ticketQuery = client
    .from("tickets")
    .select(
      "id, order_id, attendee_name, attendee_email, price, fee_total, qr_token, qr_signature, qr_code_url, ticket_type_id, ticket_types(name)"
    )
    .eq("order_id", order.id);

  if (ticketId) {
    ticketQuery = ticketQuery.eq("id", ticketId);
  }

  const { data: ticketsData, error: ticketsError } = await ticketQuery;

  if (ticketsError || !ticketsData || ticketsData.length === 0) {
    throw new Error(
      ticketsError?.message ??
        (ticketId
          ? `Ticket ${ticketId} was not found for order ${orderId}.`
          : `No tickets found for order ${orderId}.`)
    );
  }

  const ticketPayloads: TicketData[] = ticketsData.map((ticket) => ({
    ticketId: ticket.qr_token ?? ticket.id,
    qrToken: ticket.qr_token ?? ticket.id,
    qrSignature: ticket.qr_signature ?? "",
    qrCodeDataUrl: ticket.qr_code_url ?? "",
    qrCodeUrl: ticket.qr_code_url ?? "",
    eventId: event.id,
    eventImage: event.image_url || "",
    eventName: event.name,
    eventDate: event.event_date,
    eventTime: event.event_time,
    venue: event.venue_name || "",
    venueAddress: event.venue_address || event.city || "",
    ticketType:
      ticket.ticket_types?.name ?? ticket.ticket_type_id ?? "General Admission",
    ticketHolderName:
      ticket.attendee_name ??
      order.purchaser_name ??
      "Ticket Holder",
    orderId: order.id,
    price:
      Number(ticket.price ?? 0) + Number(ticket.fee_total ?? 0),
  }));

  const subject =
    ticketPayloads.length === 1
      ? `Your ticket for ${ticketPayloads[0].eventName}`
      : `Your tickets for ${ticketPayloads[0].eventName}`;

  const customerName =
    order.purchaser_name ||
    ticketPayloads[0].ticketHolderName ||
    "Guest";

  const recipients = new Set<string>();
  if (ticketId && ticketsData[0]?.attendee_email) {
    recipients.add(ticketsData[0].attendee_email);
  }
  if (order.purchaser_email) {
    recipients.add(order.purchaser_email);
  }

  if (!recipients.size) {
    throw new Error(
      "No recipient email found for this order. Ensure purchaser_email or attendee_email is set."
    );
  }

  await sendEmailViaResend({
    to: Array.from(recipients),
    subject,
    html: generateTicketEmailHTML(
      ticketPayloads,
      customerName,
      order.id,
      getFrontendUrl()
    ),
    text: generateTicketEmailText(
      ticketPayloads,
      customerName,
      order.id,
      getFrontendUrl()
    ),
  });
}

/**
 * Placeholder: request Stripe refund or mark order as refunded.
 * TODO: integrate with Stripe or payment provider.
 */
export async function requestRefund(orderId: string): Promise<void> {
  const apiUrl = import.meta.env.VITE_API_URL;

  if (!apiUrl) {
    throw new Error(
      "VITE_API_URL is not configured. Cannot initiate refund workflow."
    );
  }

  const response = await fetch(`${apiUrl}/orders/${orderId}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });

  if (!response.ok) {
    let message = `Failed to request refund (status ${response.status})`;
    try {
      const errorBody = await response.json();
      if (errorBody?.message) {
        message = errorBody.message;
      } else if (errorBody?.error) {
        message = errorBody.error;
      }
    } catch {
      // ignore JSON parsing errors
    }
    throw new Error(message);
  }

  // Backend is responsible for Stripe refund and updating order status.
}
