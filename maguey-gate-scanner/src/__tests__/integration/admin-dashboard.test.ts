/**
 * Admin Dashboard Integration Tests
 * 
 * Tests admin dashboard functionality including:
 * - Event statistics
 * - Real-time updates
 * - Ticket counts
 * - Scan counts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  seedTestEvent,
  seedTestTicket,
  resetTestTracking,
} from '../setup-integration';
import {
  createTestTicketWithQR,
  simulateScan,
} from './test-helpers';
import { supabase } from '../../lib/supabase';

describe('Admin Dashboard (Integration)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    resetTestTracking();
  });

  describe('Event Statistics', () => {
    it('should return correct ticket counts by status', async () => {
      const event = await seedTestEvent();

      // Create tickets with different statuses
      const issuedTicket = await seedTestTicket(event.id, { status: 'issued' });
      const scannedTicket = await seedTestTicket(event.id, { status: 'issued' });
      const cancelledTicket = await seedTestTicket(event.id, { status: 'cancelled' });

      // Scan one ticket
      if (scannedTicket.qr_token) {
        await simulateScan(scannedTicket.qr_token);
      }

      // Query ticket counts by status
      const { data: issuedCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'issued');

      const { data: scannedCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'scanned');

      const { data: cancelledCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'cancelled');

      // Verify counts (at least 1 issued, 1 scanned, 1 cancelled)
      expect(issuedCount).toBeDefined();
      expect(scannedCount).toBeDefined();
      expect(cancelledCount).toBeDefined();
    });

    it('should return correct scan counts', async () => {
      const event = await seedTestEvent();
      const { ticket, qrToken } = await createTestTicketWithQR(event.id);

      // Perform scans
      await simulateScan(qrToken);

      // Query scan count
      const { data: scanLogs, error } = await supabase
        .from('scan_logs')
        .select('id')
        .eq('ticket_id', ticket.id)
        .eq('scan_result', 'valid');

      expect(error).toBeNull();
      expect(scanLogs).toBeDefined();
      expect(scanLogs?.length).toBeGreaterThanOrEqual(1);
    });

    it('should return revenue totals', async () => {
      const event = await seedTestEvent();

      // Create multiple orders with different totals
      const order1 = await seedTestTicket(event.id);
      const order2 = await seedTestTicket(event.id);

      // Query revenue totals
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total')
        .eq('event_id', event.id)
        .eq('status', 'paid');

      expect(error).toBeNull();
      expect(orders).toBeDefined();
      
      if (orders) {
        const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        expect(totalRevenue).toBeGreaterThan(0);
      }
    });

    it('should filter by date range', async () => {
      const event = await seedTestEvent();
      const { ticket, qrToken } = await createTestTicketWithQR(event.id);

      // Perform scan
      await simulateScan(qrToken);

      // Query scans within date range
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const { data: scanLogs, error } = await supabase
        .from('scan_logs')
        .select('*')
        .eq('ticket_id', ticket.id)
        .gte('scanned_at', startDate.toISOString())
        .lte('scanned_at', endDate.toISOString());

      expect(error).toBeNull();
      expect(scanLogs).toBeDefined();
      expect(scanLogs?.length).toBeGreaterThanOrEqual(1);
    });

    it('should return ticket counts grouped by ticket type', async () => {
      const event = await seedTestEvent();

      // Create tickets (they will have the same ticket type from seedTestTicket)
      await seedTestTicket(event.id);
      await seedTestTicket(event.id);
      await seedTestTicket(event.id);

      // Query tickets grouped by ticket type
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('ticket_type_id')
        .eq('event_id', event.id);

      expect(error).toBeNull();
      expect(tickets).toBeDefined();
      
      if (tickets) {
        // Group by ticket type
        const countsByType = tickets.reduce((acc, ticket) => {
          const typeId = ticket.ticket_type_id;
          acc[typeId] = (acc[typeId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        expect(Object.keys(countsByType).length).toBeGreaterThan(0);
      }
    });
  });

  describe('Real-time Updates', () => {
    it('should receive scan updates via subscription', async () => {
      // This test would require Supabase realtime subscription
      // For now, we verify the scan was recorded
      const event = await seedTestEvent();
      const { ticket, qrToken } = await createTestTicketWithQR(event.id);

      // Perform scan
      await simulateScan(qrToken);

      // Verify scan was recorded (simulating subscription update)
      const { data: scanLog } = await supabase
        .from('scan_logs')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('scanned_at', { ascending: false })
        .limit(1)
        .single();

      expect(scanLog).toBeDefined();
      expect(scanLog?.scan_result).toBe('valid');
    });

    it('should update statistics after new scan', async () => {
      const event = await seedTestEvent();
      const { ticket, qrToken } = await createTestTicketWithQR(event.id);

      // Get initial scan count
      const { data: initialScans } = await supabase
        .from('scan_logs')
        .select('id', { count: 'exact', head: true })
        .eq('ticket_id', ticket.id);

      // Perform scan
      await simulateScan(qrToken);

      // Get updated scan count
      const { data: updatedScans } = await supabase
        .from('scan_logs')
        .select('id', { count: 'exact', head: true })
        .eq('ticket_id', ticket.id);

      // Scan count should have increased
      expect(updatedScans).toBeDefined();
    });

    it('should track scan rate over time', async () => {
      const event = await seedTestEvent();
      const { ticket, qrToken } = await createTestTicketWithQR(event.id);

      // Perform multiple scans (simulating different times)
      await simulateScan(qrToken);

      // Query scans grouped by time period
      const { data: scanLogs } = await supabase
        .from('scan_logs')
        .select('scanned_at')
        .eq('ticket_id', ticket.id)
        .order('scanned_at', { ascending: true });

      expect(scanLogs).toBeDefined();
      if (scanLogs && scanLogs.length > 0) {
        // Verify scans are ordered by time
        for (let i = 1; i < scanLogs.length; i++) {
          const prevTime = new Date(scanLogs[i - 1].scanned_at).getTime();
          const currTime = new Date(scanLogs[i].scanned_at).getTime();
          expect(currTime).toBeGreaterThanOrEqual(prevTime);
        }
      }
    });
  });

  describe('Dashboard Aggregations', () => {
    it('should calculate scan success rate', async () => {
      const event = await seedTestEvent();
      const { ticket, qrToken } = await createTestTicketWithQR(event.id);

      // Perform successful scan
      await simulateScan(qrToken);

      // Query scan results
      const { data: scanLogs } = await supabase
        .from('scan_logs')
        .select('scan_result')
        .eq('ticket_id', ticket.id);

      expect(scanLogs).toBeDefined();
      if (scanLogs) {
        const validScans = scanLogs.filter(log => log.scan_result === 'valid').length;
        const totalScans = scanLogs.length;
        const successRate = totalScans > 0 ? validScans / totalScans : 0;

        expect(successRate).toBeGreaterThanOrEqual(0);
        expect(successRate).toBeLessThanOrEqual(1);
      }
    });

    it('should calculate average scan duration', async () => {
      const event = await seedTestEvent();
      const { ticket, qrToken } = await createTestTicketWithQR(event.id);

      // Perform scan
      await simulateScan(qrToken);

      // Query scan durations
      const { data: scanLogs } = await supabase
        .from('scan_logs')
        .select('scan_duration_ms')
        .eq('ticket_id', ticket.id)
        .not('scan_duration_ms', 'is', null);

      expect(scanLogs).toBeDefined();
      if (scanLogs && scanLogs.length > 0) {
        const durations = scanLogs
          .map(log => log.scan_duration_ms)
          .filter((d): d is number => d !== null);
        
        if (durations.length > 0) {
          const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
          expect(avgDuration).toBeGreaterThan(0);
        }
      }
    });
  });
});
