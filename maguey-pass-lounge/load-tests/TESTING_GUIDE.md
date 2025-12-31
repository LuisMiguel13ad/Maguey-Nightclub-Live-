# Load Testing Guide - Maguey Pass Lounge

Complete guide for running and interpreting load tests for the ticketing system.

## Table of Contents

1. [Installation](#installation)
2. [Test Types](#test-types)
3. [Running Tests](#running-tests)
4. [Interpreting Results](#interpreting-results)
5. [Thresholds](#thresholds)
6. [Troubleshooting](#troubleshooting)

---

## Installation

### Install k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```bash
choco install k6
```

**Verify Installation:**
```bash
k6 version
```

### Configure Environment

Create a `.env` file or export environment variables:

```bash
export ENVIRONMENT=local
export VITE_SUPABASE_URL=https://your-project.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key
export VITE_QR_SIGNING_SECRET=your-qr-secret
```

---

## Test Types

### 1. Smoke Test (`test:smoke`)

**Purpose:** Quick baseline verification that the system works under minimal load.

**Configuration:**
- **Users:** 2 virtual users
- **Duration:** 1 minute
- **Load Pattern:** Constant

**What it tests:**
- Event listing API
- Single event fetch
- Ticket type retrieval
- Availability checking

**Expected Results:**
- ✅ All requests succeed (0% error rate)
- ✅ 95% of requests complete in < 500ms
- ✅ No timeouts or connection errors

**When to run:**
- Before any other load tests
- After code changes to verify basic functionality
- As part of CI/CD pipeline

**Command:**
```bash
npm run test:smoke
```

---

### 2. Load Test (`test:load`)

**Purpose:** Simulates expected traffic during normal ticket sales.

**Configuration:**
- **Users:** Ramp from 50 → 100 → 0
- **Duration:** 5 minutes
- **Load Pattern:** Ramp up → Steady state → Ramp down

**What it tests:**
- Complete user journey (browse → select → checkout)
- Order creation under normal load
- Inventory management
- Realistic user behavior with delays

**Expected Results:**
- ✅ 95% of requests complete in < 1000ms
- ✅ 99% of requests complete in < 2000ms
- ✅ Error rate < 5%
- ✅ Order creation success rate > 90%
- ✅ Order creation p95 < 3000ms

**When to run:**
- Before major ticket sales
- After performance optimizations
- Weekly/monthly performance checks

**Command:**
```bash
npm run test:load
```

---

### 3. Stress Test (`test:stress`)

**Purpose:** Finds system breaking point by gradually increasing load.

**Configuration:**
- **Users:** Ramp from 100 → 200 → 300 → 400 → 500 → 0
- **Duration:** 12 minutes
- **Load Pattern:** Gradual increase to find limits

**What it tests:**
- Maximum system capacity
- Failure modes under extreme load
- Database connection pool limits
- Rate limiting effectiveness

**Expected Results:**
- ⚠️ May see some errors at peak (up to 10% acceptable)
- ⚠️ Response times may increase at peak
- ✅ System should recover after load decreases
- ✅ No crashes or complete failures

**When to run:**
- Before high-traffic events
- Capacity planning
- Infrastructure scaling decisions

**Command:**
```bash
npm run test:stress
```

---

### 4. Spike Test (`test:spike`)

**Purpose:** Simulates sudden traffic surge (e.g., viral announcement).

**Configuration:**
- **Users:** 10 → 500 → 10 (sudden spike)
- **Duration:** 3 minutes
- **Load Pattern:** Normal → SPIKE → Recovery

**What it tests:**
- System resilience to sudden load
- Auto-scaling effectiveness
- Graceful degradation
- Recovery after spike

**Expected Results:**
- ⚠️ Higher latency during spike (p95 < 3000ms acceptable)
- ⚠️ May see up to 15% errors during spike
- ✅ System should handle spike without crashing
- ✅ Should recover quickly after spike

**When to run:**
- Before major announcements
- Testing auto-scaling
- Validating circuit breakers

**Command:**
```bash
npm run test:spike
```

---

### 5. Soak Test (`test:soak`)

**Purpose:** Verifies system stability over extended period.

**Configuration:**
- **Users:** 50 constant users
- **Duration:** 34 minutes (2m ramp + 30m steady + 2m ramp down)
- **Load Pattern:** Extended steady state

**What it tests:**
- Memory leaks
- Connection pool exhaustion
- Resource leaks
- Long-term stability

**Expected Results:**
- ✅ Error rate remains low (< 2%) throughout
- ✅ Response times remain stable (no gradual increase)
- ✅ No memory leaks (monitor server metrics)
- ✅ Connection pools don't exhaust

**When to run:**
- Before long-running events
- After major changes
- Monthly stability checks

**Command:**
```bash
npm run test:soak
```

---

### 6. Order Creation Test (`test:order-creation`)

**Purpose:** Focuses specifically on checkout flow and inventory race conditions.

**Configuration:**
- **Rate:** 10 → 20 → 5 orders/second
- **Duration:** 4 minutes
- **Load Pattern:** Arrival rate executor

**What it tests:**
- Order creation performance
- Inventory race condition handling
- Concurrent purchase protection
- Checkout flow reliability

**Expected Results:**
- ✅ At least 100 orders created
- ✅ Order creation p95 < 5000ms
- ✅ Order creation p99 < 8000ms
- ✅ Checkout failure rate < 2%
- ✅ Inventory errors < 50 (graceful handling)

**When to run:**
- Before ticket sales
- After checkout flow changes
- Testing inventory management

**Command:**
```bash
npm run test:order-creation
```

---

## Running Tests

### Basic Usage

```bash
# Navigate to load-tests directory
cd load-tests

# Run a specific test
npm run test:smoke
npm run test:load
npm run test:stress
npm run test:spike
npm run test:soak
npm run test:order-creation

# Run all tests (smoke + load)
npm run test:all
```

### Environment-Specific Testing

```bash
# Local development
export ENVIRONMENT=local
npm run test:smoke

# Staging
export ENVIRONMENT=staging
npm run test:load

# Production (use with extreme caution!)
export ENVIRONMENT=production
npm run test:smoke  # Only smoke test in production
```

### Custom Configuration

You can override environment variables:

```bash
VITE_SUPABASE_URL=https://custom-url.supabase.co npm run test:load
```

---

## Interpreting Results

### Key Metrics

#### Request Metrics

- **http_req_duration**: Total request duration
  - `p(95)`: 95th percentile (95% of requests faster than this)
  - `p(99)`: 99th percentile (99% of requests faster than this)
  - **Good:** p95 < 1000ms, p99 < 2000ms
  - **Warning:** p95 > 2000ms, p99 > 5000ms

- **http_req_failed**: Failed request rate
  - **Good:** < 1%
  - **Warning:** 1-5%
  - **Critical:** > 5%

- **http_reqs**: Total requests
  - Shows total throughput

#### Custom Metrics

- **orders_created**: Number of successful orders
- **orders_failed**: Number of failed orders
- **order_creation_duration**: Time to create orders
- **inventory_errors**: Inventory exhaustion errors

### Sample Output

```
✓ http_req_duration..............: avg=234ms  min=45ms   med=180ms  max=1.2s   p(95)=580ms  p(99)=890ms
✓ http_req_failed................: 0.12%  ✓ 0.01%
✓ orders_created..................: 145    ✓ 100
✓ order_creation_duration.........: avg=1.2s  p(95)=2.8s  p(99)=4.1s
```

### Understanding Percentiles

- **p(50) / median**: Half of requests are faster, half are slower
- **p(95)**: 95% of requests complete in this time or faster
- **p(99)**: 99% of requests complete in this time or faster

**Example:**
- p(95) = 1000ms means 95% of requests complete in under 1 second
- p(99) = 2000ms means 99% of requests complete in under 2 seconds

---

## Thresholds

### Default Thresholds by Test Type

| Test Type | p95 Duration | p99 Duration | Error Rate | Success Rate |
|-----------|--------------|-------------|------------|--------------|
| **Smoke** | < 500ms | < 1000ms | < 1% | 100% |
| **Load** | < 1000ms | < 2000ms | < 5% | > 90% |
| **Stress** | < 5000ms | < 10000ms | < 10% | > 80% |
| **Spike** | < 3000ms | < 5000ms | < 15% | > 70% |
| **Soak** | < 2000ms | < 3000ms | < 2% | > 95% |
| **Order Creation** | < 5000ms | < 8000ms | < 2% | > 90% |

### Threshold Interpretation

**✅ Pass:** All thresholds met
**⚠️ Warning:** Some thresholds exceeded but system functional
**❌ Fail:** Critical thresholds exceeded, system may be unstable

---

## Troubleshooting

### Common Issues

#### 1. "No test tickets available"

**Problem:** Tests can't find test data in database.

**Solution:**
- Create test events with status 'published'
- Create test tickets with status 'issued'
- Ensure tickets have valid qr_token and qr_signature
- Check database connection and RLS policies

#### 2. High Error Rates

**Possible Causes:**
- Rate limiting triggered
- Database connection pool exhausted
- RLS policy blocking requests
- Invalid API credentials

**Solutions:**
- Check rate limiter settings
- Increase database connection pool
- Verify RLS policies allow test operations
- Use service role key for testing

#### 3. High Latency

**Possible Causes:**
- Database queries not optimized
- Missing indexes
- Network latency
- Server resource constraints

**Solutions:**
- Check database query performance
- Add missing indexes
- Test from same region as server
- Monitor server CPU/memory

#### 4. Order Creation Failures

**Possible Causes:**
- Inventory exhausted
- Race conditions
- Validation errors
- Payment processing issues

**Solutions:**
- Ensure sufficient test inventory
- Verify atomic order creation
- Check order validation logic
- Mock payment processing for tests

#### 5. Timeouts

**Possible Causes:**
- Slow database queries
- Network issues
- Server overload

**Solutions:**
- Increase timeout thresholds
- Optimize slow queries
- Check network connectivity
- Scale server resources

### Debugging Tips

1. **Start Small:** Always run smoke test first
2. **Monitor Resources:** Watch database CPU, memory, connections
3. **Check Logs:** Review application and database logs
4. **Gradual Increase:** Don't jump to stress test immediately
5. **Compare Baselines:** Track metrics over time

---

## Best Practices

### Before Running Tests

1. ✅ Verify test data exists in database
2. ✅ Configure environment variables
3. ✅ Ensure test database is separate from production
4. ✅ Notify team if testing production
5. ✅ Monitor database and server resources

### During Tests

1. 📊 Monitor database metrics (CPU, connections, queries)
2. 📊 Watch application logs for errors
3. 📊 Track server resource usage
4. 📊 Note any unusual patterns

### After Tests

1. 📝 Document results and thresholds
2. 📝 Compare with previous baselines
3. 📝 Identify bottlenecks and optimize
4. 📝 Update thresholds if needed
5. 📝 Share findings with team

### Test Frequency

- **Smoke Test:** Before every deployment
- **Load Test:** Weekly or before major sales
- **Stress Test:** Monthly or before high-traffic events
- **Spike Test:** Before major announcements
- **Soak Test:** Monthly stability check
- **Order Creation Test:** Before ticket sales

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run Smoke Test
        working-directory: ./load-tests
        env:
          ENVIRONMENT: staging
          VITE_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
        run: npm run test:smoke
```

---

## Performance Baselines

### Expected Performance (Baseline)

| Operation | p95 | p99 | Notes |
|-----------|-----|-----|-------|
| Event Listing | < 300ms | < 500ms | Cached responses |
| Event Detail | < 300ms | < 500ms | Single event fetch |
| Availability Check | < 300ms | < 500ms | Batch queries |
| Order Creation | < 3000ms | < 5000ms | Includes payment |

### Capacity Targets

- **Normal Load:** 100 concurrent users
- **Peak Load:** 500 concurrent users
- **Order Rate:** 20 orders/second sustained
- **Spike Capacity:** 50 orders/second for 1 minute

---

## Next Steps

1. **Establish Baselines:** Run tests and document baseline metrics
2. **Set Alerts:** Configure alerts for threshold violations
3. **Regular Testing:** Schedule regular load tests
4. **Optimize:** Use results to identify and fix bottlenecks
5. **Scale:** Plan infrastructure scaling based on test results

---

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Thresholds Guide](https://k6.io/docs/using-k6/thresholds/)
- [Performance Testing Best Practices](https://k6.io/docs/test-types/)

---

## Support

For issues or questions:
1. Check this guide first
2. Review test logs
3. Check database and server metrics
4. Consult with development team
