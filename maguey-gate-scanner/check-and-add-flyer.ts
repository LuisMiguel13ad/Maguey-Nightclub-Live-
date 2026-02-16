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

async function checkAndAddFlyer() {
  console.log('🔍 Checking Event Flyer Status...\n');

  const { data: event, error } = await supabase
    .from('events')
    .select('id, name, image_url')
    .eq('name', 'PRE THANKSGIVING BASH')
    .single();

  if (error || !event) {
    console.log('❌ Event not found');
    return;
  }

  console.log(`Event: ${event.name}`);
  console.log(`Event ID: ${event.id}`);
  console.log(`Current Image URL: ${event.image_url || '❌ NO IMAGE ATTACHED'}\n`);

  if (event.image_url) {
    console.log('✅ Event already has an image attached!');
    console.log(`   URL: ${event.image_url}`);
    return;
  }

  console.log('⚠️  Event does NOT have a flyer image attached.\n');
  console.log('📋 To add the flyer image:\n');
  console.log('OPTION 1: Through Dashboard UI (Recommended)');
  console.log('1. Go to: http://localhost:5175/events');
  console.log('2. Find "PRE THANKSGIVING BASH" event');
  console.log('3. Click "Edit" button');
  console.log('4. Scroll to "Event Image" section');
  console.log('5. Click "Choose File" and select the flyer image');
  console.log('6. Click "Upload Image"');
  console.log('7. Click "Save Event"\n');
  
  console.log('OPTION 2: Use Flyer Scanning Feature');
  console.log('1. Go to: http://localhost:5175/events');
  console.log('2. Click "Create Event" or edit existing event');
  console.log('3. Upload the flyer image');
  console.log('4. Click "Auto-fill Details from Flyer" (if OpenAI key configured)');
  console.log('5. The image will be attached automatically\n');
  
  console.log('OPTION 3: Provide Image URL');
  console.log('If you have the flyer hosted elsewhere, you can update it directly:\n');
  console.log('Run: npx tsx update-event-image.ts <image-url>\n');
}

checkAndAddFlyer().catch(console.error);

