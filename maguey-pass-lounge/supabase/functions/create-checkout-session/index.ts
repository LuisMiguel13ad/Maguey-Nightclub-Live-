import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

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

    // Verify event exists and fetch ticket types
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select(`
        id, 
        name,
        ticket_types (
          id,
          name,
          price,
          fee,
          status
        )
      `)
      .eq("id", eventId)
      .single();

    if (eventError || !eventData) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    // Create a map of ticket types for quick lookup
    const ticketTypesMap = new Map(
      eventData.ticket_types.map((t: any) => [t.id, t])
    );

    // Validate and build secure line items
    // This ignores client-sent prices and uses DB prices
    const secureLineItems = [];
    const secureTicketsMetadata = [];

    // Helper to parse VIP info securely on the server
    const parseVipInfo = (ticketName: string) => {
      // Regex to extract VIP details - enforcing this on server side
      // Format examples: "VIP Table 11 - Standard (6 guests, 1 bottle)"
      const guestMatch = ticketName.match(/\((\d+) guests/);
      const tableMatch = ticketName.match(/VIP Table (\d+)/);

      // Determine tier (simple keyword match)
      let tier = "standard";
      const lowerName = ticketName.toLowerCase();
      if (lowerName.includes("front row")) tier = "front_row";
      else if (lowerName.includes("premium")) tier = "premium";
      else if (lowerName.includes("owner")) tier = "owner";

      return {
        is_vip: lowerName.includes("vip table"),
        guest_count: guestMatch ? parseInt(guestMatch[1], 10) : 1,
        table_number: tableMatch ? parseInt(tableMatch[1], 10) : null,
        tier: tier
      };
    };

    let calculatedTotal = 0;
    let calculatedFees = 0;

    for (const ticketRequest of tickets) {
      const dbTicket = ticketTypesMap.get(ticketRequest.ticketTypeId);

      if (!dbTicket) {
        return new Response(
          JSON.stringify({ error: `Invalid ticket type: ${ticketRequest.ticketTypeId}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
        );
      }

      const unitPrice = dbTicket.price;
      const unitFee = dbTicket.fee;
      const quantity = ticketRequest.quantity;

      calculatedTotal += (unitPrice + unitFee) * quantity;
      calculatedFees += unitFee * quantity;

      // Generate structured metadata for this ticket
      const vipInfo = parseVipInfo(dbTicket.name);

      // Add to metadata array
      secureTicketsMetadata.push({
        ticketTypeId: dbTicket.id,
        displayName: dbTicket.name,
        quantity: quantity,
        price: unitPrice,
        fee: unitFee,
        // Structured VIP Data
        ...vipInfo
      });

      // Add to Stripe Line Items
      secureLineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: dbTicket.name,
            metadata: {
              ticket_type_id: dbTicket.id,
              event_id: eventId,
              // Store critical VIP info in product metadata too
              is_vip: String(vipInfo.is_vip),
              guest_count: String(vipInfo.guest_count),
              table_number: vipInfo.table_number ? String(vipInfo.table_number) : null
            },
          },
          unit_amount: Math.round((unitPrice + unitFee) * 100),
        },
        quantity: quantity,
      });
    }

    // Create order in database first
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        event_id: eventId,
        purchaser_email: customerEmail,
        purchaser_name: customerName,
        subtotal: calculatedTotal - calculatedFees,
        fees_total: calculatedFees,
        total: calculatedTotal,
        payment_provider: "stripe",
        status: "pending",
        metadata: { tickets: secureTicketsMetadata }, // Store the secure metadata
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
      line_items: secureLineItems,
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&orderId=${order.id}`,
      cancel_url: `${cancelUrl}?canceled=true&orderId=${order.id}`,
      metadata: {
        orderId: order.id,
        eventId,
        customerEmail,
        customerName,
        // Pass the SECURE, server-generated ticket metadata
        tickets: JSON.stringify(secureTicketsMetadata),
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
