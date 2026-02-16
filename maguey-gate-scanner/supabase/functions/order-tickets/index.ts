import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  
  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (limit.count >= 100) { // 100 requests per minute
    return false;
  }
  
  limit.count++;
  return true;
}

// Request logging
function logRequest(orderId: string, ip: string, userAgent: string, success: boolean, error?: string): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    function: 'order-tickets',
    orderId,
    ip,
    userAgent,
    success,
    error: error || null,
  };
  console.log(JSON.stringify(logEntry));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Rate limiting
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': '60'
        } 
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get order_id from URL path or query params
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const orderId = pathParts[pathParts.length - 1] || url.searchParams.get('order_id');

    if (!orderId) {
      const userAgent = req.headers.get('user-agent') || 'unknown';
      logRequest('', clientIp, userAgent, false, 'Missing order_id');
      return new Response(
        JSON.stringify({ error: 'order_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log request
    const userAgent = req.headers.get('user-agent') || 'unknown';
    logRequest(orderId, clientIp, userAgent, true);

    // Get tickets for the order
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError);
      logRequest(orderId, clientIp, userAgent, false, ticketsError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tickets', message: ticketsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order details if available
    let orderDetails = null;
    if (tickets && tickets.length > 0) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (!orderError && order) {
        orderDetails = order;
      }
    }

    const response = {
      order_id: orderId,
      order: orderDetails,
      tickets: tickets || [],
      ticket_count: tickets?.length || 0,
      scanned_count: tickets?.filter(t => t.scanned_at).length || 0,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in order-tickets:', error);
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const url = new URL(req.url);
    const orderId = url.pathname.split('/').pop() || '';
    logRequest(orderId, clientIp, userAgent, false, error.message);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


