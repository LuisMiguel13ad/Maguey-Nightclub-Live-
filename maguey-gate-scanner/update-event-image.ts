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

const imageUrl = process.argv[2];

if (!imageUrl) {
  console.log('Usage: npx tsx update-event-image.ts <image-url>');
  console.log('\nExample:');
  console.log('  npx tsx update-event-image.ts https://example.com/flyer.jpg');
  process.exit(1);
}

async function updateEventImage() {
  console.log('🖼️  Updating Event Image...\n');

  const { data: event, error: findError } = await supabase
    .from('events')
    .select('id, name, image_url')
    .eq('name', 'PRE THANKSGIVING BASH')
    .single();

  if (findError || !event) {
    console.log('❌ Event not found');
    return;
  }

  console.log(`Event: ${event.name}`);
  console.log(`Current Image: ${event.image_url || 'None'}`);
  console.log(`New Image URL: ${imageUrl}\n`);

  const { error: updateError } = await supabase
    .from('events')
    .update({ image_url: imageUrl })
    .eq('id', event.id);

  if (updateError) {
    console.log('❌ Failed to update:', updateError.message);
    return;
  }

  console.log('✅ Event image updated successfully!');
  console.log('\n🔄 Refresh your browser pages to see the flyer.');
}

updateEventImage().catch(console.error);

