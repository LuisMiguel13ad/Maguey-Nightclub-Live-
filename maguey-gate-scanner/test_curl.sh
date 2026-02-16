#!/bin/bash
# Load env vars
VITE_SUPABASE_URL=$(grep VITE_SUPABASE_URL .env | cut -d= -f2 | tr -d '\r')
VITE_SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env | cut -d= -f2 | tr -d '\r')

echo "URL: $VITE_SUPABASE_URL"
echo "KEY: ${VITE_SUPABASE_ANON_KEY:0:10}..."

# Test 1: Simple Ticket Fetch
echo "--- Test 1: Simple Ticket Fetch ---"
curl -s -w "\nHTTP Code: %{http_code}\n" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  "$VITE_SUPABASE_URL/rest/v1/tickets?qr_token=eq.4bbf04e3-580c-4740-a061-0294e6dd2c33"

# Test 2: Fetch with Joins
echo "--- Test 2: Fetch with Joins ---"
curl -s -w "\nHTTP Code: %{http_code}\n" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  "$VITE_SUPABASE_URL/rest/v1/tickets?qr_token=eq.4bbf04e3-580c-4740-a061-0294e6dd2c33&select=*,events(*),ticket_types(*)"

# Test 3: Fetch with OR logic (simulating simple-scanner.ts)
echo "--- Test 3: Fetch with OR logic ---"
TOKEN="4bbf04e3-580c-4740-a061-0294e6dd2c33"
curl -s -w "\nHTTP Code: %{http_code}\n" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  "$VITE_SUPABASE_URL/rest/v1/tickets?or=(id.eq.$TOKEN,ticket_id.eq.$TOKEN,qr_code_data.eq.$TOKEN)&select=*,events(*),ticket_types(*)&limit=1"

# Test 4: Fetch with OR logic INCLUDING qr_token (Proposed Fix)
echo "--- Test 4: Fetch with OR logic INCLUDING qr_token ---"
curl -s -w "\nHTTP Code: %{http_code}\n" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  "$VITE_SUPABASE_URL/rest/v1/tickets?or=(id.eq.$TOKEN,ticket_id.eq.$TOKEN,qr_code_data.eq.$TOKEN,qr_token.eq.$TOKEN)&select=*,events(*),ticket_types(*)&limit=1"
