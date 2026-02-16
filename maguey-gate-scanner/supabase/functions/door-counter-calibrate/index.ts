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

    // Get API key from request header or body
    const authHeader = req.headers.get('Authorization');
    const apiKey = authHeader?.replace('Bearer ', '') || 
                   (await req.json()).api_key;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify API key and get counter
    const { data: counter, error: counterError } = await supabase
      .from('door_counters')
      .select('id, device_id')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (counterError || !counter) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key or counter inactive' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert calibration count (0, 0) to reset
    const { error: insertError } = await supabase
      .from('physical_counts')
      .insert({
        counter_id: counter.id,
        entry_count: 0,
        exit_count: 0,
        count_time: new Date().toISOString(),
      });

    if (insertError) {
      throw insertError;
    }

    // Update heartbeat
    await supabase
      .from('door_counters')
      .update({
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', counter.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Counter calibrated successfully',
        device_id: counter.device_id,
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

