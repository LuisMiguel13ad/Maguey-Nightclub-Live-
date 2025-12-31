/**
 * Supabase Client Configuration
 * Shared database connection for ticket purchase and scanner systems
 */

import { createClient } from '@supabase/supabase-js';
import { TICKET_SCANNER_CONFIG } from '@/config/ticket-scanner';

const supabaseUrl = TICKET_SCANNER_CONFIG.SUPABASE_URL;
const supabaseAnonKey = TICKET_SCANNER_CONFIG.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL and Anon Key must be set in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Database Table Names (matching migration schema)
 */
export const TABLES = {
  EVENTS: 'events',
  ORDERS: 'orders',
  TICKETS: 'tickets',
  PAYMENTS: 'payments',
} as const;

