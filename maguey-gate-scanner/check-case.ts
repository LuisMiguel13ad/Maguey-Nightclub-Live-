import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://djbzjasdrwvbsoifxqzd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqYnpqYXNkcnd2YnNvaWZ4cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MDA5ODAsImV4cCI6MjA3ODM3Njk4MH0.q5nWNWKpAkTmIWf_hbxINpyzUENySwjulQw1h3c5Xws'
)

async function checkCase() {
  const originalId = 'MGY-1B-20251112-FCA98E4B-V2RL'
  const uppercaseId = originalId.toUpperCase()
  
  console.log('Original ID:', originalId)
  console.log('Uppercase ID:', uppercaseId)
  console.log('Are they the same?', originalId === uppercaseId)
  console.log()
  
  // Check what's in database
  const { data: ticket } = await supabase
    .from('tickets')
    .select('ticket_id')
    .eq('id', '6dcf8d71-08b5-407a-978f-5e43e01cb153')
    .single()
  
  console.log('Database ticket_id:', `"${ticket?.ticket_id}"`)
  console.log('Scanner searches for:', `"${uppercaseId}"`)
  console.log('Match:', ticket?.ticket_id === uppercaseId)
  console.log()
  
  // Test both queries
  console.log('Testing exact match (what scanner does)...')
  const { data: result1 } = await supabase
    .from('tickets')
    .select('*')
    .eq('ticket_id', uppercaseId)
    .maybeSingle()
  
  console.log('Result:', result1 ? '✅ FOUND' : '❌ NOT FOUND')
  
  if (!result1) {
    console.log('\n🔧 FIX: Update ticket_id to uppercase')
    const { error } = await supabase
      .from('tickets')
      .update({ ticket_id: uppercaseId, qr_code_data: uppercaseId })
      .eq('id', '6dcf8d71-08b5-407a-978f-5e43e01cb153')
    
    if (error) {
      console.log('❌ Error:', error.message)
    } else {
      console.log('✅ Updated! Try scanning again.')
    }
  }
}

checkCase()

