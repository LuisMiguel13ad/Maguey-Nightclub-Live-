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

    const { paymentIntentId, reservationId } = await req.json();

    console.log("Confirming VIP payment:", { paymentIntentId, reservationId });

    // Validate required fields
    if (!paymentIntentId || !reservationId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    // Verify payment intent status with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return new Response(
        JSON.stringify({ 
          error: "Payment not completed", 
          status: paymentIntent.status 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    // Update reservation to confirmed
    const { data: reservation, error: reservationError } = await supabase
      .from("vip_reservations")
      .update({
        status: "confirmed",
        stripe_payment_intent_id: paymentIntentId,
        stripe_charge_id: paymentIntent.latest_charge as string || null,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .select(`
        *,
        events (
          id,
          name,
          event_date,
          venue_name,
          flyer_url
        ),
        event_vip_tables (
          id,
          table_number,
          tier,
          capacity,
          bottles_included
        )
      `)
      .single();

    if (reservationError || !reservation) {
      console.error("Reservation update error:", reservationError);
      return new Response(
        JSON.stringify({ error: `Failed to confirm reservation: ${reservationError?.message || "Unknown error"}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    console.log("Reservation confirmed:", reservation.id);

    // Generate reservation number from ID
    const reservationNumber = `VIP-${reservation.id.substring(0, 8).toUpperCase()}`;

    // Extract package details
    const packageSnapshot = reservation.package_snapshot || {};

    return new Response(
      JSON.stringify({
        success: true,
        reservation: {
          id: reservation.id,
          reservationNumber,
          customerName: reservation.purchaser_name,
          email: reservation.purchaser_email,
          phone: reservation.purchaser_phone,
          guestCount: packageSnapshot.guestCount || reservation.event_vip_tables?.capacity || 6,
          amount: reservation.amount_paid_cents / 100,
          celebration: packageSnapshot.celebration,
          estimatedArrival: packageSnapshot.estimatedArrival,
          status: "confirmed",
          event: reservation.events,
          table: {
            ...reservation.event_vip_tables,
            tier: packageSnapshot.tier || reservation.event_vip_tables?.tier || "standard",
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Confirm payment error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
