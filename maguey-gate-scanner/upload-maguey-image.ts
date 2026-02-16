// Upload maguey.jpg image to PRE THANKSGIVING BASH event
// Run with: npx tsx upload-maguey-image.ts

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
const IMAGE_PATH = resolve(__dirname, '../maguey-nights/src/Pictures/maguey.jpg');

async function uploadMagueyImage() {
  console.log('\n🖼️  UPLOADING MAGUEY IMAGE TO EVENT\n');
  console.log(`Event: ${EVENT_NAME}`);
  console.log(`Image: ${IMAGE_PATH}`);
  console.log('='.repeat(60));

  // Check if image file exists
  try {
    const fs = await import('fs');
    if (!fs.existsSync(IMAGE_PATH)) {
      console.error(`❌ Image file not found: ${IMAGE_PATH}`);
      return;
    }
  } catch (error) {
    console.error('❌ Error checking file:', error);
    return;
  }

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

  // Read image file
  console.log('\n📖 Reading Image File...');
  try {
    const imageBuffer = readFileSync(IMAGE_PATH);
    console.log(`✅ Image read successfully (${(imageBuffer.length / 1024).toFixed(2)} KB)`);

    // Upload to Supabase Storage
    console.log('\n📤 Uploading to Supabase Storage...');
    const timestamp = Date.now();
    const fileName = `events/${event.id}/${timestamp}-maguey-thanksgiving-bash.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('event-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
      console.error('   Details:', uploadError);
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
    console.error('   Stack:', error.stack);
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ COMPLETE');
  console.log('='.repeat(60));
  console.log('\n👉 The maguey.jpg image will now appear on:');
  console.log('   - Main website event cards (maguey-nights)');
  console.log('   - Ticket purchase site event cards (maguey-pass-lounge)');
  console.log('   - Individual tickets (at the top)');
  console.log('\n💡 Refresh your browsers to see the changes!\n');
}

uploadMagueyImage()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

