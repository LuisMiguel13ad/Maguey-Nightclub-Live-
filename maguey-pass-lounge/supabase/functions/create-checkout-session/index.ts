import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate limiting
  const { allowed, response: rateLimitResponse } = await checkRateLimit(req, 'payment');
  if (!allowed) {
    return rateLimitResponse!;
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const {
      eventId,
      tickets,
      customerEmail,
      customerName,
      totalAmount,
      feesAmount,
      successUrl,
      cancelUrl,
      vipInviteCode,
    } = await req.json();

    console.log("Creating checkout for:", { eventId, tickets, customerEmail, totalAmount });

    // Validate required fields
    if (
      !eventId ||
      !tickets ||
      tickets.length === 0 ||
      !customerEmail ||
      !customerName ||
      !totalAmount ||
      !successUrl ||
      !cancelUrl
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    // Verify event exists
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    // Create order in database first
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        event_id: eventId,
        purchaser_email: customerEmail,
        purchaser_name: customerName,
        subtotal: totalAmount - (feesAmount || 0),
        fees_total: feesAmount || 0,
        total: totalAmount,
        payment_provider: "stripe",
        status: "pending",
        metadata: { tickets },
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("Order creation error:", orderError);
      return new Response(
        JSON.stringify({ error: `Failed to create order: ${orderError?.message || "Unknown error"}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    console.log("Order created:", order.id);

    // Create Stripe Checkout Session (hosted payment page)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail,
      line_items: tickets.map((ticket) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: `${ticket.displayName}`,
            metadata: {
              ticket_type_id: ticket.ticketTypeId,
              event_id: eventId,
            },
          },
          unit_amount: Math.round((ticket.unitPrice + ticket.unitFee) * 100),
        },
        quantity: ticket.quantity,
      })),
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&orderId=${order.id}`,
      cancel_url: `${cancelUrl}?canceled=true&orderId=${order.id}`,
      metadata: {
        orderId: order.id,
        eventId,
        customerEmail,
        customerName,
        tickets: JSON.stringify(tickets),
        // VIP invite code for linking GA tickets to VIP reservations
        ...(vipInviteCode && { vipInviteCode }),
      },
    });

    // Update order with payment reference
    await supabase
      .from("orders")
      .update({
        payment_reference: session.id,
        metadata: {
          tickets,
          stripeSessionId: session.id,
        },
      })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
        orderId: order.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
