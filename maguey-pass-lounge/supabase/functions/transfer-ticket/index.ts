import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  // Rate limiting: 20 req/min per IP (same tier as payment endpoints)
  const { allowed, response: rateLimitResponse } = await checkRateLimit(req, "payment");
  if (!allowed) {
    return rateLimitResponse!;
  }

  try {
    const { ticketId, currentHolderEmail, newHolderEmail, newHolderName } =
      await req.json();

    // Validate required fields
    if (!ticketId || !currentHolderEmail || !newHolderEmail || !newHolderName) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: ticketId, currentHolderEmail, newHolderEmail, newHolderName",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Validate email format
    if (!EMAIL_REGEX.test(newHolderEmail) || !EMAIL_REGEX.test(currentHolderEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Client-side self-transfer guard (RPC also enforces this)
    if (currentHolderEmail.toLowerCase() === newHolderEmail.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Cannot transfer to yourself" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Call atomic transfer RPC — handles row locking, QR regeneration, and audit record
    const { data: transferResult, error: rpcError } = await supabase.rpc(
      "transfer_ticket_atomic",
      {
        p_ticket_id: ticketId,
        p_current_holder_email: currentHolderEmail,
        p_new_holder_email: newHolderEmail,
        p_new_holder_name: newHolderName,
      }
    );

    if (rpcError) {
      const message = rpcError.message || "";
      console.error("Transfer RPC error:", rpcError);

      if (message.includes("not found") || message.includes("not owned")) {
        return new Response(
          JSON.stringify({ error: "Ticket not found or you don't own this ticket" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
      if (message.includes("yourself")) {
        return new Response(
          JSON.stringify({ error: "Cannot transfer to yourself" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      if (message.includes("already used") || message.includes("checked")) {
        return new Response(
          JSON.stringify({
            error: "This ticket has already been used and cannot be transferred",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }
      if (message.includes("event has started")) {
        return new Response(
          JSON.stringify({
            error: "Tickets cannot be transferred after the event has started",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }

      return new Response(
        JSON.stringify({ error: `Transfer failed: ${message}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const result = transferResult as {
      event_name: string;
      event_date: string;
      ticket_type_name: string;
      previous_name: string;
      transfer_id: string;
    };

    console.log("Ticket transferred successfully:", {
      ticketId,
      transferId: result.transfer_id,
    });

    const siteUrl =
      Deno.env.get("SITE_URL") || "https://tickets.magueynightclub.com";

    // Queue email to new ticket holder
    const { error: recipientEmailErr } = await supabase.from("email_queue").insert({
      email_type: "ticket_transfer_received",
      recipient_email: newHolderEmail,
      subject: `You received a ticket for ${result.event_name}`,
      html_body: `
        <h2>You received a ticket!</h2>
        <p><strong>${result.previous_name || currentHolderEmail}</strong> has transferred a ticket to you.</p>
        <p><strong>Event:</strong> ${result.event_name}</p>
        <p><strong>Date:</strong> ${result.event_date}</p>
        <p><strong>Ticket Type:</strong> ${result.ticket_type_name}</p>
        <p>Log in to your account at <a href="${siteUrl}">${siteUrl}</a> to view your ticket and QR code.</p>
        <p>If you don't have an account, sign up with this email address to claim your ticket.</p>
      `,
      related_id: ticketId,
      status: "pending",
      attempt_count: 0,
      max_attempts: 5,
      next_retry_at: new Date().toISOString(),
    });
    if (recipientEmailErr) {
      console.error("Failed to queue recipient email:", recipientEmailErr.message);
    }

    // Queue confirmation email to sender
    const { error: senderEmailErr } = await supabase.from("email_queue").insert({
      email_type: "ticket_transfer_sent",
      recipient_email: currentHolderEmail,
      subject: `Ticket transferred to ${newHolderName}`,
      html_body: `
        <h2>Ticket Transfer Confirmed</h2>
        <p>Your ticket has been successfully transferred to <strong>${newHolderName}</strong> (${newHolderEmail}).</p>
        <p><strong>Event:</strong> ${result.event_name}</p>
        <p><strong>Date:</strong> ${result.event_date}</p>
        <p><strong>Ticket Type:</strong> ${result.ticket_type_name}</p>
        <p>Your original QR code is no longer valid. A new QR code has been issued to the recipient.</p>
      `,
      related_id: ticketId,
      status: "pending",
      attempt_count: 0,
      max_attempts: 5,
      next_retry_at: new Date().toISOString(),
    });
    if (senderEmailErr) {
      console.error("Failed to queue sender email:", senderEmailErr.message);
    }

    // Append ticket event for audit trail (non-blocking — don't fail transfer if this errors)
    supabase
      .rpc("append_ticket_event", {
        p_aggregate_id: ticketId,
        p_event_type: "TicketTransferred",
        p_event_data: {
          fromEmail: currentHolderEmail,
          toEmail: newHolderEmail,
          toName: newHolderName,
          transferId: result.transfer_id,
        },
        p_metadata: {},
        p_correlation_id: null,
        p_causation_id: null,
        p_occurred_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) {
          console.error("Failed to append ticket event:", error.message);
        }
      });

    return new Response(
      JSON.stringify({ success: true, ticketId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Transfer ticket error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
