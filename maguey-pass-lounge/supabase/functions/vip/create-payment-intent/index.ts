/**
 * Edge Function: Create VIP Table Payment Intent
 * Creates a Stripe Payment Intent for VIP table reservations
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateVIPPaymentIntentRequest {
  reservationId: string;
  amount: number;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  metadata?: Record<string, unknown>;
}

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

    // Parse request body
    const body: CreateVIPPaymentIntentRequest = await req.json();
    const { reservationId, amount, customer, metadata } = body;

    if (!reservationId || !amount || !customer?.email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: reservationId, amount, or customer email' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify reservation exists
    const { data: reservation, error: reservationError } = await supabase
      .from('table_reservations')
      .select('id, reservation_number, total_amount, payment_status')
      .eq('id', reservationId)
      .single();

    if (reservationError || !reservation) {
      return new Response(
        JSON.stringify({ error: 'Reservation not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if already paid
    if (reservation.payment_status === 'paid') {
      return new Response(
        JSON.stringify({ error: 'Reservation already paid' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer_email: customer.email,
      metadata: {
        reservationId,
        reservationNumber: reservation.reservation_number,
        customerName: `${customer.firstName} ${customer.lastName}`,
        type: 'vip_table',
        ...metadata,
      },
      description: `VIP Table Reservation - ${reservation.reservation_number}`,
    });

    // Update reservation with payment intent ID
    await supabase
      .from('table_reservations')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
      })
      .eq('id', reservationId);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to create payment intent' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});






