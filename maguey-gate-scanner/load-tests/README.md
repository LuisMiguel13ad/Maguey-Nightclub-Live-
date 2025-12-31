# Load Testing for Maguey Gate Scanner

Load testing infrastructure for the ticket scanning system to ensure it handles event entry rushes.

## Prerequisites

1. Install k6:
   ```bash
   # macOS
   brew install k6
   
   # Or download from https://k6.io/docs/getting-started/installation/
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Environment Setup

Set environment variables before running tests:

```bash
export ENVIRONMENT=local
export VITE_SUPABASE_URL=https://your-project.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key
export VITE_QR_SIGNING_SECRET=your-qr-signing-secret
export VITE_WEBHOOK_SECRET=your-webhook-secret
```

## Test Types

### Event Entry Scanning Test
Simulates 800 people entering over 1 hour with peak rush:
```bash
npm run test:scanning
```
- **Peak**: 200 scans in first 15 minutes (rush hour)
- **Total**: ~800 scans over 1 hour
- **Stages**: Early arrivals → Peak rush → Stragglers → Late arrivals

### Concurrent Scan Test
Tests race condition protection:
```bash
npm run test:concurrent
```
- 10 virtual users try to scan the same ticket simultaneously
- Only 1 should succeed, 9 should get "already scanned"
- Verifies database locking and race condition protection

### Webhook Load Test
Tests webhook endpoint under load:
```bash
npm run test:webhook
```
- Simulates batch ticket creation webhooks from pass-lounge
- 20-50 webhooks/second
- Tests signature verification and processing speed

### Real-time Dashboard Test
Tests WebSocket connections for real-time updates:
```bash
npm run test:realtime
```
- 20 admin dashboards open simultaneously
- Subscribes to scan_logs and tickets table changes
- 10 minute duration to test connection stability

## Test Scenarios

### Event Entry Context
- **Venue Capacity**: 800 tickets per event
- **Entry Pattern**: 
  - Early arrivals: 5 scans/sec (first 5 minutes)
  - Peak rush: 15 scans/sec (next 10 minutes) - **200 people rush**
  - Stragglers: 3 scans/sec (next 15 minutes)
  - Late arrivals: 1 scan/sec (last 5 minutes)
- **Total**: ~800 scans over 35 minutes
- **Peak Load**: 15 scans/second sustained for 10 minutes

### Scanner Behavior
- Multiple scanners at entry (scanner_1 through scanner_5)
- QR code validation with signature verification
- Real-time status updates
- Duplicate scan prevention

## Running Tests

### Local Development
```bash
# Make sure your local server is running
npm run dev

# Run event entry test
npm run test:scanning

# Run concurrent scan test
npm run test:concurrent
```

### Staging/Production
```bash
# Set environment
export ENVIRONMENT=staging

# Run tests
npm run test:scanning
```

## Interpreting Results

### Key Metrics

- **scan_duration**: Scan latency (p95, p99)
- **scans_successful**: Number of successful scans
- **scans_failed**: Number of failed scans
- **scans_already_scanned**: Duplicate scan rejections
- **http_req_failed**: Error rate (should be < 1%)

### Thresholds

- **p95 < 500ms**: 95% of scans complete in under 500ms
- **p99 < 1000ms**: 99% of scans complete in under 1 second
- **Error rate < 1%**: Less than 1% of scans fail
- **Success rate > 90%**: At least 90% of scans succeed

### Common Issues

1. **High latency**: Database queries not optimized, missing indexes on tickets table
2. **High error rate**: Rate limiting, database connection pool exhaustion
3. **Race conditions**: Concurrent scans not properly handled (should see "already scanned" errors)
4. **WebSocket disconnections**: Connection pool issues, timeout settings

## Test Data Requirements

Before running tests, ensure:

1. **Test tickets exist**: At least 800 tickets with status 'issued' in database
2. **Valid QR codes**: Tickets must have valid qr_token and qr_signature
3. **Test event**: At least one published event with tickets
4. **Database access**: Proper RLS policies or service role key

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/load-test-scanner.yml
- name: Run Scanner Load Tests
  run: |
    cd load-tests
    npm install
    npm run test:concurrent  # Quick test
```

## Best Practices

1. **Start Small**: Run concurrent test first (quickest)
2. **Monitor Database**: Watch connection pools, query performance
3. **Test Realistic Scenarios**: Match actual event entry patterns
4. **Test During Off-Peak**: Don't load test production during events
5. **Document Baselines**: Record performance metrics for comparison

## Troubleshooting

### No test tickets available
- Create test tickets in database with status 'issued'
- Ensure tickets have valid qr_token and qr_signature

### High error rates
- Check rate limiting settings
- Verify database connection pool size
- Check for RLS policy issues

### WebSocket connection failures
- Verify Supabase Realtime is enabled
- Check WebSocket URL format
- Verify API key has realtime permissions

### Race condition test fails
- Verify database has proper locking (SELECT FOR UPDATE)
- Check transaction isolation levels
- Ensure atomic scan operations
