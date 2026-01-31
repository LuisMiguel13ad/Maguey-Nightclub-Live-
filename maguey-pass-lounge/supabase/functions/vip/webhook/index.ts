/**
 * DEPRECATED: VIP Table Webhook Handler
 *
 * This webhook has been consolidated into the main stripe-webhook function.
 * The main webhook now handles:
 * - VIP reservation creation (vip_reservations)
 * - Guest pass generation (vip_guest_passes)
 * - Table availability updates (event_vip_tables)
 *
 * This endpoint is kept for backward compatibility but should be migrated
 * to use the main stripe-webhook endpoint.
 *
 * @deprecated Use /functions/v1/stripe-webhook instead
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initSentry, captureError, setRequestContext } from "../../_shared/sentry.ts";

// Initialize Sentry at module level (before serve)
initSentry();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Set Sentry request context for error correlation
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  setRequestContext(req, requestId);

  console.warn('DEPRECATED: vip/webhook is deprecated. Please migrate to stripe-webhook.');

  try {
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe secret key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify webhook signature
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'STRIPE_WEBHOOK_SECRET not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: `Webhook Error: ${err instanceof Error ? err.message : 'Invalid signature'}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle payment_intent.succeeded for VIP tables
    // NOTE: This now uses the consolidated vip_reservations table
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const reservationId = paymentIntent.metadata?.reservationId;

      if (reservationId && paymentIntent.metadata?.type === 'vip_table') {
        // Update reservation status in vip_reservations (new schema)
        const { data: reservation, error: updateError } = await supabase
          .from('vip_reservations')
          .update({
            status: 'confirmed',
            stripe_payment_intent_id: paymentIntent.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reservationId)
          .select(`
            *,
            event_vip_table:event_vip_tables(*),
            event:events(id, name, event_date, event_time, venue_name, image_url),
            guest_passes:vip_guest_passes(*)
          `)
          .single();

        if (updateError) {
          console.error('Error updating reservation:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update reservation' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        // Mark table as unavailable
        if (reservation?.event_vip_table_id) {
          await supabase
            .from('event_vip_tables')
            .update({ is_available: false })
            .eq('id', reservation.event_vip_table_id);
        }

        // Note: Email sending should be handled by a dedicated email function
        // The main stripe-webhook handles this during checkout.session.completed

        return new Response(
          JSON.stringify({
            received: true,
            reservationId,
            status: 'confirmed',
            deprecated: true,
            message: 'This endpoint is deprecated. Please migrate to stripe-webhook.'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Handle payment_intent.payment_failed
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const reservationId = paymentIntent.metadata?.reservationId;

      if (reservationId && paymentIntent.metadata?.type === 'vip_table') {
        await supabase
          .from('vip_reservations')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', reservationId);

        return new Response(
          JSON.stringify({ received: true, deprecated: true }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ received: true, deprecated: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('VIP webhook error:', error);

    // Report error to Sentry with context
    await captureError(error instanceof Error ? error : new Error(String(error)), {
      webhook_type: "vip",
      requestId,
      deprecated: true,
    });

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Webhook processing failed'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
