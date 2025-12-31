# Load Testing with k6

Load testing infrastructure for Maguey Pass Lounge ticketing system.

## Prerequisites

1. Install k6:
   ```bash
   # macOS
   brew install k6
   
   # Linux
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   
   # Windows
   choco install k6
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Environment Setup

Set environment variables before running tests:

```bash
export ENVIRONMENT=local  # or staging, production
export VITE_SUPABASE_URL=https://your-project.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key
```

Or create a `.env` file:
```
ENVIRONMENT=local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Test Types

### Smoke Test
Quick verification that the system works under minimal load:
```bash
npm run test:smoke
```
- 2 virtual users for 1 minute
- All requests should succeed
- Baseline performance check

### Load Test
Simulates expected traffic during ticket sales:
```bash
npm run test:load
```
- Ramp up to 100 concurrent users
- 5 minute duration
- Realistic user flow simulation

### Stress Test
Finds system breaking point:
```bash
npm run test:stress
```
- Gradually increases load from 100 to 500 users
- Identifies maximum capacity
- May see some failures at peak

### Spike Test
Simulates sudden traffic surge (viral announcement):
```bash
npm run test:spike
```
- Normal traffic → sudden spike to 500 users → recovery
- Tests system resilience to sudden load

### Soak Test
Verifies system stability over extended period:
```bash
npm run test:soak
```
- 30+ minutes of steady load
- Checks for memory leaks, connection pool exhaustion

### Order Creation Test
Focuses specifically on checkout flow:
```bash
npm run test:order-creation
```
- Tests order creation under load
- Validates inventory race condition handling
- Custom metrics for order success/failure

## Test Scenarios

### Nightclub Context
- **Venue Capacity**: 800 tickets per event
- **Event Frequency**: ~3 events per week
- **Peak Traffic**: Ticket sale announcements, last-minute purchases
- **User Behavior**: 
  - Browse events → Select event → Check availability → Add to cart → Checkout
  - Multiple ticket types (GA, VIP, etc.)
  - Promo code usage
  - Concurrent purchases causing inventory contention

## Running Tests

### Local Development
```bash
# Make sure your local server is running
npm run dev

# Run smoke test
npm run test:smoke

# Run load test
npm run test:load
```

### Staging/Production
```bash
# Set environment
export ENVIRONMENT=staging

# Run tests
npm run test:load
```

## Interpreting Results

### Key Metrics

- **http_req_duration**: Request latency (p95, p99)
- **http_req_failed**: Error rate (should be < 1-5%)
- **orders_created**: Number of successful orders
- **inventory_errors**: Race condition detection

### Thresholds

- **p95 < 1000ms**: 95% of requests complete in under 1 second
- **p99 < 2000ms**: 99% of requests complete in under 2 seconds
- **Error rate < 1%**: Less than 1% of requests fail
- **Order creation < 3s**: Checkout should complete quickly

### Common Issues

1. **High latency**: Database queries not optimized, missing indexes
2. **High error rate**: Rate limiting, inventory exhaustion, database connection pool
3. **Memory leaks**: Connection pools not closing, event listeners not cleaned up
4. **Race conditions**: Concurrent purchases causing overselling

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/load-test.yml
- name: Run Load Tests
  run: |
    cd load-tests
    npm install
    npm run test:smoke
```

## Best Practices

1. **Start Small**: Always run smoke test first
2. **Gradual Increase**: Use stages to ramp up load gradually
3. **Monitor Resources**: Watch database CPU, memory, connection pools
4. **Test Realistic Scenarios**: Match actual user behavior
5. **Test During Off-Peak**: Don't load test production during business hours
6. **Document Baselines**: Record performance metrics for comparison

## Troubleshooting

### Tests fail immediately
- Check database connection
- Verify environment variables
- Ensure test data exists

### High error rates
- Check rate limiting settings
- Verify database connection pool size
- Check for RLS policy issues

### Timeouts
- Increase timeout thresholds
- Check network latency
- Verify database query performance
