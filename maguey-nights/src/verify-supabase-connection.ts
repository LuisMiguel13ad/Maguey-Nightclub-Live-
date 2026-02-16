// Verification script to check Supabase connection and event dates
import { supabase } from './lib/supabase'

async function verifyConnection() {
  console.log('🔍 Verifying Supabase Connection...\n')
  
  // Get the project URL from the client
  const projectUrl = supabase.supabaseUrl
  console.log('📡 Connected to Supabase Project:', projectUrl)
  console.log('')
  
  // Fetch events to verify data
  const { data: events, error } = await supabase
    .from('events')
    .select('id, name, event_date, event_time, is_active, status, created_at')
    .eq('is_active', true)
    .order('event_date', { ascending: true })
    .limit(5)
  
  if (error) {
    console.error('❌ Error fetching events:', error)
    return
  }
  
  console.log(`✅ Successfully connected! Found ${events?.length || 0} active events\n`)
  console.log('📅 Sample Events (first 5):')
  console.log('=' .repeat(80))
  
  events?.forEach((event, index) => {
    console.log(`\n${index + 1}. ${event.name}`)
    console.log(`   Date: ${event.event_date}`)
    console.log(`   Time: ${event.event_time}`)
    console.log(`   Status: ${event.status}`)
    console.log(`   Created: ${event.created_at}`)
    
    // Check date parsing
    const dateObj = new Date(event.event_date)
    console.log(`   Parsed Date: ${dateObj.toISOString()}`)
    console.log(`   Local Date: ${dateObj.toLocaleDateString()}`)
  })
  
  console.log('\n' + '='.repeat(80))
  
  // Check date range
  const { data: dateRange } = await supabase
    .from('events')
    .select('event_date')
    .eq('is_active', true)
    .order('event_date', { ascending: true })
  
  if (dateRange && dateRange.length > 0) {
    const dates = dateRange.map(e => e.event_date).filter(Boolean)
    const earliest = dates[0]
    const latest = dates[dates.length - 1]
    console.log(`\n📊 Date Range:`)
    console.log(`   Earliest: ${earliest}`)
    console.log(`   Latest: ${latest}`)
    console.log(`   Total Events: ${dates.length}`)
  }
}

verifyConnection().catch(console.error)

