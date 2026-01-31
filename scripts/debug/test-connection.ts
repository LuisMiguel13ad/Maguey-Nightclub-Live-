import { supabase } from '@/lib/supabase';

const TEST_ORDER_ID = '3e6bc909-1cb4-4d07-b183-0426943a703d';

export const testSupabaseConnection = async (): Promise<void> => {
  console.log('[test-connection] Starting ticket query…');

  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('order_id', TEST_ORDER_ID);

  if (error) {
    console.error('[test-connection] Supabase error:', error);
    return;
  }

  console.log('[test-connection] Tickets for order:', TEST_ORDER_ID);
  console.table(data);

  if (!data || data.length === 0) {
    console.warn('[test-connection] No tickets found for that order id.');
  } else {
    console.log(
      `[test-connection] Retrieved ${data.length} ticket(s); Supabase read access confirmed.`
    );
  }
};

// Optional: run immediately if executed directly (e.g., via ts-node).
if (import.meta.env?.MODE !== undefined) {
  testSupabaseConnection().catch((err) =>
    console.error('[test-connection] Unexpected failure:', err)
  );
}

