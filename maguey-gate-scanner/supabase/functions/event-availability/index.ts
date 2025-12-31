import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting (simple in-memory, consider Redis for production)
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

// Cache for event availability (30 second TTL)
const cache = new Map<string, { data: any; expiresAt: number }>();

function getCached(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }
  if (cached) {
    cache.delete(key);
  }
  return null;
}

function setCache(key: string, data: any, ttl: number = 30000): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttl,
  });
  
  // Clean up old cache entries if cache gets too large
  if (cache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now > v.expiresAt) {
        cache.delete(k);
      }
    }
  }
}

// Request logging
function logRequest(eventName: string, ip: string, userAgent: string, cached: boolean): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    function: 'event-availability',
    eventName,
    ip,
    userAgent,
    cached,
  };
  console.log(JSON.stringify(logEntry));
}

/**
 * Generate ticket type code from name
 * Format: "VIP" -> "VIP-001", "General Admission" -> "GENERAL-001"
 */
function generateTicketTypeCode(name: string, index: number = 0): string {
  // Convert name to uppercase and replace spaces/special chars with hyphens
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // Extract first word or first few characters for code
  const parts = normalized.split('-');
  const codePrefix = parts.length > 1 
    ? parts.slice(0, 2).join('-')  // Use first two words
    : normalized.substring(0, 8);   // Or first 8 chars
  
  // Add numeric suffix
  const suffix = String(index + 1).padStart(3, '0');
  return `${codePrefix}-${suffix}`;
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

    // Get event name from URL path
    // Path format: /functions/v1/event-availability/{eventName}
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const eventNameIndex = pathParts.indexOf('event-availability');
    const eventName = eventNameIndex >= 0 && pathParts[eventNameIndex + 1]
      ? decodeURIComponent(pathParts[eventNameIndex + 1])
      : url.searchParams.get('event_name');

    if (!eventName) {
      return new Response(
        JSON.stringify({ eventName: '', ticketTypes: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache first
    const cacheKey = `availability:${eventName}`;
    const cached = getCached(cacheKey);
    if (cached) {
      const userAgent = req.headers.get('user-agent') || 'unknown';
      logRequest(eventName, clientIp, userAgent, true);
      return new Response(
        JSON.stringify(cached),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Cache': 'HIT'
          } 
        }
      );
    }

    // Log request
    const userAgent = req.headers.get('user-agent') || 'unknown';
    logRequest(eventName, clientIp, userAgent, false);

    // Get event details (without ticket_types column which may not exist)
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name')
      .eq('name', eventName)
      .single();

    // If event not found, return empty result (graceful degradation)
    if (eventError || !event) {
      return new Response(
        JSON.stringify({ eventName, ticketTypes: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ticket types from ticket_types table
    let ticketTypesConfig: Array<{ name: string; code?: string; capacity: number; price?: number }> = [];
    
    try {
      const { data: ticketTypesData, error: ticketTypesError } = await supabase
        .from('ticket_types')
        .select('code, name, total_inventory, price')
        .eq('event_id', event.id);
      
      if (!ticketTypesError && ticketTypesData && ticketTypesData.length > 0) {
        ticketTypesConfig = ticketTypesData.map(tt => ({
          name: tt.name || '',
          code: tt.code || undefined,
          capacity: tt.total_inventory || 0,
          price: tt.price || 0,
        }));
      }
    } catch (err) {
      console.error('Error fetching ticket types:', err);
      // Return empty array if table doesn't exist
      ticketTypesConfig = [];
    }

    // If no ticket types found, return empty result
    if (!ticketTypesConfig || ticketTypesConfig.length === 0) {
      return new Response(
        JSON.stringify({ eventName: event.name, ticketTypes: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL FIX: Query tickets by event_id (UUID) not event_name (text)
    // Also only count ACTIVE ticket statuses (issued, used, scanned)
    // This ensures accurate availability counts
    const availability = await Promise.all(
      ticketTypesConfig.map(async (ticketType, index) => {
        // Get ticket type ID for this ticket type
        const { data: ticketTypeRecord } = await supabase
          .from('ticket_types')
          .select('id')
          .eq('event_id', event.id)
          .eq('name', ticketType.name)
          .single();

        let sold = 0;
        
        if (ticketTypeRecord) {
          // Count sold tickets by ticket_type_id (UUID foreign key)
          // Only count active statuses: issued, used, scanned
          // Exclude: cancelled, refunded, void
          const { count: soldCount, error: countError } = await supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', event.id)
            .eq('ticket_type_id', ticketTypeRecord.id)
            .in('status', ['issued', 'used', 'scanned']);

          if (countError) {
            console.error('Error counting tickets:', countError);
          } else {
            sold = soldCount || 0;
          }
        }
        
        // Get total capacity
        const total = ticketType.capacity || 0;
        
        // Calculate available
        const available = Math.max(0, total - sold);
        
        // Generate or use ticket type code
        let ticketTypeCode: string;
        if (ticketType.code) {
          ticketTypeCode = ticketType.code;
        } else {
          // Generate code from name
          ticketTypeCode = generateTicketTypeCode(ticketType.name, index);
        }

        return {
          ticketTypeCode,
          available,
          total,
          sold,
        };
      })
    );

    // Return simplified format matching purchase website expectations
    const response = {
      eventName: event.name,
      ticketTypes: availability,
    };

    // Cache the response for 30 seconds
    setCache(cacheKey, response, 30000);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Cache': 'MISS'
        } 
      }
    );
  } catch (error) {
    console.error('Error in event-availability:', error);
    // Return graceful error response
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const eventNameIndex = pathParts.indexOf('event-availability');
    const eventName = eventNameIndex >= 0 && pathParts[eventNameIndex + 1]
      ? decodeURIComponent(pathParts[eventNameIndex + 1])
      : '';
    
    return new Response(
      JSON.stringify({ eventName: eventName || '', ticketTypes: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


