// Supabase authentication helpers for k6 load tests

export function getHeaders() {
  const anonKey = __ENV.SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.warn('SUPABASE_ANON_KEY not set');
  }
  return {
    'Content-Type': 'application/json',
    'apikey': anonKey || '',
    'Authorization': `Bearer ${anonKey || ''}`,
  };
}

export function getServiceHeaders() {
  const serviceKey = __ENV.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set');
  }
  return {
    'Content-Type': 'application/json',
    'apikey': serviceKey || '',
    'Authorization': `Bearer ${serviceKey || ''}`,
  };
}

export function getBaseUrl() {
  return __ENV.SUPABASE_URL || 'http://localhost:54321';
}
