import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1.34.0";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

// Svix headers for Resend webhook signature verification
const SVIX_HEADERS = "svix-id, svix-timestamp, svix-signature";

// Resend webhook event types and payload structure
interface ResendWebhookEvent {
  type: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // Bounce-specific fields
    bounce?: {
      message: string;
      type: string;
    };
    // Additional event-specific data
    [key: string]: unknown;
  };
}

serve(async (req) => {
  // Handle CORS preflight with Svix headers
  const corsResponse = handleCorsPreFlight(req, SVIX_HEADERS);
  if (corsResponse) return corsResponse;

  try {
    // Check for webhook secret configuration
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");

    if (!webhookSecret) {
      console.error("RESEND_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({
          error: "Server misconfigured",
          message: "RESEND_WEBHOOK_SECRET environment variable is not set. Please configure it in the Supabase Dashboard.",
        }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req, SVIX_HEADERS), "Content-Type": "application/json" },
        }
      );
    }

    // Get raw body for signature verification (MUST be done BEFORE any parsing)
    // Svix signature verification requires the exact raw body bytes
    const rawBody = await req.text();

    // Verify webhook signature using svix
    // Resend uses Svix infrastructure for webhook delivery
    const wh = new Webhook(webhookSecret);
    const svixHeaders = {
      "svix-id": req.headers.get("svix-id") || "",
      "svix-timestamp": req.headers.get("svix-timestamp") || "",
      "svix-signature": req.headers.get("svix-signature") || "",
    };

    // Verify the webhook signature
    let event: ResendWebhookEvent;
    try {
      event = wh.verify(rawBody, svixHeaders) as ResendWebhookEvent;
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...getCorsHeaders(req, SVIX_HEADERS), "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service role for database operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { type, data } = event;
    const resendEmailId = data.email_id;
    const now = new Date().toISOString();

    console.log(`Resend webhook: ${type} for email ${resendEmailId}`);

    // Update email_queue status based on event type
    switch (type) {
      case "email.sent":
        // Email accepted by Resend - we already mark as 'sent' when we get the response
        // This is a confirmation, no status update needed
        console.log(`Email ${resendEmailId} confirmed sent by Resend`);
        break;

      case "email.delivered":
        // Email successfully delivered to recipient's mail server
        await supabase
          .from("email_queue")
          .update({
            status: "delivered",
            updated_at: now,
          })
          .eq("resend_email_id", resendEmailId);
        console.log(`Email ${resendEmailId} delivered successfully`);
        break;

      case "email.delivery_delayed":
        // Delivery is delayed - log but don't change status, may still succeed
        console.warn(`Email ${resendEmailId} delivery delayed`);
        break;

      case "email.bounced":
        // Email bounced - permanent failure
        await supabase
          .from("email_queue")
          .update({
            status: "failed",
            last_error: `Bounced: ${data.bounce?.message || "Unknown bounce reason"}`,
            error_context: {
              bounce_type: data.bounce?.type,
              bounce_message: data.bounce?.message,
              webhook_received: now,
            },
            updated_at: now,
          })
          .eq("resend_email_id", resendEmailId);
        console.error(`Email ${resendEmailId} bounced: ${data.bounce?.message}`);
        break;

      case "email.complained":
        // Recipient marked as spam - treat as failure to avoid future issues
        await supabase
          .from("email_queue")
          .update({
            status: "failed",
            last_error: "Recipient marked email as spam",
            error_context: {
              complaint: true,
              webhook_received: now,
            },
            updated_at: now,
          })
          .eq("resend_email_id", resendEmailId);
        console.warn(`Email ${resendEmailId} marked as spam by recipient`);
        break;

      default:
        console.log(`Unhandled Resend event type: ${type}`);
    }

    // Store in email_delivery_status for audit trail (all events, regardless of type)
    const { error: insertError } = await supabase
      .from("email_delivery_status")
      .insert({
        resend_email_id: resendEmailId,
        event_type: type,
        event_data: data,
      });

    if (insertError) {
      console.error("Error inserting delivery status:", insertError);
      // Don't fail the webhook - status update is more important than audit log
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req, SVIX_HEADERS), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Resend webhook error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req, SVIX_HEADERS), "Content-Type": "application/json" },
      }
    );
  }
});
