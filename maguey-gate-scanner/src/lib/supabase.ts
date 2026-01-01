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

// Updated to match actual database schema (verified columns only)
export interface Ticket {
  id: string;
  ticket_id: string;
  order_id: string | null;
  event_name: string;
  ticket_type: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  qr_code_data: string | null;
  is_used: boolean;
  scanned_at: string | null;
  created_at: string;
  purchase_date: string | null;
  price_paid: number | null;
  metadata: Record<string, unknown> | null;
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

// Safe localStorage wrapper for mobile compatibility
const safeStorage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage not available
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage not available
    }
  },
};

// Create client with fallback values to prevent crashes
// The app will handle missing credentials gracefully via isSupabaseConfigured()
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder',
  {
    auth: {
      storage: safeStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

