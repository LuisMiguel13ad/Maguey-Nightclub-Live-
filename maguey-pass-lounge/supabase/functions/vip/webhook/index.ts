/**
 * Edge Function: VIP Table Webhook Handler
 * Handles Stripe webhooks specifically for VIP table reservations
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const reservationId = paymentIntent.metadata?.reservationId;

      if (reservationId && paymentIntent.metadata?.type === 'vip_table') {
        // Update reservation status
        const { data: reservation, error: updateError } = await supabase
          .from('table_reservations')
          .update({
            payment_status: 'paid',
            status: 'confirmed',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: paymentIntent.id,
          })
          .eq('id', reservationId)
          .select(`
            *,
            vip_table:vip_tables(*),
            event:events(id, name, event_date, event_time, venue_name, image_url),
            guest_passes:table_guest_passes(*)
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

        // Send confirmation email
        if (reservation && Deno.env.get('RESEND_API_KEY')) {
          try {
            const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
            const fromAddress = Deno.env.get('EMAIL_FROM_ADDRESS') || 'tickets@tickets.magueynightclub.com';

            await resend.emails.send({
              from: fromAddress,
              to: reservation.customer_email,
              subject: `VIP Table Confirmation - ${reservation.event?.name || 'Event'}`,
              html: `
                <h1>VIP Table Reservation Confirmed!</h1>
                <p>Dear ${reservation.customer_first_name},</p>
                <p>Your VIP table reservation has been confirmed.</p>
                <h2>Reservation Details</h2>
                <p><strong>Reservation Number:</strong> ${reservation.reservation_number}</p>
                <p><strong>Table:</strong> ${reservation.vip_table?.table_name || 'N/A'}</p>
                <p><strong>Event:</strong> ${reservation.event?.name || 'N/A'}</p>
                <p><strong>Date:</strong> ${reservation.event?.event_date || 'N/A'}</p>
                <p><strong>Guests:</strong> ${reservation.guest_count}</p>
                <p><strong>Total:</strong> $${reservation.total_amount.toLocaleString()}</p>
                <p>Thank you for your reservation!</p>
              `,
            });
          } catch (emailError) {
            console.error('Error sending confirmation email:', emailError);
            // Don't fail the webhook if email fails
          }
        }

        return new Response(
          JSON.stringify({ 
            received: true,
            reservationId,
            status: 'confirmed'
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
          .from('table_reservations')
          .update({
            payment_status: 'failed',
          })
          .eq('id', reservationId);

        return new Response(
          JSON.stringify({ received: true }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('VIP webhook error:', error);
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






