import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    } = body;

    console.log("Creating VIP payment intent for:", { eventId, tableId, customerEmail, tablePrice });

    // Validate required fields
    if (!eventId || !tableId || !customerEmail || !customerName || !tablePrice) {
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

    // Generate QR code token
    const qrCodeToken = crypto.randomUUID();
    
    // Build package snapshot with booking details
    const packageSnapshot = {
      tier: tableTier,
      capacity: tableCapacity || table.capacity,
      bottlesIncluded: bottlesIncluded || table.bottles_included,
      guestCount: guestCount || table.capacity,
      celebration: celebration || null,
      celebrantName: celebrantName || null,
      bottlePreferences: bottlePreferences || null,
      estimatedArrival: estimatedArrival || null,
      priceAtBooking: parseFloat(tablePrice),
    };

    // Create VIP reservation with pending status
    // Using correct column names from the database schema
    const { data: reservation, error: reservationError } = await supabase
      .from("vip_reservations")
      .insert({
        event_id: eventId,
        event_vip_table_id: tableId,
        table_number: parseInt(tableNumber),
        purchaser_name: customerName,
        purchaser_email: customerEmail,
        purchaser_phone: customerPhone || null,
        amount_paid_cents: Math.round(parseFloat(tablePrice) * 100),
        status: "pending",
        qr_code_token: qrCodeToken,
        package_snapshot: packageSnapshot,
        special_requests: specialRequests || null,
        disclaimer_accepted_at: new Date().toISOString(),
        refund_policy_accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (reservationError || !reservation) {
      console.error("Reservation creation error:", reservationError);
      return new Response(
        JSON.stringify({ error: `Failed to create reservation: ${reservationError?.message || "Unknown error"}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    console.log("Reservation created:", reservation.id);

    // Temporarily mark table as unavailable
    await supabase
      .from("event_vip_tables")
      .update({ is_available: false })
      .eq("id", tableId);

    // Create Stripe Payment Intent
    const amountInCents = Math.round(parseFloat(tablePrice) * 100);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        reservationId: reservation.id,
        eventId,
        tableId,
        tableNumber,
        tableTier: tableTier || "standard",
        customerEmail,
        customerName,
        type: "vip_table_reservation",
      },
      receipt_email: customerEmail,
      description: `VIP Table ${tableNumber} - ${(tableTier || "standard").replace('_', ' ')} for ${event.name}`,
    });

    // Update reservation with payment intent ID
    await supabase
      .from("vip_reservations")
      .update({
        stripe_payment_intent_id: paymentIntent.id,
      })
      .eq("id", reservation.id);

    console.log("Payment Intent created:", paymentIntent.id);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        reservationId: reservation.id,
        amount: parseFloat(tablePrice),
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
