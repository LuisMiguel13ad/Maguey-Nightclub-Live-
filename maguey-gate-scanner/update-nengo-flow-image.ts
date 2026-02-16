import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://djbzjasdrwvbsoifxqzd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgwMDk4MCwiZXhwIjoyMDc4Mzc2OTgwfQ.EyrW9yk_q3VOP8AQ-f8nskDF7O-K83jg433NeEOmHwE';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function updateNengoFlowImage() {
  console.log('🖼️  Step 1: Finding Nengo Flow event...\n');
  
  // Find the event
  const { data: events, error: findError } = await supabase
    .from('events')
    .select('id, name, image_url')
    .eq('name', 'Ñengo Flow')
    .limit(1);

  if (findError) {
    console.error('❌ Error finding event:', findError);
    throw findError;
  }

  if (!events || events.length === 0) {
    console.error('❌ Event "Ñengo Flow" not found');
    return;
  }

  const event = events[0];
  console.log('✅ Found event:');
  console.log('   ID:', event.id);
  console.log('   Name:', event.name);
  console.log('   Current Image:', event.image_url || 'None');
  console.log('');

  console.log('📸 Step 2: Updating event with flyer image...\n');
  console.log('   Image URL: https://boletaje.com/admin/img_principal/1762821097.png');
  console.log('');

  // Update the event with the image URL
  const { data: updatedEvent, error: updateError } = await supabase
    .from('events')
    .update({ image_url: 'https://boletaje.com/admin/img_principal/1762821097.png' })
    .eq('id', event.id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Error updating event:', updateError);
    throw updateError;
  }

  console.log('✅ Event updated successfully!');
  console.log('   Event ID:', updatedEvent.id);
  console.log('   Event Name:', updatedEvent.name);
  console.log('   Image URL:', updatedEvent.image_url);
  console.log('');

  console.log('🎉 Image added! The event should now display the flyer on all sites.');
  console.log('\nNext steps:');
  console.log('1. Refresh owner dashboard: http://localhost:3005/events');
  console.log('2. Refresh main site: http://localhost:3000');
  console.log('3. Refresh purchase site: http://localhost:5173');
  console.log('   The flyer image should now appear on all event cards!');
}

updateNengoFlowImage().catch(console.error);

