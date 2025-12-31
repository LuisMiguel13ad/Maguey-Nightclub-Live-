import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
                    process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugEventVisibility() {
  console.log('🔍 Debugging Event Visibility...\n');
  console.log('='.repeat(70));

  const today = new Date().toISOString().split('T')[0];
  console.log(`Today's date: ${today}\n`);

  // Test the exact query Main Website uses
  console.log('📋 Testing Main Website Query:\n');
  console.log('Query: .eq("status", "published").eq("is_active", true).gte("event_date", today)');
  
  const { data: mainSiteEvents, error: mainError } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .eq('is_active', true)
    .gte('event_date', today)
    .order('event_date', { ascending: true });

  if (mainError) {
    console.log('❌ Error:', mainError.message);
  } else {
    console.log(`✅ Found ${mainSiteEvents?.length || 0} events`);
    if (mainSiteEvents && mainSiteEvents.length > 0) {
      mainSiteEvents.forEach((e: any) => {
        console.log(`   - ${e.name} (${e.event_date})`);
      });
    } else {
      console.log('   No events found matching criteria');
    }
  }

  console.log('\n' + '='.repeat(70));
  
  // Test the exact query Purchase Website uses
  console.log('📋 Testing Purchase Website Query:\n');
  console.log('Query: .eq("status", "published").eq("is_active", true).gte("event_date", today)');
  
  const { data: purchaseSiteEvents, error: purchaseError } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .eq('is_active', true)
    .gte('event_date', today)
    .order('event_date', { ascending: true });

  if (purchaseError) {
    console.log('❌ Error:', purchaseError.message);
  } else {
    console.log(`✅ Found ${purchaseSiteEvents?.length || 0} events`);
    
    // Check ticket types for each event (Purchase Website requirement)
    if (purchaseSiteEvents && purchaseSiteEvents.length > 0) {
      for (const event of purchaseSiteEvents) {
        const { data: ticketTypes } = await supabase
          .from('ticket_types')
          .select('id')
          .eq('event_id', event.id)
          .limit(1);
        
        const hasTicketTypes = ticketTypes && ticketTypes.length > 0;
        console.log(`   - ${event.name} (${event.event_date})`);
        console.log(`     Ticket Types: ${hasTicketTypes ? '✅ Yes' : '❌ No'}`);
        
        if (!hasTicketTypes) {
          console.log(`     ⚠️  This event will NOT show on Purchase Website (no ticket types)`);
        }
      }
    } else {
      console.log('   No events found matching criteria');
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('🔍 Checking PRE THANKSGIVING BASH Specifically:\n');

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('name', 'PRE THANKSGIVING BASH')
    .single();

  if (eventError || !event) {
    console.log('❌ Event not found!');
    return;
  }

  console.log('Event Details:');
  console.log(`  Name: ${event.name}`);
  console.log(`  Status: ${event.status}`);
  console.log(`  is_active: ${event.is_active}`);
  console.log(`  event_date: ${event.event_date}`);
  console.log(`  Date Type: ${typeof event.event_date}`);
  console.log(`  Today: ${today}`);
  console.log(`  Date >= Today: ${event.event_date >= today}`);
  console.log('');

  // Check ticket types
  const { data: ticketTypes } = await supabase
    .from('ticket_types')
    .select('*')
    .eq('event_id', event.id);

  console.log(`Ticket Types: ${ticketTypes?.length || 0}`);
  if (ticketTypes && ticketTypes.length > 0) {
    ticketTypes.forEach((tt: any) => {
      console.log(`  - ${tt.name} ($${tt.price}, ${tt.total_inventory} capacity)`);
    });
  } else {
    console.log('  ❌ No ticket types found!');
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Visibility Checklist:\n');
  
  const checks = [
    { name: 'Status = published', pass: event.status === 'published', value: event.status },
    { name: 'is_active = true', pass: event.is_active === true, value: event.is_active },
    { name: 'event_date >= today', pass: event.event_date >= today, value: `${event.event_date} >= ${today}` },
    { name: 'Has ticket types', pass: (ticketTypes?.length || 0) > 0, value: `${ticketTypes?.length || 0} types` },
  ];

  checks.forEach(check => {
    const icon = check.pass ? '✅' : '❌';
    console.log(`${icon} ${check.name}: ${check.value}`);
  });

  const allPass = checks.every(c => c.pass);
  
  console.log('\n' + '='.repeat(70));
  if (allPass) {
    console.log('✅ All checks passed! Event should be visible.\n');
    console.log('💡 Troubleshooting Steps:');
    console.log('   1. Hard refresh browser pages (Cmd+Shift+R or Ctrl+Shift+R)');
    console.log('   2. Check browser console for errors');
    console.log('   3. Verify Supabase URL/key are correct on each site');
    console.log('   4. Check if sites are running and connected');
    console.log('   5. Wait a few seconds for real-time sync');
  } else {
    console.log('❌ Some checks failed. Fixing issues...\n');
    
    const updates: any = {};
    if (event.status !== 'published') updates.status = 'published';
    if (!event.is_active) updates.is_active = true;
    
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('events')
        .update(updates)
        .eq('id', event.id);
      
      if (updateError) {
        console.log('❌ Failed to update:', updateError.message);
      } else {
        console.log('✅ Event updated! Refresh your pages.');
      }
    }
  }
}

debugEventVisibility().catch(console.error);

