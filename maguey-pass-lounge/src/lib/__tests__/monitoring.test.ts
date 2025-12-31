/**
 * Monitoring System Tests
 * 
 * Tests for the metrics collection and tracking functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  metrics, 
  trackOrderCreation, 
  trackTicketScan,
  trackDbQuery,
  trackPayment,
  trackEmailSent,
  startTimer,
  getDashboardMetrics,
  calculateErrorRate,
  calculateScanSuccessRate,
} from '../monitoring';

describe('Metrics Registry', () => {
  beforeEach(() => {
    // Reset all metrics before each test
    metrics.reset();
  });

  describe('increment()', () => {
    it('should increment a counter by 1 by default', () => {
      metrics.increment('test.counter');
      expect(metrics.getCounter('test.counter')).toBe(1);
    });

    it('should increment a counter by a specified value', () => {
      metrics.increment('test.counter', 5);
      expect(metrics.getCounter('test.counter')).toBe(5);
    });

    it('should accumulate multiple increments', () => {
      metrics.increment('test.counter', 3);
      metrics.increment('test.counter', 7);
      expect(metrics.getCounter('test.counter')).toBe(10);
    });

    it('should track counters with tags separately', () => {
      metrics.increment('orders', 1, { status: 'success' });
      metrics.increment('orders', 2, { status: 'failed' });
      metrics.increment('orders', 3, { status: 'success' });
      
      // Total should be sum of all
      expect(metrics.getCounter('orders')).toBe(6);
      
      // With specific tags
      expect(metrics.getCounter('orders', { status: 'success' })).toBe(4);
      expect(metrics.getCounter('orders', { status: 'failed' })).toBe(2);
    });

    it('should return 0 for non-existent counter', () => {
      expect(metrics.getCounter('nonexistent')).toBe(0);
    });
  });

  describe('timing()', () => {
    it('should record a timing value', () => {
      metrics.timing('test.duration', 100);
      const histogram = metrics.getHistogram('test.duration');
      
      expect(histogram).not.toBeNull();
      expect(histogram!.count).toBe(1);
      expect(histogram!.sum).toBe(100);
      expect(histogram!.min).toBe(100);
      expect(histogram!.max).toBe(100);
    });

    it('should track multiple timing values correctly', () => {
      metrics.timing('test.duration', 50);
      metrics.timing('test.duration', 100);
      metrics.timing('test.duration', 150);
      
      const histogram = metrics.getHistogram('test.duration');
      
      expect(histogram!.count).toBe(3);
      expect(histogram!.sum).toBe(300);
      expect(histogram!.min).toBe(50);
      expect(histogram!.max).toBe(150);
    });

    it('should calculate average correctly', () => {
      metrics.timing('test.duration', 100);
      metrics.timing('test.duration', 200);
      metrics.timing('test.duration', 300);
      
      expect(metrics.getAverageTiming('test.duration')).toBe(200);
    });

    it('should return 0 for non-existent histogram', () => {
      expect(metrics.getAverageTiming('nonexistent')).toBe(0);
    });

    it('should populate histogram buckets correctly', () => {
      // Add timings in different bucket ranges
      metrics.timing('test.duration', 5);    // <= 10ms bucket
      metrics.timing('test.duration', 15);   // <= 25ms bucket
      metrics.timing('test.duration', 75);   // <= 100ms bucket
      metrics.timing('test.duration', 500);  // <= 500ms bucket
      metrics.timing('test.duration', 3000); // <= 5000ms bucket
      
      const histogram = metrics.getHistogram('test.duration');
      
      expect(histogram!.count).toBe(5);
      expect(histogram!.buckets[10]).toBe(1);   // 5ms falls in 10ms bucket
      expect(histogram!.buckets[25]).toBe(2);   // 5ms and 15ms fall in 25ms bucket
      expect(histogram!.buckets[100]).toBe(3);  // 5ms, 15ms, 75ms fall in 100ms bucket
    });
  });

  describe('gauge()', () => {
    it('should set a gauge value', () => {
      metrics.gauge('active_users', 42);
      expect(metrics.getGauge('active_users')).toBe(42);
    });

    it('should overwrite previous gauge value', () => {
      metrics.gauge('active_users', 10);
      metrics.gauge('active_users', 50);
      expect(metrics.getGauge('active_users')).toBe(50);
    });

    it('should support tags on gauges', () => {
      metrics.gauge('queue.depth', 5, { queue: 'orders' });
      metrics.gauge('queue.depth', 10, { queue: 'emails' });
      
      expect(metrics.getGauge('queue.depth', { queue: 'orders' })).toBe(5);
      expect(metrics.getGauge('queue.depth', { queue: 'emails' })).toBe(10);
    });

    it('should return 0 for non-existent gauge', () => {
      expect(metrics.getGauge('nonexistent')).toBe(0);
    });
  });

  describe('getAll()', () => {
    it('should return empty object when no metrics', () => {
      const all = metrics.getAll();
      expect(Object.keys(all).length).toBe(0);
    });

    it('should return all counters, gauges, and histograms', () => {
      metrics.increment('orders.created', 5);
      metrics.gauge('active_users', 42);
      metrics.timing('order.duration', 100);
      metrics.timing('order.duration', 200);
      
      const all = metrics.getAll();
      
      // Check counter
      expect(all['counter.orders.created']).toBe(5);
      
      // Check gauge
      expect(all['gauge.active_users']).toBe(42);
      
      // Check histogram aggregates
      expect(all['histogram.order.duration.count']).toBe(2);
      expect(all['histogram.order.duration.sum']).toBe(300);
      expect(all['histogram.order.duration.avg']).toBe(150);
      expect(all['histogram.order.duration.min']).toBe(100);
      expect(all['histogram.order.duration.max']).toBe(200);
    });
  });

  describe('reset()', () => {
    it('should clear all metrics', () => {
      metrics.increment('counter', 10);
      metrics.gauge('gauge', 20);
      metrics.timing('timing', 30);
      
      metrics.reset();
      
      expect(metrics.getCounter('counter')).toBe(0);
      expect(metrics.getGauge('gauge')).toBe(0);
      expect(metrics.getHistogram('timing')).toBeNull();
      expect(Object.keys(metrics.getAll()).length).toBe(0);
    });
  });

  describe('toPrometheusFormat()', () => {
    it('should export metrics in Prometheus format', () => {
      metrics.increment('orders_created', 100);
      metrics.gauge('active_users', 50);
      
      const output = metrics.toPrometheusFormat();
      
      expect(output).toContain('# TYPE orders_created counter');
      expect(output).toContain('orders_created 100');
      expect(output).toContain('# TYPE active_users gauge');
      expect(output).toContain('active_users 50');
    });
  });
});

describe('trackOrderCreation()', () => {
  beforeEach(() => {
    metrics.reset();
  });

  it('should track successful order creation', () => {
    trackOrderCreation('order-123', 150, true, {
      eventId: 'event-456',
      ticketCount: 3,
      total: 75.00,
    });
    
    expect(metrics.getCounter('orders.created')).toBe(1);
    expect(metrics.getCounter('orders.failed')).toBe(0);
    expect(metrics.getCounter('tickets.sold')).toBe(3);
    expect(metrics.getCounter('revenue.cents')).toBe(7500);
    expect(metrics.getAverageTiming('order.creation.duration')).toBe(150);
  });

  it('should track failed order creation', () => {
    trackOrderCreation('order-123', 50, false, {
      eventId: 'event-456',
    });
    
    expect(metrics.getCounter('orders.created')).toBe(0);
    expect(metrics.getCounter('orders.failed')).toBe(1);
    expect(metrics.getCounter('tickets.sold')).toBe(0);
  });

  it('should accumulate multiple orders', () => {
    trackOrderCreation('order-1', 100, true, { ticketCount: 2, total: 50 });
    trackOrderCreation('order-2', 200, true, { ticketCount: 3, total: 75 });
    trackOrderCreation('order-3', 50, false);
    
    expect(metrics.getCounter('orders.created')).toBe(2);
    expect(metrics.getCounter('orders.failed')).toBe(1);
    expect(metrics.getCounter('tickets.sold')).toBe(5);
    expect(metrics.getCounter('revenue.cents')).toBe(12500); // $50 + $75 = $125 = 12500 cents
  });
});

describe('trackTicketScan()', () => {
  beforeEach(() => {
    metrics.reset();
  });

  it('should track valid ticket scan', () => {
    trackTicketScan('ticket-123', 25, 'valid', { eventId: 'event-1' });
    
    expect(metrics.getCounter('ticket.scans.valid')).toBe(1);
    expect(metrics.getCounter('ticket.scans.total')).toBe(1);
  });

  it('should track different scan results', () => {
    trackTicketScan('t1', 20, 'valid');
    trackTicketScan('t2', 15, 'valid');
    trackTicketScan('t3', 30, 'invalid');
    trackTicketScan('t4', 25, 'already_scanned');
    trackTicketScan('t5', 100, 'error');
    
    expect(metrics.getCounter('ticket.scans.valid')).toBe(2);
    expect(metrics.getCounter('ticket.scans.invalid')).toBe(1);
    expect(metrics.getCounter('ticket.scans.already_scanned')).toBe(1);
    expect(metrics.getCounter('ticket.scans.error')).toBe(1);
    expect(metrics.getCounter('ticket.scans.total')).toBe(5);
  });
});

describe('trackDbQuery()', () => {
  beforeEach(() => {
    metrics.reset();
  });

  it('should track successful database query', () => {
    trackDbQuery('select', 45, true, 'events');
    
    expect(metrics.getAverageTiming('db.query.duration')).toBe(45);
    expect(metrics.getCounter('db.query.errors')).toBe(0);
  });

  it('should track failed database query', () => {
    trackDbQuery('insert', 100, false, 'orders');
    
    expect(metrics.getCounter('db.query.errors')).toBe(1);
  });
});

describe('trackPayment()', () => {
  beforeEach(() => {
    metrics.reset();
  });

  it('should track successful payment', () => {
    trackPayment('order-123', 500, true, {
      provider: 'stripe',
      amount: 99.99,
      currency: 'USD',
    });
    
    expect(metrics.getCounter('payments.successful')).toBe(1);
    expect(metrics.getCounter('payments.failed')).toBe(0);
    expect(metrics.getCounter('payments.amount')).toBe(9999);
  });

  it('should track failed payment', () => {
    trackPayment('order-123', 200, false, { provider: 'stripe' });
    
    expect(metrics.getCounter('payments.successful')).toBe(0);
    expect(metrics.getCounter('payments.failed')).toBe(1);
  });
});

describe('trackEmailSent()', () => {
  beforeEach(() => {
    metrics.reset();
  });

  it('should track successful email', () => {
    trackEmailSent('ticket', true, 150);
    
    expect(metrics.getCounter('emails.sent')).toBe(1);
    expect(metrics.getCounter('emails.failed')).toBe(0);
  });

  it('should track failed email', () => {
    trackEmailSent('confirmation', false, 5000);
    
    expect(metrics.getCounter('emails.sent')).toBe(0);
    expect(metrics.getCounter('emails.failed')).toBe(1);
  });
});

describe('startTimer()', () => {
  it('should return elapsed time in milliseconds', async () => {
    const stop = startTimer();
    
    // Wait a small amount of time
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const elapsed = stop();
    
    // Should be at least 50ms (with some tolerance)
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(200); // Should not be too long
  });
});

describe('getDashboardMetrics()', () => {
  beforeEach(() => {
    metrics.reset();
  });

  it('should return all dashboard metrics', () => {
    trackOrderCreation('o1', 100, true, { ticketCount: 2, total: 50 });
    trackOrderCreation('o2', 200, false);
    trackTicketScan('t1', 20, 'valid');
    trackTicketScan('t2', 25, 'invalid');
    
    const dashboard = getDashboardMetrics();
    
    expect(dashboard.ordersCreated).toBe(1);
    expect(dashboard.ordersFailed).toBe(1);
    expect(dashboard.ticketsSold).toBe(2);
    expect(dashboard.revenueInCents).toBe(5000);
    expect(dashboard.ticketScansTotal).toBe(2);
  });
});

describe('calculateErrorRate()', () => {
  beforeEach(() => {
    metrics.reset();
  });

  it('should return 0 when no orders', () => {
    expect(calculateErrorRate()).toBe(0);
  });

  it('should calculate error rate correctly', () => {
    // 9 successful, 1 failed = 10% error rate
    for (let i = 0; i < 9; i++) {
      trackOrderCreation(`order-${i}`, 100, true);
    }
    trackOrderCreation('order-9', 100, false);
    
    expect(calculateErrorRate()).toBe(10);
  });

  it('should return 0 when all orders successful', () => {
    trackOrderCreation('o1', 100, true);
    trackOrderCreation('o2', 100, true);
    
    expect(calculateErrorRate()).toBe(0);
  });
});

describe('calculateScanSuccessRate()', () => {
  beforeEach(() => {
    metrics.reset();
  });

  it('should return 100 when no scans', () => {
    expect(calculateScanSuccessRate()).toBe(100);
  });

  it('should calculate success rate correctly', () => {
    // 8 valid, 2 invalid = 80% success rate
    for (let i = 0; i < 8; i++) {
      trackTicketScan(`t-${i}`, 20, 'valid');
    }
    trackTicketScan('t-8', 20, 'invalid');
    trackTicketScan('t-9', 20, 'already_scanned');
    
    expect(calculateScanSuccessRate()).toBe(80);
  });
});
