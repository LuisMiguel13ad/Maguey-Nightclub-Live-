# Webhook Request Signing - Testing Guide

This guide shows how to test the webhook request signing implementation with replay protection.

## ⚠️ Important: Header Names

The webhook expects these headers (case-insensitive):
- `X-Webhook-Signature` (not `X-Signature`)
- `X-Webhook-Timestamp` (not `X-Timestamp`)

## 🔧 Prerequisites

1. **Get your webhook URL:**
   ```bash
   WEBHOOK_URL="https://your-project.supabase.co/functions/v1/ticket-webhook"
   ```

2. **Get your webhook secret:**
   ```bash
   SECRET="your-webhook-secret-key"
   ```

3. **Install dependencies (if using the test script):**
   - `curl` (usually pre-installed)
   - `openssl` (usually pre-installed)

## 🧪 Test Methods

### Method 1: Automated Test Script (Recommended)

Run the comprehensive test script:

```bash
cd maguey-gate-scanner
./test-webhook-signing.sh "$WEBHOOK_URL" "$SECRET"
```

This script tests:
- ✅ Valid request
- ✅ Expired timestamp
- ✅ Future timestamp
- ✅ Invalid signature
- ✅ Replay attack
- ✅ Missing headers

### Method 2: Manual Testing

#### Test 1: Valid Request

```bash
# Generate timestamp and signature
TIMESTAMP=$(date +%s)
BODY='{"tickets":[{"ticket_id":"TEST-001","event_name":"Test Event","ticket_type":"General Admission"}]}'

# Create signature: HMAC-SHA256(timestamp + "." + body)
MESSAGE="${TIMESTAMP}.${BODY}"
SIGNATURE=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)
SIGNATURE="sha256=${SIGNATURE}"

# Send request
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -d "$BODY"

# Expected: HTTP 201 (or 200 if duplicate ticket_id)
```

#### Test 2: Expired Timestamp (>5 minutes old)

```bash
# Create timestamp 10 minutes ago
OLD_TIMESTAMP=$(($(date +%s) - 600))
BODY='{"tickets":[{"ticket_id":"TEST-002","event_name":"Test Event","ticket_type":"General Admission"}]}'

MESSAGE="${OLD_TIMESTAMP}.${BODY}"
SIGNATURE=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)
SIGNATURE="sha256=${SIGNATURE}"

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $OLD_TIMESTAMP" \
  -d "$BODY"

# Expected: HTTP 401 with error "TIMESTAMP_EXPIRED"
```

#### Test 3: Replay Attack (Same Request Twice)

```bash
# First request (should succeed)
TIMESTAMP=$(date +%s)
BODY='{"tickets":[{"ticket_id":"TEST-003","event_name":"Test Event","ticket_type":"General Admission"}]}'

MESSAGE="${TIMESTAMP}.${BODY}"
SIGNATURE=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)
SIGNATURE="sha256=${SIGNATURE}"

# Send first request
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -d "$BODY"

# Wait a moment
sleep 1

# Send same request again (should fail)
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -d "$BODY"

# Expected: HTTP 409 with error "REPLAY_DETECTED"
```

#### Test 4: Invalid Signature

```bash
TIMESTAMP=$(date +%s)
BODY='{"tickets":[{"ticket_id":"TEST-004","event_name":"Test Event","ticket_type":"General Admission"}]}'
WRONG_SIGNATURE="sha256=invalid_signature_hash_12345"

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $WRONG_SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -d "$BODY"

# Expected: HTTP 401 with error "INVALID_SIGNATURE"
```

#### Test 5: Missing Headers

```bash
BODY='{"tickets":[{"ticket_id":"TEST-005","event_name":"Test Event","ticket_type":"General Admission"}]}'

# Missing signature
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Timestamp: $(date +%s)" \
  -d "$BODY"

# Expected: HTTP 400 or 401 with error "MISSING_HEADERS"
```

## 📝 Signature Format

The signature is created as follows:

1. **Message format:** `{timestamp}.{body}`
   - Example: `1699999999.{"ticket_id":"TEST-001"}`

2. **Algorithm:** HMAC-SHA256

3. **Output format:** `sha256={hex_signature}`
   - Example: `sha256=a1b2c3d4e5f6...`

## 🔍 Verification Flow

The webhook verifies requests in this order:

1. ✅ Check if IP is blocked (>10 security events)
2. ✅ Extract `X-Webhook-Signature` and `X-Webhook-Timestamp` headers
3. ✅ Validate timestamp is within 5 minutes (reject if expired)
4. ✅ Validate timestamp is not >1 minute in future (clock skew tolerance)
5. ✅ Check in-memory cache for replay
6. ✅ Check database (`webhook_events` table) for replay
7. ✅ Compute expected signature: `HMAC-SHA256(timestamp + "." + body)`
8. ✅ Compare signatures (constant-time comparison)
9. ✅ Record signature to prevent replay
10. ✅ Process webhook

## 🛠️ Troubleshooting

### Issue: "Invalid signature" but signature looks correct

**Solution:** Make sure:
- The message format is exactly `{timestamp}.{body}` (no extra spaces)
- The body is the exact JSON string (no formatting changes)
- The secret key matches exactly
- The signature includes the `sha256=` prefix

### Issue: "Timestamp expired" on fresh requests

**Solution:** Check:
- System clock is synchronized (use NTP)
- The timestamp is in Unix seconds (not milliseconds)
- The request isn't taking too long to send

### Issue: Replay detected on first request

**Solution:** 
- Make sure you're using a unique timestamp for each request
- Check if the signature was already recorded in the database
- Wait a few seconds between tests

## 📊 Monitoring

After running tests, check security events:

```sql
-- View recent security events
SELECT * FROM security_event_logs 
ORDER BY created_at DESC 
LIMIT 20;

-- View security alerts
SELECT * FROM security_alerts 
WHERE acknowledged = FALSE 
ORDER BY timestamp DESC;

-- View webhook events (replay protection)
SELECT * FROM webhook_events 
ORDER BY created_at DESC 
LIMIT 20;
```

## ✅ Expected Test Results

| Test | Expected HTTP Code | Expected Error |
|------|-------------------|----------------|
| Valid Request | 201 | None |
| Expired Timestamp | 401 | `TIMESTAMP_EXPIRED` |
| Future Timestamp | 401 | `TIMESTAMP_FUTURE` |
| Invalid Signature | 401 | `INVALID_SIGNATURE` |
| Replay Attack | 409 | `REPLAY_DETECTED` |
| Missing Headers | 400/401 | `MISSING_HEADERS` |

## 🔐 Security Notes

- Signatures are stored in-memory and in database for replay protection
- IP addresses are tracked for security event monitoring
- After 10 security events, an IP is automatically blocked
- After 5 security events, a security alert is created
- All security events are logged for audit purposes
