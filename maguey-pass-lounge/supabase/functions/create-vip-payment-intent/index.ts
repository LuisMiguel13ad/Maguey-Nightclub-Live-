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

    const body = await req.json();
    const {
      eventId,
      tableId,
      tableNumber,
      tableTier,
      tablePrice,
      tableCapacity,
      bottlesIncluded,
      customerEmail,
      customerName,
      customerPhone,
      guestCount,
      celebration,
      celebrantName,
      specialRequests,
      bottlePreferences,
      estimatedArrival,
      // GA ticket integration (REQUIRED for unified checkout)
      ticketTierId,
      ticketTierName,
      ticketPriceCents,
    } = body;

    console.log("Creating unified VIP payment intent for:", { eventId, tableId, customerEmail, tablePrice, ticketTierId });

    // Validate required fields (including GA ticket for unified checkout)
    // Note: tablePrice and ticketPriceCents are intentionally NOT required from the client.
    // Prices are fetched server-side from the database to prevent price tampering.
    if (!eventId || !tableId || !customerEmail || !customerName || !ticketTierId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields. VIP checkout requires GA ticket selection." }),
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
      console.error("Event lookup error:", eventError);
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    // Verify table exists and is available
    const { data: table, error: tableError } = await supabase
      .from("event_vip_tables")
      .select("*")
      .eq("id", tableId)
      .single();

    if (tableError || !table) {
      console.error("Table lookup error:", tableError);
      return new Response(
        JSON.stringify({ error: "Table not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    if (!table.is_available) {
      return new Response(
        JSON.stringify({ error: "Table is no longer available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    // Fetch GA ticket price from database (never trust client-sent prices)
    const { data: ticketType, error: ticketTypeError } = await supabase
      .from("ticket_types")
      .select("id, name, price, fee")
      .eq("id", ticketTierId)
      .single();

    if (ticketTypeError || !ticketType) {
      console.error("Ticket type lookup error:", ticketTypeError);
      return new Response(
        JSON.stringify({ error: "Ticket type not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    // Calculate prices from DATABASE values, not client input
    const vipTablePriceCents = Math.round(Number(table.price) * 100);
    const serverTicketPriceCents = Math.round((ticketType.price + (ticketType.fee || 0)) * 100);
    const totalAmountCents = vipTablePriceCents + serverTicketPriceCents;

    // Build package snapshot with booking details (using server-side prices)
    const packageSnapshot = {
      tier: table.tier || tableTier,
      capacity: table.capacity,
      bottlesIncluded: table.bottles_included || bottlesIncluded,
      guestCount: guestCount || table.capacity,
      celebration: celebration || null,
      celebrantName: celebrantName || null,
      bottlePreferences: bottlePreferences || null,
      estimatedArrival: estimatedArrival || null,
      priceAtBooking: vipTablePriceCents / 100,
      // GA ticket info (purchaser's ticket) - prices from DB
      ticketTierId: ticketTierId,
      ticketTierName: ticketType.name || ticketTierName || "General Admission",
      ticketPrice: serverTicketPriceCents / 100,
      totalAmount: totalAmountCents / 100,
    };

    // Create unified VIP checkout (GA ticket + VIP reservation) atomically via RPC
    // This creates both the GA ticket and VIP reservation in a single transaction
    const { data: checkoutResult, error: checkoutError } = await supabase
      .rpc("create_unified_vip_checkout", {
        p_event_id: eventId,
        p_table_id: tableId,
        p_table_number: parseInt(tableNumber),
        p_tier_id: ticketTierId,
        p_tier_name: ticketType.name || ticketTierName || "General Admission",
        p_tier_price_cents: serverTicketPriceCents,
        p_vip_price_cents: vipTablePriceCents,
        p_total_amount_cents: totalAmountCents,
        p_purchaser_name: customerName,
        p_purchaser_email: customerEmail,
        p_purchaser_phone: customerPhone || null,
        p_stripe_payment_intent_id: "", // Will be updated after payment intent creation
        p_package_snapshot: packageSnapshot,
        p_special_requests: specialRequests || null,
      })
      .single();

    if (checkoutError || !checkoutResult) {
      console.error("Unified checkout creation error:", checkoutError);
      return new Response(
        JSON.stringify({ error: `Failed to create unified checkout: ${checkoutError?.message || "Unknown error"}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    const { ticket_id, reservation_id, unified_qr_token, ticket_token } = checkoutResult;
    console.log("Unified checkout created:", { ticket_id, reservation_id, unified_qr_token });

    // Create Stripe Payment Intent for combined amount (VIP table + GA ticket)
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmountCents,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          type: "vip_unified",
          reservationId: reservation_id,
          ticketId: ticket_id,
          eventId,
          tableId,
          tableNumber,
          tableTier: table.tier || tableTier || "standard",
          ticketTierId,
          ticketTierName: ticketType.name || ticketTierName || "General Admission",
          customerEmail,
          customerName,
          vipPriceCents: String(vipTablePriceCents),
          ticketPriceCents: String(serverTicketPriceCents),
          totalAmountCents: String(totalAmountCents),
        },
        receipt_email: customerEmail,
        description: `VIP Table ${table.table_number || tableNumber} (${(table.tier || tableTier || "standard").replace('_', ' ')}) + GA Ticket for ${event.name}`,
      });
    } catch (stripeError) {
      console.error("Stripe payment intent creation failed:", stripeError);
      // Transactional rollback: cancel reservation, ticket, and restore table atomically
      const { error: rollbackError } = await supabase.rpc("rollback_vip_checkout", {
        p_reservation_id: reservation_id,
        p_ticket_id: ticket_id,
        p_table_id: tableId,
      });
      if (rollbackError) {
        console.error("VIP rollback failed:", rollbackError);
      }

      return new Response(
        JSON.stringify({ error: "Failed to create payment intent. Please try again." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    // Update reservation and ticket with payment intent ID
    await Promise.all([
      supabase
        .from("vip_reservations")
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq("id", reservation_id),
      supabase
        .from("tickets")
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq("id", ticket_id),
    ]);

    console.log("Payment Intent created:", paymentIntent.id);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        reservationId: reservation_id,
        ticketId: ticket_id,
        unifiedQrToken: unified_qr_token,
        amount: totalAmountCents / 100,
        vipAmount: vipTablePriceCents / 100,
        ticketAmount: serverTicketPriceCents / 100,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("VIP Payment Intent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
