/**
 * Browser Console Test for Prompt 1
 * 
 * Copy everything below and paste into browser console
 * while on your maguey-pass-lounge site
 */

(async function testPrompt1() {
  console.log('🧪 Testing Prompt 1: Race Condition Fix');
  console.log('='.repeat(40));

  // Access supabase from window (should be available if site is running)
  const supabase = (window as any).supabase || (await import('/src/lib/supabase.ts')).supabase;
  
  // Test 1: Check tickets_sold column
  console.log('\n1️⃣ Testing tickets_sold column...');
  const { data: ticketTypes, error: e1 } = await supabase
    .from('ticket_types')
    .select('id, name, tickets_sold, total_inventory')
    .limit(5);
  
  if (e1) {
    console.log('❌ Error:', e1.message);
  } else {
    console.log('✅ tickets_sold column exists');
    console.table(ticketTypes);
  }

  // Test 2: Check RPC function
  console.log('\n2️⃣ Testing RPC function...');
  const { error: e2 } = await supabase.rpc('check_and_reserve_tickets', {
    p_ticket_type_id: '00000000-0000-0000-0000-000000000000',
    p_quantity: 1
  });
  
  if (e2?.message?.includes('does not exist')) {
    console.log('❌ RPC function missing');
  } else {
    console.log('✅ RPC function exists');
  }

  // Test 3: Test overselling protection
  if (ticketTypes && ticketTypes.length > 0) {
    const tt = ticketTypes[0];
    console.log(`\n3️⃣ Testing overselling protection on "${tt.name}"...`);
    
    const { data, error: e3 } = await supabase.rpc('check_and_reserve_tickets', {
      p_ticket_type_id: tt.id,
      p_quantity: 99999 // Way more than available
    });
    
    if (!data || e3) {
      console.log('✅ Overselling blocked correctly');
    } else {
      console.log('❌ Overselling was NOT blocked!');
    }
  }

  console.log('\n' + '='.repeat(40));
  console.log('🏁 Test complete!');
})();
