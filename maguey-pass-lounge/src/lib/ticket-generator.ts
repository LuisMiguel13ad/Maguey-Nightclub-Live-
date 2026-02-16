/**
 * Ticket Generation Utility
 * Generates ticket identifiers and QR codes with unique tokens.
 *
 * QR signing is handled server-side (Stripe webhook or PostgreSQL RPC).
 * Client-side code generates unsigned QR tokens for display purposes only.
 */

import QRCode from "qrcode";

export interface SecureQrPayload {
  token: string;
  signature: string;
  rawPayload: string;
}

export async function generateSecureQrPayload(
  additionalData?: Record<string, unknown>
): Promise<SecureQrPayload> {
  const token = crypto.randomUUID();

  // Client-side signing removed for security. The server generates
  // the authoritative HMAC signature when tickets are created via
  // the Stripe webhook or the create_order_with_tickets_atomic RPC.
  const signature = "";

  const rawPayload = JSON.stringify({
    token,
    signature,
    meta: additionalData ?? null,
  });

  return { token, signature, rawPayload };
}

export async function generateQrImage(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: "M",
    margin: 2,
    type: "image/png",
  });
}

export async function createTicketQr(
  ticketInfo?: Record<string, unknown>
): Promise<SecureQrPayload & { qrDataUrl: string }> {
  const payload = await generateSecureQrPayload(ticketInfo);
  const qrDataUrl = await generateQrImage(payload.rawPayload);

  return {
    ...payload,
    qrDataUrl,
  };
}

/**
 * Generate secure ticket IDs (UUIDs).
 */
export function generateTicketId(): string {
  return crypto.randomUUID();
}

/**
 * Generate secure ticket IDs (UUIDs) for a batch.
 * The `eventDate` argument is retained for backward compatibility but ignored.
 */
export function generateUniqueTicketIds(
  _eventDate: string | Date,
  quantity: number
): string[] {
  const ticketIds = new Set<string>();

  while (ticketIds.size < quantity) {
    ticketIds.add(generateTicketId());
  }

  return Array.from(ticketIds);
}

export interface TicketData {
  /**
   * Secure token assigned to the ticket. Alias for backward compatibility.
   */
  ticketId: string;
  qrToken: string;
  qrSignature: string;
  /**
   * Data URL representation of the QR code.
   * Legacy field qrCodeUrl kept for compatibility.
   */
  qrCodeDataUrl: string;
  qrCodeUrl: string;
  eventId: string;
  eventImage: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  venueAddress: string;
  ticketType: string;
  ticketHolderName: string;
  orderId: string;
  price: number;
}

export async function createTicketData(params: {
  eventId: string;
  eventImage: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  venueAddress: string;
  ticketType: string;
  ticketHolderName: string;
  orderId: string;
  price: number;
}): Promise<TicketData> {
  const qr = await createTicketQr({
    eventId: params.eventId,
    orderId: params.orderId,
    ticketType: params.ticketType,
  });

  return {
    ticketId: qr.token,
    qrToken: qr.token,
    qrSignature: qr.signature,
    qrCodeDataUrl: qr.qrDataUrl,
    qrCodeUrl: qr.qrDataUrl, // kept for backwards compatibility
    eventId: params.eventId,
    eventImage: params.eventImage,
    eventName: params.eventName,
    eventDate: params.eventDate,
    eventTime: params.eventTime,
    venue: params.venue,
    venueAddress: params.venueAddress,
    ticketType: params.ticketType,
    ticketHolderName: params.ticketHolderName,
    orderId: params.orderId,
    price: params.price,
  };
}

