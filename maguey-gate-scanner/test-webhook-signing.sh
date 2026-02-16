#!/bin/bash
# ============================================
# Webhook Request Signing Test Script
# ============================================
#
# This script tests the webhook signature verification:
# 1. Valid request with correct signature
# 2. Expired timestamp
# 3. Replay attack detection
#
# Usage:
#   ./test-webhook-signing.sh <webhook-url> <secret>
#
# Example:
#   ./test-webhook-signing.sh https://your-project.supabase.co/functions/v1/ticket-webhook "your-secret-key"
# ============================================

set -e

WEBHOOK_URL="${1:-http://localhost:54321/functions/v1/ticket-webhook}"
SECRET="${2:-test-webhook-secret-key}"

echo "============================================"
echo "Webhook Request Signing Tests"
echo "============================================"
echo "Webhook URL: $WEBHOOK_URL"
echo "Secret: ${SECRET:0:10}..."
echo ""

# ============================================
# Helper Functions
# ============================================

# Create HMAC-SHA256 signature
create_signature() {
  local timestamp="$1"
  local body="$2"
  local secret="$3"
  
  # Create message: timestamp + "." + body
  local message="${timestamp}.${body}"
  
  # Generate HMAC-SHA256 signature
  local signature=$(echo -n "$message" | openssl dgst -sha256 -hmac "$secret" | cut -d' ' -f2)
  
  # Add prefix
  echo "sha256=${signature}"
}

# Send webhook request
send_request() {
  local signature="$1"
  local timestamp="$2"
  local body="$3"
  local description="$4"
  
  echo "--------------------------------------------"
  echo "Test: $description"
  echo "--------------------------------------------"
  echo "Timestamp: $timestamp"
  echo "Signature: ${signature:0:30}..."
  echo ""
  
  local response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Signature: $signature" \
    -H "X-Webhook-Timestamp: $timestamp" \
    -d "$body")
  
  local http_code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
  local body_response=$(echo "$response" | sed 's/HTTP_CODE:[0-9]*$//')
  
  echo "Response Code: $http_code"
  echo "Response Body: $body_response"
  echo ""
  
  return $http_code
}

# ============================================
# Test 1: Valid Request
# ============================================

echo "============================================"
echo "TEST 1: Valid Request"
echo "============================================"

TIMESTAMP=$(date +%s)
BODY='{"tickets":[{"ticket_id":"TEST-001","event_name":"Test Event","ticket_type":"General Admission"}]}'
SIGNATURE=$(create_signature "$TIMESTAMP" "$BODY" "$SECRET")

send_request "$SIGNATURE" "$TIMESTAMP" "$BODY" "Valid Request"

if [ $? -eq 201 ] || [ $? -eq 200 ]; then
  echo "✅ TEST 1 PASSED: Valid request accepted"
else
  echo "❌ TEST 1 FAILED: Valid request rejected"
fi

echo ""
sleep 1

# ============================================
# Test 2: Expired Timestamp
# ============================================

echo "============================================"
echo "TEST 2: Expired Timestamp (>5 minutes old)"
echo "============================================"

# Create timestamp 10 minutes ago
OLD_TIMESTAMP=$(($(date +%s) - 600))
BODY='{"tickets":[{"ticket_id":"TEST-002","event_name":"Test Event","ticket_type":"General Admission"}]}'
SIGNATURE=$(create_signature "$OLD_TIMESTAMP" "$BODY" "$SECRET")

send_request "$SIGNATURE" "$OLD_TIMESTAMP" "$BODY" "Expired Timestamp"

if [ $? -eq 401 ]; then
  echo "✅ TEST 2 PASSED: Expired timestamp rejected"
else
  echo "❌ TEST 2 FAILED: Expired timestamp accepted (should be rejected)"
fi

echo ""
sleep 1

# ============================================
# Test 3: Future Timestamp
# ============================================

echo "============================================"
echo "TEST 3: Future Timestamp (>1 minute ahead)"
echo "============================================"

# Create timestamp 2 minutes in future
FUTURE_TIMESTAMP=$(($(date +%s) + 120))
BODY='{"tickets":[{"ticket_id":"TEST-003","event_name":"Test Event","ticket_type":"General Admission"}]}'
SIGNATURE=$(create_signature "$FUTURE_TIMESTAMP" "$BODY" "$SECRET")

send_request "$SIGNATURE" "$FUTURE_TIMESTAMP" "$BODY" "Future Timestamp"

if [ $? -eq 401 ]; then
  echo "✅ TEST 3 PASSED: Future timestamp rejected"
else
  echo "❌ TEST 3 FAILED: Future timestamp accepted (should be rejected)"
fi

echo ""
sleep 1

# ============================================
# Test 4: Invalid Signature
# ============================================

echo "============================================"
echo "TEST 4: Invalid Signature"
echo "============================================"

TIMESTAMP=$(date +%s)
BODY='{"tickets":[{"ticket_id":"TEST-004","event_name":"Test Event","ticket_type":"General Admission"}]}'
WRONG_SIGNATURE="sha256=invalid_signature_hash_12345"

send_request "$WRONG_SIGNATURE" "$TIMESTAMP" "$BODY" "Invalid Signature"

if [ $? -eq 401 ]; then
  echo "✅ TEST 4 PASSED: Invalid signature rejected"
else
  echo "❌ TEST 4 FAILED: Invalid signature accepted (should be rejected)"
fi

echo ""
sleep 1

# ============================================
# Test 5: Replay Attack
# ============================================

echo "============================================"
echo "TEST 5: Replay Attack (Same Request Twice)"
echo "============================================"

TIMESTAMP=$(date +%s)
BODY='{"tickets":[{"ticket_id":"TEST-005","event_name":"Test Event","ticket_type":"General Admission"}]}'
SIGNATURE=$(create_signature "$TIMESTAMP" "$BODY" "$SECRET")

echo "Sending first request..."
send_request "$SIGNATURE" "$TIMESTAMP" "$BODY" "First Request (Should Succeed)"

FIRST_CODE=$?

echo ""
sleep 1

echo "Sending second request with same signature..."
send_request "$SIGNATURE" "$TIMESTAMP" "$BODY" "Replay Request (Should Fail)"

SECOND_CODE=$?

if [ $FIRST_CODE -eq 201 ] || [ $FIRST_CODE -eq 200 ]; then
  if [ $SECOND_CODE -eq 409 ]; then
    echo "✅ TEST 5 PASSED: Replay attack detected and rejected"
  else
    echo "❌ TEST 5 PARTIAL: First request succeeded, but replay was not rejected (got $SECOND_CODE)"
  fi
else
  echo "❌ TEST 5 FAILED: First request failed (got $FIRST_CODE)"
fi

echo ""
sleep 1

# ============================================
# Test 6: Missing Headers
# ============================================

echo "============================================"
echo "TEST 6: Missing Headers"
echo "============================================"

BODY='{"tickets":[{"ticket_id":"TEST-006","event_name":"Test Event","ticket_type":"General Admission"}]}'

echo "Test: Missing X-Webhook-Signature"
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Timestamp: $(date +%s)" \
  -d "$BODY")

http_code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
echo "Response Code: $http_code"

if [ "$http_code" -eq 400 ] || [ "$http_code" -eq 401 ]; then
  echo "✅ TEST 6 PASSED: Missing signature header rejected"
else
  echo "❌ TEST 6 FAILED: Missing signature header accepted (should be rejected)"
fi

echo ""
echo "============================================"
echo "Test Summary"
echo "============================================"
echo "All tests completed. Review results above."
echo ""
