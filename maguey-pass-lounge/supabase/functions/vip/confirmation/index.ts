/**
 * Edge Function: VIP Table Confirmation
 * Handles VIP table reservation confirmation after payment
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight } from "../../_shared/cors.ts";

interface ConfirmationRequest {
  reservationId: string;
  paymentIntentId: string;
}

serve(async (req) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  try {
    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { 
          status: 500, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: ConfirmationRequest = await req.json();
    const { reservationId, paymentIntentId } = body;

    if (!reservationId || !paymentIntentId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: reservationId or paymentIntentId' }),
        { 
          status: 400, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get reservation with all related data
    const { data: reservation, error: reservationError } = await supabase
      .from('table_reservations')
      .select(`
        *,
        vip_table:vip_tables(*),
        event:events(id, name, event_date, event_time, venue_name, image_url),
        guest_passes:table_guest_passes(*)
      `)
      .eq('id', reservationId)
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single();

    if (reservationError || !reservation) {
      return new Response(
        JSON.stringify({ error: 'Reservation not found or payment intent mismatch' }),
        { 
          status: 404, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update reservation status to confirmed
    const { data: updatedReservation, error: updateError } = await supabase
      .from('table_reservations')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        paid_at: new Date().toISOString(),
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
      return new Response(
        JSON.stringify({ error: 'Failed to confirm reservation' }),
        { 
          status: 500, 
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        reservation: updatedReservation,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error confirming reservation:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to confirm reservation' 
      }),
      { 
        status: 500, 
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } 
      }
    );
  }
});










