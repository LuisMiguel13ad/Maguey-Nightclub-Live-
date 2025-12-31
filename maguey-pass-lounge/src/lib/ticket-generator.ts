/**
 * Ticket Generation Utility
 * Generates secure ticket identifiers and locally signed QR codes.
 *
 * Scanner NOTE:
 *   The scanner application MUST recompute the HMAC signature with the same
 *   VITE_QR_SIGNING_SECRET and compare it to the signature embedded in the QR
 *   payload before marking a ticket as scanned. See TODO in createTicketQr().
 */

import QRCode from "qrcode";

const textEncoder = new TextEncoder();

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "Web Crypto API is unavailable. Ensure this code runs in an environment with crypto.subtle support."
    );
  }
  return subtle;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function importSigningKey(): Promise<CryptoKey> {
  const secret = import.meta.env.VITE_QR_SIGNING_SECRET;
  if (!secret) {
    throw new Error(
      "VITE_QR_SIGNING_SECRET is missing. Set it in your .env file to sign QR payloads."
    );
  }

  return getSubtleCrypto().importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

export interface SecureQrPayload {
  token: string;
  signature: string;
  rawPayload: string;
}

export async function generateSecureQrPayload(
  additionalData?: Record<string, unknown>
): Promise<SecureQrPayload> {
  const token = crypto.randomUUID();
  const key = await importSigningKey();
  const signatureBuffer = await getSubtleCrypto().sign(
    "HMAC",
    key,
    textEncoder.encode(token)
  );
  const signature = bufferToBase64(signatureBuffer);

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

  // TODO(scanner): Verify qrDataUrl by decoding the payload, recomputing
  // the HMAC signature with VITE_QR_SIGNING_SECRET, and rejecting mismatches.

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

