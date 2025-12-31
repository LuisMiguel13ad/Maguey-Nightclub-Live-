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

// Helper function to generate ticket type code
function generateTicketTypeCode(name: string, index: number = 0): string {
  const cleanName = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = cleanName.substring(0, 3);
  return `${prefix}${index.toString().padStart(3, '0')}`;
}

async function recreateEvent() {
  console.log('🎉 Recreating PRE THANKSGIVING BASH Event...\n');
  console.log('='.repeat(70));

  // Complete event data from flyer
  const eventData = {
    name: 'PRE THANKSGIVING BASH',
    description: `Join us for an epic Pre Thanksgiving Bash featuring RANE Rodriguez with special guests HER PANTH, KII NORTEÑA, Dj Calle, and ALMAS DE ACERO.

🎤 Headliner: RANE Rodriguez
🎸 Supporting Acts: HER PANTH, KII NORTEÑA, Dj Calle, ALMAS DE ACERO

📅 Date: Wednesday, November 26, 2025
⏰ Time: 9:00 PM
📍 Venue: Maguey Delaware
🏠 Address: 3320 Old Capitol Trail, Wilmington DE 19808

🎫 Ticket Pricing:
• Women FREE before 10 PM
• Men $35 before 10 PM
• General Admission after 10 PM

📱 Share required before 8 PM

👥 Age Restrictions:
• 16+ with parent
• 21+ to drink

📞 Contact: 484-354-9505 or 302-510-7161

Presented by LA EMPRESA MUSIC & EVENTOS PERRONES
Tickets available at BOLETAJE.com`,
    event_date: '2025-11-26',
    event_time: '21:00',
    venue_name: 'Maguey Delaware',
    venue_address: '3320 Old Capitol Trail',
    city: 'Wilmington',
    status: 'published',
    published_at: new Date().toISOString(),
    is_active: true,
    categories: ['norteña', 'live music', 'special event', 'thanksgiving'],
    tags: ['thanksgiving', 'rane rodriguez', 'her panth', 'lkii norteña', 'dj calle', 'almas de acero'],
  };

  // Ticket types from flyer
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
      price: 50.00, // Inferred pricing
      capacity: 200,
    },
  ];

  try {
    // Check if event exists
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('name', eventData.name)
      .single();

    let eventId: string;

    if (existing) {
      console.log('📝 Event exists, updating...\n');
      
      // Update existing event
      const { error: updateError } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', existing.id);

      if (updateError) {
        console.error('❌ Failed to update event:', updateError.message);
        throw updateError;
      }

      eventId = existing.id;
      console.log('✅ Event updated successfully!');
    } else {
      console.log('➕ Creating new event...\n');
      
      // Create new event
      const { data: newEvent, error: createError } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single();

      if (createError) {
        console.error('❌ Failed to create event:', createError.message);
        throw createError;
      }

      eventId = newEvent.id;
      console.log('✅ Event created successfully!');
    }

    console.log(`\n📋 Event ID: ${eventId}\n`);

    // Delete existing ticket types
    console.log('🗑️  Removing old ticket types...');
    await supabase.from('ticket_types').delete().eq('event_id', eventId);

    // Create ticket types
    console.log('🎫 Creating ticket types...\n');
    const ticketTypeRows = ticketTypes.map((tt, index) => ({
      event_id: eventId,
      name: tt.name.trim(),
      code: generateTicketTypeCode(tt.name, index),
      price: tt.price,
      total_inventory: tt.capacity,
    }));

    const { error: ttError } = await supabase
      .from('ticket_types')
      .insert(ticketTypeRows);

    if (ttError) {
      console.error('❌ Failed to create ticket types:', ttError.message);
    } else {
      console.log('✅ Ticket Types Created:');
      ticketTypes.forEach((tt, i) => {
        console.log(`   ${i + 1}. ${tt.name}: $${tt.price.toFixed(2)} (${tt.capacity} capacity)`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Event Recreation Complete!\n');
    
    console.log('Event Details:');
    console.log(`  Name: ${eventData.name}`);
    console.log(`  Date: ${eventData.event_date} (Wednesday, November 26, 2025)`);
    console.log(`  Time: ${eventData.event_time} (9:00 PM)`);
    console.log(`  Venue: ${eventData.venue_name}`);
    console.log(`  Address: ${eventData.venue_address}`);
    console.log(`  City: ${eventData.city}`);
    console.log(`  Status: ${eventData.status}`);
    console.log(`  is_active: ${eventData.is_active}`);
    console.log(`  Categories: ${eventData.categories.join(', ')}`);
    console.log(`  Tags: ${eventData.tags.join(', ')}`);

    console.log('\n' + '='.repeat(70));
    console.log('🖼️  FLYER IMAGE - Next Step Required:\n');
    console.log('To add the flyer image:');
    console.log('1. Go to: http://localhost:5175/events');
    console.log('2. Find "PRE THANKSGIVING BASH" event');
    console.log('3. Click "Edit" button');
    console.log('4. Scroll to "Event Image" section');
    console.log('5. Upload the flyer image file');
    console.log('6. Click "Save Event"\n');

    console.log('🔄 After uploading flyer:');
    console.log('   • Refresh Main Website (http://localhost:3000)');
    console.log('   • Refresh Purchase Website (http://localhost:5173/events)');
    console.log('   • Event should appear with flyer image!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

recreateEvent().catch(console.error);

