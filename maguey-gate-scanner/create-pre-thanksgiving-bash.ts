import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Try service role key first (for admin operations), then fallback to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
                    process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and one of:');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY (recommended for admin operations)');
  console.error('  - VITE_SUPABASE_PUBLISHABLE_KEY');
  console.error('  - VITE_SUPABASE_ANON_KEY');
  console.error('\n💡 Get service role key from: Supabase Dashboard → Settings → API → service_role key');
  console.error('   ⚠️  Keep service role key secret - never commit to git!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to generate ticket type code
function generateTicketTypeCode(name: string, index: number = 0): string {
  const cleanName = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = cleanName.substring(0, 3);
  return `${prefix}${index.toString().padStart(3, '0')}`;
}

async function createPreThanksgivingBash() {
  console.log('🎉 Creating PRE THANKSGIVING BASH Event...\n');

  // Event details extracted from flyer
  const eventData = {
    name: 'PRE THANKSGIVING BASH',
    description: `Join us for an epic Pre Thanksgiving Bash featuring HANE Rodriguez with special guests HER PANTH, LKII NORTEÑA, Dj Calle, and ALMAS DE ACERO. 

Event Details:
- Headliner: HANE Rodriguez
- Supporting Acts: HER PANTH, LKII NORTEÑA, Dj Calle, ALMAS DE ACERO
- Age: 16+ with parent, 21+ to drink
- Share required before 8 PM
- Women free before 10 PM
- Men $35 before 10 PM

Presented by LA EMPRESA MUSIC & EVENTOS PERRONES`,
    event_date: '2025-11-26', // Wednesday, November 26, 2025
    event_time: '21:00', // 9:00 PM (inferred from typical event time)
    venue_name: 'Maguey Delaware',
    venue_address: '3320 Old Capitol Trail',
    city: 'Wilmington',
    status: 'published', // Published so it appears on all sites
    published_at: new Date().toISOString(),
    categories: ['norteña', 'live music', 'special event'],
    tags: ['thanksgiving', 'hane rodriguez', 'her panth', 'lkii norteña'],
  };

  // Ticket types based on flyer pricing
  const ticketTypes = [
    {
      name: 'Women - Before 10 PM',
      price: 0.00,
      capacity: 200,
    },
    {
      name: 'Men - Before 10 PM',
      price: 35.00,
      capacity: 300,
    },
    {
      name: 'General Admission - After 10 PM',
      price: 50.00, // Inferred pricing for after 10 PM
      capacity: 200,
    },
  ];

  console.log('Event Details:');
  console.log(`  Name: ${eventData.name}`);
  console.log(`  Date: ${eventData.event_date} (Wednesday, November 26, 2025)`);
  console.log(`  Time: ${eventData.event_time}`);
  console.log(`  Venue: ${eventData.venue_name}`);
  console.log(`  Address: ${eventData.venue_address}`);
  console.log(`  City: ${eventData.city}`);
  console.log(`  Status: ${eventData.status}`);
  console.log(`\n  Ticket Types:`);
  ticketTypes.forEach((tt, i) => {
    console.log(`    ${i + 1}. ${tt.name}: $${tt.price.toFixed(2)} (${tt.capacity} capacity)`);
  });
  console.log('');

  try {
    // Insert event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert([eventData])
      .select()
      .single();

    if (eventError) {
      if (eventError.code === '23505') {
        console.error('❌ Event with this name already exists!');
        console.log('💡 Updating existing event instead...');
        
        // Try to find and update existing event
        const { data: existing } = await supabase
          .from('events')
          .select('id')
          .eq('name', eventData.name)
          .single();
        
        if (existing) {
          const { data: updated, error: updateError } = await supabase
            .from('events')
            .update(eventData)
            .eq('id', existing.id)
            .select()
            .single();
          
          if (updateError) throw updateError;
          console.log('✅ Event Updated Successfully!\n');
          console.log(`   Event ID: ${updated.id}`);
          
          // Delete old ticket types
          await supabase
            .from('ticket_types')
            .delete()
            .eq('event_id', updated.id);
          
          // Create new ticket types
          const ticketTypeRows = ticketTypes.map((tt, index) => ({
            event_id: updated.id,
            name: tt.name.trim(),
            code: generateTicketTypeCode(tt.name, index),
            price: tt.price,
            total_inventory: tt.capacity,
          }));

          const { error: ttError } = await supabase
            .from('ticket_types')
            .insert(ticketTypeRows);

          if (ttError) {
            console.error('⚠️  Warning: Could not create ticket types:', ttError.message);
          } else {
            console.log('✅ Ticket Types Created/Updated:');
            ticketTypes.forEach((tt, i) => {
              console.log(`   ${i + 1}. ${tt.name}: $${tt.price.toFixed(2)} (${tt.capacity} capacity)`);
            });
          }
          
          console.log('\n✅ Event is now live on all sites!');
          return;
        }
      }
      throw eventError;
    }

    console.log('✅ Event Created Successfully!\n');
    console.log(`   Event ID: ${event.id}`);
    console.log(`   Event Name: ${event.name}\n`);

    // Create ticket types in separate table
    const ticketTypeRows = ticketTypes.map((tt, index) => ({
      event_id: event.id,
      name: tt.name.trim(),
      code: generateTicketTypeCode(tt.name, index),
      price: tt.price,
      total_inventory: tt.capacity,
    }));

    const { error: ttError } = await supabase
      .from('ticket_types')
      .insert(ticketTypeRows);

    if (ttError) {
      console.error('⚠️  Warning: Could not create ticket types:', ttError.message);
    } else {
      console.log('✅ Ticket Types Created:');
      ticketTypes.forEach((tt, i) => {
        console.log(`   ${i + 1}. ${tt.name}: $${tt.price.toFixed(2)} (${tt.capacity} capacity)`);
      });
    }

    console.log('\n✅ Event is now live on all sites!');
    console.log('\n📋 Event will appear on:');
    console.log('   • Main Website (Marketing Site)');
    console.log('   • Purchase Website (Ticket Sales)');
    console.log('   • Scanner Dashboard');
    console.log('\n🎫 Customers can now purchase tickets!');

  } catch (error: any) {
    console.error('❌ Error creating event:', error.message);
    console.error('   Full error:', error);
    process.exit(1);
  }
}

createPreThanksgivingBash();

