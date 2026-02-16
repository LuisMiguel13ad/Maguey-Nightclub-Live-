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

    // Get device_id from query params or body
    const url = new URL(req.url);
    const deviceId = url.searchParams.get('device_id') || 
                     (await req.json().catch(() => ({}))).device_id;

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: 'device_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get counter info
    const { data: counter, error: counterError } = await supabase
      .from('door_counters')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (counterError || !counter) {
      return new Response(
        JSON.stringify({ error: 'Counter not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get health status
    const { data: health, error: healthError } = await supabase
      .rpc('get_counter_health_status', {
        counter_id_param: counter.id,
      })
      .single();

    // Get latest count
    const { data: latestCount } = await supabase
      .from('physical_counts')
      .select('entry_count, exit_count, net_count, count_time')
      .eq('counter_id', counter.id)
      .order('count_time', { ascending: false })
      .limit(1)
      .single();

    return new Response(
      JSON.stringify({
        device_id: counter.device_id,
        device_name: counter.device_name,
        device_type: counter.device_type,
        location: counter.location,
        is_active: counter.is_active,
        last_heartbeat: counter.last_heartbeat,
        health: health || null,
        latest_count: latestCount || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

