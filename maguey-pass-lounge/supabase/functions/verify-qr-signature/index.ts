import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

const textEncoder = new TextEncoder();

/**
 * Verify HMAC-SHA256 signature using Web Crypto API
 * Uses constant-time comparison to prevent timing attacks
 */
async function verifySignature(token: string, signature: string, secret: string): Promise<boolean> {
  if (!secret || !token || !signature) {
    return false;
  }

  try {
    // Import the HMAC key
    const key = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Generate signature from token
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      textEncoder.encode(token)
    );

    // Convert to base64 (same encoding as client)
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // Constant-time comparison to prevent timing attacks
    if (expectedSignature.length !== signature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error('[verify-qr-signature] Verification error:', error);
    // Fail closed - any error means reject
    return false;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ valid: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      }
    );
  }

  try {
    // Read QR signing secret from server-side environment (NOT client-side)
    const secret = Deno.env.get("QR_SIGNING_SECRET");

    if (!secret) {
      // Never reveal what's missing - generic error
      console.error('[verify-qr-signature] QR_SIGNING_SECRET not configured');
      return new Response(
        JSON.stringify({ valid: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
        }
      );
    }

    // Parse request body
    const { token, signature } = await req.json();

    // Validate inputs
    if (!token || !signature) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing token or signature" }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
        }
      );
    }

    // Verify signature
    const valid = await verifySignature(token, signature, secret);

    // Return result
    return new Response(
      JSON.stringify({ valid }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('[verify-qr-signature] Request processing error:', error);
    // Fail closed - any parsing/processing error means reject
    return new Response(
      JSON.stringify({ valid: false, error: "Invalid request" }),
      {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      }
    );
  }
});
