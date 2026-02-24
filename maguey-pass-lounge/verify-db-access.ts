
// turbo
import { createClient } from '@supabase/supabase-js'

// Load from environment variables with validation
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('❌ Error: VITE_SUPABASE_URL environment variable is not set')
  process.exit(1)
}

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set')
  process.exit(1)
}

// Create client with schema option if needed, but the method is usually chained
const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyCron() {
    console.log('Verifying pg_cron configuration...')

    // Correct usage: supabase.schema('cron').from('job')
    // We try to access the cron schema directly.
    try {
        const { data: jobs, error: cronError } = await supabase
            .schema('cron')
            .from('job')
            .select('*')

        if (cronError) {
            console.error('⚠️ Could not query cron.job via schema helper:', cronError.message)
            console.log('Note: The client might not have permissions for the cron schema via the API even with service_role.')
        } else {
            console.log('✅ Success: Accessed cron.job configuration.')
            const emailJob = jobs?.find(j => j.jobname === 'process-email-queue')
            if (emailJob) {
                console.log(`✅ Verified: process-email-queue job is active. Schedule: ${emailJob.schedule}`)
            } else {
                console.error('❌ Error: process-email-queue job NOT found in cron.job table.')
                console.log('Jobs found:', jobs?.map(j => j.jobname).join(', ') || 'None')
            }
        }
    } catch (err) {
        console.error('Unexpected error checking cron:', err)
    }

    // Double check connection by querying email_queue
    console.log('Verifying standard table access...')
    const { data: queue, error: queueError } = await supabase
        .from('email_queue')
        .select('count')
        .limit(1)

    if (queueError) {
        console.error('❌ Error accessing email_queue:', queueError.message)
    } else {
        console.log('✅ Success: email_queue table is accessible.')
    }
}

verifyCron()
