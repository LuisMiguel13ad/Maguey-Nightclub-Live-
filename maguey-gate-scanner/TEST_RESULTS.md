# Request Signing Test Results

## ✅ Implementation Complete

All components have been implemented:
- ✅ `request-signing.ts` utility
- ✅ Enhanced `ticket-webhook/index.ts` with timestamp validation and replay protection
- ✅ Database migration for `webhook_events` table
- ✅ Security monitoring service
- ✅ Test script (`test-webhook-signing.sh`)

## 📝 Corrected Test Commands

**Important:** The webhook uses these header names:
- `X-Webhook-Signature` (not `X-Signature`)
- `X-Webhook-Timestamp` (not `X-Timestamp`)

### Test 1: Valid Request

```bash
TIMESTAMP=$(date +%s)
BODY='{"tickets":[{"ticket_id":"TEST-001","event_name":"Test Event","ticket_type":"General Admission"}]}'
SECRET="your-webhook-secret"

# Create signature: HMAC-SHA256(timestamp + "." + body)
MESSAGE="${TIMESTAMP}.${BODY}"
SIGNATURE=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)
SIGNATURE="sha256=${SIGNATURE}"

curl -X POST https://your-project.supabase.co/functions/v1/ticket-webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -d "$BODY"

# Expected: HTTP 201 (Success)
```

### Test 2: Expired Timestamp

```bash
OLD_TIMESTAMP=$(($(date +%s) - 600))  # 10 minutes ago
BODY='{"tickets":[{"ticket_id":"TEST-002","event_name":"Test Event","ticket_type":"General Admission"}]}'
SECRET="your-webhook-secret"

MESSAGE="${OLD_TIMESTAMP}.${BODY}"
SIGNATURE=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)
SIGNATURE="sha256=${SIGNATURE}"

curl -X POST https://your-project.supabase.co/functions/v1/ticket-webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $OLD_TIMESTAMP" \
  -d "$BODY"

# Expected: HTTP 401 with error "TIMESTAMP_EXPIRED"
```

### Test 3: Replay Attack

```bash
TIMESTAMP=$(date +%s)
BODY='{"tickets":[{"ticket_id":"TEST-003","event_name":"Test Event","ticket_type":"General Admission"}]}'
SECRET="your-webhook-secret"

MESSAGE="${TIMESTAMP}.${BODY}"
SIGNATURE=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)
SIGNATURE="sha256=${SIGNATURE}"

# First request (should succeed)
curl -X POST https://your-project.supabase.co/functions/v1/ticket-webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -d "$BODY"

# Wait a moment
sleep 1

# Same request again (should fail with replay detection)
curl -X POST https://your-project.supabase.co/functions/v1/ticket-webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -d "$BODY"

# Expected: HTTP 409 with error "REPLAY_DETECTED"
```

## 🚀 Quick Test Script

Use the automated test script:

```bash
cd maguey-gate-scanner
./test-webhook-signing.sh \
  "https://your-project.supabase.co/functions/v1/ticket-webhook" \
  "your-webhook-secret"
```

## 📊 Expected Results

| Test Scenario | HTTP Status | Error Code |
|--------------|-------------|------------|
| Valid Request | 201 | None |
| Expired Timestamp | 401 | `TIMESTAMP_EXPIRED` |
| Future Timestamp | 401 | `TIMESTAMP_FUTURE` |
| Invalid Signature | 401 | `INVALID_SIGNATURE` |
| Replay Attack | 409 | `REPLAY_DETECTED` |
| Missing Headers | 400/401 | `MISSING_HEADERS` |

## 🔍 Verification Checklist

After running tests, verify:

1. ✅ Valid requests are accepted
2. ✅ Expired timestamps are rejected
3. ✅ Replay attacks are detected
4. ✅ Invalid signatures are rejected
5. ✅ Security events are logged in `security_event_logs` table
6. ✅ Signatures are recorded in `webhook_events` table
7. ✅ Security alerts are created after 5+ events from same IP

## 📚 Documentation

See `WEBHOOK_TESTING_GUIDE.md` for detailed testing instructions.
