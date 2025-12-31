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

async function checkEventStatus() {
  console.log('🔍 Checking Event Status...\n');

  // Check for PRE THANKSGIVING BASH
  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('name', 'PRE THANKSGIVING BASH')
    .single();

  if (error || !event) {
    console.log('❌ Event not found in database');
    console.log('Error:', error);
    
    // Check all events
    const { data: allEvents } = await supabase
      .from('events')
      .select('id, name, status, event_date, is_active')
      .order('created_at', { ascending: false })
      .limit(10);
    
    console.log('\n📋 Recent Events in Database:');
    if (allEvents && allEvents.length > 0) {
      allEvents.forEach((e: any, i: number) => {
        console.log(`${i + 1}. ${e.name}`);
        console.log(`   Status: ${e.status || 'N/A'}`);
        console.log(`   is_active: ${e.is_active}`);
        console.log(`   Date: ${e.event_date}`);
        console.log('');
      });
    } else {
      console.log('   No events found in database');
    }
    return;
  }

  console.log('✅ Event Found!\n');
  console.log('Event Details:');
  console.log(`  ID: ${event.id}`);
  console.log(`  Name: ${event.name}`);
  console.log(`  Status: ${event.status || 'N/A'}`);
  console.log(`  is_active: ${event.is_active}`);
  console.log(`  Date: ${event.event_date}`);
  console.log(`  Time: ${event.event_time || 'N/A'}`);
  console.log(`  Published At: ${event.published_at || 'Not set'}`);
  console.log('');

  // Check ticket types
  const { data: ticketTypes } = await supabase
    .from('ticket_types')
    .select('*')
    .eq('event_id', event.id);

  console.log(`Ticket Types: ${ticketTypes?.length || 0}`);
  if (ticketTypes && ticketTypes.length > 0) {
    ticketTypes.forEach((tt: any, i: number) => {
      console.log(`  ${i + 1}. ${tt.name} - $${tt.price} (${tt.total_inventory} capacity)`);
    });
  }
  console.log('');

  // Check why it might not be showing
  console.log('🔍 Visibility Check:\n');
  
  const issues: string[] = [];
  
  if (!event.is_active) {
    issues.push('❌ is_active is false - event will not show on Main Website');
  }
  
  if (event.status !== 'published') {
    issues.push(`❌ Status is "${event.status}" not "published" - event will not show on Purchase Website`);
  }
  
  if (!event.published_at) {
    issues.push('⚠️  published_at is not set - may affect visibility');
  }
  
  if (new Date(event.event_date) < new Date()) {
    issues.push('⚠️  Event date is in the past - may be filtered out');
  }

  if (issues.length > 0) {
    console.log('Issues Found:');
    issues.forEach(issue => console.log(`  ${issue}`));
    console.log('');
    
    console.log('🔧 Fixing Issues...\n');
    
    const updates: any = {
      is_active: true,
      status: 'published',
    };
    
    if (!event.published_at) {
      updates.published_at = new Date().toISOString();
    }
    
    const { error: updateError } = await supabase
      .from('events')
      .update(updates)
      .eq('id', event.id);
    
    if (updateError) {
      console.log('❌ Failed to update event:', updateError.message);
    } else {
      console.log('✅ Event updated!');
      console.log('   - is_active: true');
      console.log('   - status: published');
      if (updates.published_at) {
        console.log('   - published_at: set');
      }
      console.log('\n🔄 Refresh your browser pages - event should appear now!');
    }
  } else {
    console.log('✅ All visibility checks passed!');
    console.log('\n💡 If event still not showing:');
    console.log('   1. Refresh the browser pages');
    console.log('   2. Check browser console for errors');
    console.log('   3. Verify Supabase connection on each site');
  }
}

checkEventStatus().catch(console.error);

