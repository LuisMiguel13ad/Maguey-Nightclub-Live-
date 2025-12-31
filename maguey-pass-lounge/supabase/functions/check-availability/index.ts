/**
 * Edge Function: Check Ticket Availability Before Purchase
 * Verifies that requested ticket quantities are available before checkout proceeds
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckAvailabilityRequest {
  eventId: string;
  ticketRequests: Array<{
    ticketTypeId: string;
    quantity: number;
  }>;
}

interface AvailabilityResponse {
  available: boolean;
  errors?: string[];
  details?: Array<{
    ticketTypeId: string;
    requested: number;
    available: number;
    total: number;
    sold: number;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
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
    const body: CheckAvailabilityRequest = await req.json();
    const { eventId, ticketRequests } = body;

    if (!eventId || !ticketRequests || ticketRequests.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing eventId or ticketRequests' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify event exists and is published
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name, status, event_date')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check event status
    const today = new Date().toISOString().split('T')[0];
    if (event.status !== 'published') {
      return new Response(
        JSON.stringify({ 
          available: false, 
          errors: ['Event is not published'] 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (event.event_date < today) {
      return new Response(
        JSON.stringify({ 
          available: false, 
          errors: ['Event is in the past'] 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Release any expired reservations before computing availability
    try {
      const { error: expireError } = await supabase.rpc('expire_stale_reservations');
      if (expireError) {
        console.warn('Failed to expire stale reservations', expireError);
      }
    } catch (err) {
      console.warn('Failed to expire stale reservations', err);
    }

    // Check availability for each ticket type
    const errors: string[] = [];
    const details: AvailabilityResponse['details'] = [];

    for (const request of ticketRequests) {
      // Get ticket type info
      const { data: ticketType, error: ttError } = await supabase
        .from('ticket_types')
        .select('id, name, total_inventory')
        .eq('id', request.ticketTypeId)
        .single();

      if (ttError || !ticketType) {
        errors.push(`Ticket type ${request.ticketTypeId} not found`);
        continue;
      }

      const totalInventory = ticketType.total_inventory ?? 0;

      // Count currently sold tickets (excluding cancelled/refunded)
      const { count: soldCount, error: countError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('ticket_type_id', request.ticketTypeId)
        .in('status', ['issued', 'used', 'scanned']);

      if (countError) {
        errors.push(`Failed to check availability for ${ticketType.name}: ${countError.message}`);
        continue;
      }

      const sold = soldCount || 0;

      // Include active reservations in availability calculation
      // Gracefully handle if the function doesn't exist yet
      let activeReserved = 0;
      try {
        const { data: reservedSum, error: reservationError } = await supabase.rpc('sum_active_reservations', {
          p_ticket_type_id: request.ticketTypeId,
        });

        if (reservationError) {
          // If function doesn't exist, log warning but continue without reservations
          if (reservationError.message?.includes('function') && reservationError.message?.includes('not found')) {
            console.warn(`Reservation function not available for ${ticketType.name}, continuing without reservation check`);
            activeReserved = 0;
          } else {
            // Other errors: log but don't block
            console.warn(`Failed to check reservations for ${ticketType.name}:`, reservationError.message);
            activeReserved = 0;
          }
        } else {
          activeReserved = reservedSum ?? 0;
        }
      } catch (err) {
        // Catch any exceptions and continue without reservations
        console.warn(`Exception checking reservations for ${ticketType.name}:`, err);
        activeReserved = 0;
      }
      const available = Math.max(totalInventory - sold - activeReserved, 0);

      details.push({
        ticketTypeId: request.ticketTypeId,
        requested: request.quantity,
        available,
        total: totalInventory,
        sold,
      });

      // Check if requested quantity exceeds available
      if (request.quantity > available) {
        errors.push(
          `Not enough tickets available for ${ticketType.name}. Requested: ${request.quantity}, Available: ${available}`
        );
      }
    }

    const response: AvailabilityResponse = {
      available: errors.length === 0,
      ...(errors.length > 0 && { errors }),
      details,
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error checking availability:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

