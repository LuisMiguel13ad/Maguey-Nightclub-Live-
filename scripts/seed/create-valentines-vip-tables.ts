import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '../../maguey-pass-lounge/.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const eventId = '00000000-0214-2026-0214-000000000214'

async function createVipTables() {
  console.log("Creating VIP tables for Valentine's Day event...")

  // Get all table templates
  const { data: templates, error: templateError } = await supabase
    .from('vip_table_templates')
    .select('*')
    .order('table_number')

  if (templateError || !templates) {
    console.error('Error fetching templates:', templateError)
    return
  }

  console.log('Found', templates.length, 'table templates')

  // Create VIP tables based on templates with Valentine's Day pricing
  const vipTables = templates.map((template) => {
    // Valentine's Day premium pricing
    let price_cents = 60000 // base $600
    let bottles = 1
    let champagne = 0
    let description = "Standard Valentine's Table with 1 bottle"

    if (template.default_tier === 'premium') {
      price_cents = 100000 // $1000
      bottles = 2
      champagne = 1
      description = "Premium Valentine's Package with 2 bottles + champagne"
    } else if (template.default_tier === 'front_row') {
      price_cents = 80000 // $800
      bottles = 1
      champagne = 1
      description = "Front Row Valentine's with 1 bottle + champagne"
    }

    return {
      event_id: eventId,
      table_template_id: template.id,
      table_number: template.table_number,
      tier: template.default_tier,
      capacity: template.default_capacity,
      price_cents,
      bottles_included: bottles,
      champagne_included: champagne,
      package_description: description,
      is_available: true,
      display_order: template.table_number,
    }
  })

  const { data, error } = await supabase
    .from('event_vip_tables')
    .upsert(vipTables, { onConflict: 'event_id,table_number' })
    .select()

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('\n=== VIP Tables Created Successfully ===')
  data?.forEach(t => {
    console.log(`Table ${t.table_number} (${t.tier}): $${t.price_cents / 100} - ${t.package_description}`)
  })
  console.log('\nTotal VIP tables:', data?.length)
}

createVipTables().catch(console.error)
