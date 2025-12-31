// Add image to PRE THANKSGIVING BASH event
// Run with: npx tsx add-event-image.ts

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const EVENT_NAME = 'PRE THANKSGIVING BASH';

async function addEventImage() {
  console.log('\n🖼️  ADDING EVENT IMAGE\n');
  console.log(`Event: ${EVENT_NAME}`);
  console.log('='.repeat(60));

  // Get event
  console.log('\n📅 Finding Event...');
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, name, image_url')
    .eq('name', EVENT_NAME)
    .single();

  if (eventError || !event) {
    console.error('❌ Event not found:', eventError?.message);
    return;
  }

  console.log(`✅ Found event: ${event.name}`);
  console.log(`   Current image_url: ${event.image_url || 'None'}`);

  // Use a placeholder image URL for now
  // This is a Thanksgiving-themed placeholder from placeholder.com
  // In production, you would upload an actual flyer image
  const placeholderImageUrl = 'https://images.unsplash.com/photo-1606914469633-bdbf47f0e739?w=1200&h=800&fit=crop&q=80';
  
  // Alternative: Use a simple colored placeholder
  // const placeholderImageUrl = `https://via.placeholder.com/1200x800/8B5CF6/FFFFFF?text=${encodeURIComponent('PRE THANKSGIVING BASH')}`;
  
  // Update event with image URL
  console.log('\n📤 Updating Event Image...');
  const { data: updatedEvent, error: updateError } = await supabase
    .from('events')
    .update({ image_url: placeholderImageUrl })
    .eq('id', event.id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Failed to update event:', updateError.message);
    return;
  }

  console.log('✅ Event image updated successfully!');
  console.log(`   New image_url: ${updatedEvent.image_url}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ COMPLETE');
  console.log('='.repeat(60));
  console.log('\n👉 The event image will now appear on:');
  console.log('   - Main website event cards');
  console.log('   - Ticket purchase site event cards');
  console.log('   - Individual tickets');
  console.log('\n💡 To use a custom image:');
  console.log('   1. Upload your flyer through Owner Dashboard → Events');
  console.log('   2. Or replace the placeholder URL with your image URL\n');
}

addEventImage()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

