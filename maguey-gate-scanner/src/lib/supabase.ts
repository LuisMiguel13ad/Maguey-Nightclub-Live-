import { createClient } from '@supabase/supabase-js';

// Support both Vite (import.meta.env) and Node.js (process.env) environments
const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
// Standardized: Use VITE_SUPABASE_ANON_KEY (same as other apps)
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

// Only create client if credentials exist, otherwise use placeholder
const hasCredentials = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'https://placeholder.supabase.co' && 
  supabaseAnonKey !== 'placeholder-key';

export interface Ticket {
  id: string;
  order_id: string;
  event_id: string;
  ticket_type_id: string;
  attendee_name: string | null;
  qr_token: string | null;
  qr_signature: string | null;
  nfc_tag_id: string | null;
  nfc_signature: string | null;
  status: string;
  scanned_at: string | null;
  issued_at: string | null;
}

export interface Event {
  id: string;
  name: string;
  event_date: string;
  event_time: string;
  venue_name: string | null;
  city: string | null;
}

export interface TicketType {
  id: string;
  name: string;
  price: number;
}

// Create client with fallback values to prevent crashes
// The app will handle missing credentials gracefully via isSupabaseConfigured()
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder',
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

