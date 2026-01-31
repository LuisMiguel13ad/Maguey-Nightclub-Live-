/**
 * Check actual database schema via REST API
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../maguey-pass-lounge/.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

async function checkSchema() {
  console.log('Checking events table schema...\n');

  // Try to get one row from events to see actual columns
  const response = await fetch(`${SUPABASE_URL}/rest/v1/events?limit=1`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    }
  });

  if (response.ok) {
    const data = await response.json();
    if (data.length > 0) {
      console.log('Events table columns:', Object.keys(data[0]).join(', '));
      console.log('\nSample row:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('Events table is empty. Checking column structure via HEAD...');
    }
  } else {
    console.log('Failed to query events:', await response.text());
  }

  // Check event_vip_tables
  console.log('\n--- event_vip_tables ---');
  const vipTablesResponse = await fetch(`${SUPABASE_URL}/rest/v1/event_vip_tables?limit=1`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    }
  });

  if (vipTablesResponse.ok) {
    const data = await vipTablesResponse.json();
    if (data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).join(', '));
    } else {
      console.log('Table is empty');
    }
  }

  // Check vip_reservations
  console.log('\n--- vip_reservations ---');
  const reservationsResponse = await fetch(`${SUPABASE_URL}/rest/v1/vip_reservations?limit=1`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    }
  });

  if (reservationsResponse.ok) {
    const data = await reservationsResponse.json();
    if (data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).join(', '));
    } else {
      console.log('Table is empty');
    }
  }

  // Check vip_guest_passes
  console.log('\n--- vip_guest_passes ---');
  const passesResponse = await fetch(`${SUPABASE_URL}/rest/v1/vip_guest_passes?limit=1`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    }
  });

  if (passesResponse.ok) {
    const data = await passesResponse.json();
    if (data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).join(', '));
    } else {
      console.log('Table is empty');
    }
  }
}

checkSchema().catch(console.error);
