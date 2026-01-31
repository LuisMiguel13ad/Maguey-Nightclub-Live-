// Test file to verify Supabase client configuration
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

console.log('=== SUPABASE CLIENT TEST ===');
console.log('Is configured:', isSupabaseConfigured());
console.log('Supabase client:', supabase);

// Test the exact query from Scanner.tsx
const testInput = '373a7615-4e54-40bd-9fc5-c4a9188d4e5b';
const queryString = `ticket_id.eq.${testInput},qr_token.eq.${testInput},id.eq.${testInput}`;

console.log('Testing query string:', queryString);

supabase
  .from('tickets')
  .select('*, events(*), ticket_types(*)')
  .or(queryString)
  .limit(1)
  .then(({ data, error }) => {
    console.log('Query result:');
    console.log('  Error:', error);
    console.log('  Data:', data);
    console.log('  Found:', data && data.length > 0 ? 'YES' : 'NO');
    if (data && data.length > 0) {
      console.log('  Ticket details:', data[0]);
    }
  });

export {};

