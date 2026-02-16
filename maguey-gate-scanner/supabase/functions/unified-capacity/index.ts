import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get event_id from query params or body
    const url = new URL(req.url);
    const eventId = url.searchParams.get('event_id') || 
                    (await req.json().catch(() => ({}))).event_id;

    if (!eventId) {
      return new Response(
        JSON.stringify({ error: 'event_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unified capacity
    const { data: capacity, error: capacityError } = await supabase
      .rpc('get_unified_capacity', {
        event_id_param: eventId,
        check_time_param: new Date().toISOString(),
      })
      .single();

    if (capacityError) {
      if (capacityError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ error: 'Event not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw capacityError;
    }

    return new Response(
      JSON.stringify(capacity),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

