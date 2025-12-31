// Upload an actual image for PRE THANKSGIVING BASH event
// Run with: npx tsx upload-event-image.ts

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

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

async function uploadEventImage() {
  console.log('\n🖼️  UPLOADING EVENT IMAGE\n');
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
  console.log(`   Event ID: ${event.id}`);

  // Download a Thanksgiving party image from a reliable source
  console.log('\n📥 Downloading Image...');
  try {
    // Using a high-quality Thanksgiving/party image from Unsplash
    const imageUrl = 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&h=800&fit=crop&q=90';
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Determine content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const extension = contentType.includes('png') ? 'png' : 'jpg';

    console.log(`✅ Image downloaded (${(buffer.length / 1024).toFixed(2)} KB)`);

    // Upload to Supabase Storage
    console.log('\n📤 Uploading to Supabase Storage...');
    const timestamp = Date.now();
    const fileName = `events/${event.id}/${timestamp}-pre-thanksgiving-bash.${extension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('event-images')
      .upload(fileName, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
      
      // If bucket doesn't exist or permission issue, try with a public URL instead
      console.log('\n💡 Trying alternative: Using public image URL...');
      const publicImageUrl = 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&h=800&fit=crop&q=90';
      
      const { data: updatedEvent, error: updateError } = await supabase
        .from('events')
        .update({ image_url: publicImageUrl })
        .eq('id', event.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Failed to update event:', updateError.message);
        return;
      }

      console.log('✅ Event updated with public image URL');
      console.log(`   Image URL: ${updatedEvent.image_url}`);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('event-images')
      .getPublicUrl(fileName);

    console.log(`✅ Image uploaded successfully!`);
    console.log(`   Storage path: ${fileName}`);
    console.log(`   Public URL: ${urlData.publicUrl}`);

    // Update event with image URL
    console.log('\n🔄 Updating Event...');
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update({ image_url: urlData.publicUrl })
      .eq('id', event.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update event:', updateError.message);
      return;
    }

    console.log('✅ Event updated successfully!');
    console.log(`   New image_url: ${updatedEvent.image_url}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    // Fallback: Use a reliable public image URL
    console.log('\n💡 Using fallback image URL...');
    const fallbackUrl = 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&h=800&fit=crop&q=90';
    
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update({ image_url: fallbackUrl })
      .eq('id', event.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update event:', updateError.message);
      return;
    }

    console.log('✅ Event updated with fallback image URL');
    console.log(`   Image URL: ${updatedEvent.image_url}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ COMPLETE');
  console.log('='.repeat(60));
  console.log('\n👉 The event image will now appear on:');
  console.log('   - Main website event cards');
  console.log('   - Ticket purchase site event cards');
  console.log('   - Individual tickets (at the top)');
  console.log('\n💡 Refresh your browsers to see the changes!\n');
}

uploadEventImage()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

