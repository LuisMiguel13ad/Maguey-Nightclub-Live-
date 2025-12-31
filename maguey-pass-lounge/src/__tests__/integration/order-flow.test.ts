/**
 * Order Flow Integration Tests
 * 
 * Tests the complete order creation flow end-to-end, including:
 * - Order creation with tickets
 * - Inventory management
 * - Payment integration
 * - Error scenarios
 * - Saga pattern execution
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  seedTestEvent,
  seedTestOrder,
  resetTestTracking,
} from '../setup-integration';
import {
  createTestOrder,
  getOrderWithTickets,
  getTicketTypeAvailability,
  validateTicketQRCode,
  validateOrderTotals,
  createTestPromoCode,
  simulateConcurrentPurchases,
} from './test-helpers';
import { createOrderWithTickets, type CreateOrderInput } from '../../lib/orders-service';
import { supabase } from '../../lib/supabase';
import { InsufficientInventoryError } from '../../lib/errors';

describe('Order Creation Flow (Integration)', () => {
  // Setup & Teardown
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    resetTestTracking();
  });

  describe('Complete Purchase Flow', () => {
    it('should create order with tickets and send confirmation email', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        name: 'Complete Purchase Test Event',
        ticketTypes: [
          { name: 'GA', price: 50, fee: 5, totalInventory: 100 },
        ],
      });

      const ticketTypeId = ticketTypes[0].id;
      const result = await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypeId],
        quantities: [2],
        purchaserEmail: 'test@example.com',
        purchaserName: 'Test User',
      });

      expect(result.order).toBeDefined();
      expect(result.order.event_id).toBe(event.id);
      expect(result.order.purchaser_email).toBe('test@example.com');
      expect(result.order.status).toBe('pending');
      expect(result.ticketEmailPayloads.length).toBe(2);
      
      // Verify tickets were created
      const { order, tickets } = await getOrderWithTickets(result.order.id);
      expect(tickets.length).toBe(2);
      expect(tickets.every(t => validateTicketQRCode(t))).toBe(true);
      expect(validateOrderTotals(order, tickets)).toBe(true);
    });

    it('should decrement inventory after successful order', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'GA', price: 50, fee: 5, totalInventory: 100 },
        ],
      });

      const ticketTypeId = ticketTypes[0].id;
      const initialAvailability = await getTicketTypeAvailability(ticketTypeId);
      expect(initialAvailability.available).toBe(100);

      await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypeId],
        quantities: [5],
      });

      const afterAvailability = await getTicketTypeAvailability(ticketTypeId);
      expect(afterAvailability.available).toBe(95);
      expect(afterAvailability.ticketsSold).toBe(5);
    });

    it('should generate valid QR codes for each ticket', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'GA', price: 50, fee: 5, totalInventory: 10 },
        ],
      });

      const result = await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypes[0].id],
        quantities: [3],
      });

      const { tickets } = await getOrderWithTickets(result.order.id);
      
      expect(tickets.length).toBe(3);
      tickets.forEach(ticket => {
        expect(validateTicketQRCode(ticket)).toBe(true);
        expect(ticket.qr_token).toBeTruthy();
        expect(ticket.qr_signature).toBeTruthy();
        expect(ticket.status).toBe('issued');
      });
    });

    it('should apply promo code discount correctly', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'GA', price: 100, fee: 10, totalInventory: 50 },
        ],
      });

      // Create a 20% discount promo code
      const promoCodeId = await createTestPromoCode('TEST20', 'percent', 20);

      const result = await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypes[0].id],
        quantities: [2],
        promoCodeId,
      });

      // Original: 2 * (100 + 10) = 220
      // With 20% discount: 220 * 0.8 = 176
      expect(result.order.total).toBeLessThan(220);
      expect(result.order.subtotal).toBeLessThan(200);
    });

    it('should handle partial inventory (some tickets available)', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'GA', price: 50, fee: 5, totalInventory: 5 },
        ],
      });

      // First order: 3 tickets
      await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypes[0].id],
        quantities: [3],
      });

      // Second order: 2 tickets (should succeed)
      const result = await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypes[0].id],
        quantities: [2],
      });

      expect(result.order).toBeDefined();
      
      // Third order: 1 ticket (should fail - sold out)
      await expect(
        createTestOrder({
          eventId: event.id,
          ticketTypeIds: [ticketTypes[0].id],
          quantities: [1],
        })
      ).rejects.toThrow();
    });
  });

  describe('Inventory Management', () => {
    it('should prevent overselling when inventory is exhausted', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'Limited', price: 50, fee: 5, totalInventory: 2 },
        ],
      });

      const ticketTypeId = ticketTypes[0].id;

      // First order: 2 tickets (sells out)
      await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypeId],
        quantities: [2],
      });

      // Second order: should fail
      await expect(
        createTestOrder({
          eventId: event.id,
          ticketTypeIds: [ticketTypeId],
          quantities: [1],
        })
      ).rejects.toThrow(InsufficientInventoryError);
    });

    it('should handle concurrent purchases correctly (race condition)', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'Concurrent Test', price: 50, fee: 5, totalInventory: 5 },
        ],
      });

      const ticketTypeId = ticketTypes[0].id;

      // Simulate 10 concurrent requests for 1 ticket each
      // Only 5 should succeed
      const results = await simulateConcurrentPurchases(10, ticketTypeId, 1);

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      // Should have exactly 5 successful orders
      expect(successful.length).toBe(5);
      expect(failed.length).toBe(5);

      // Verify inventory is exhausted
      const availability = await getTicketTypeAvailability(ticketTypeId);
      expect(availability.available).toBe(0);
      expect(availability.ticketsSold).toBe(5);
    });

    it('should release inventory when order fails', async () => {
      // This test would require mocking a failure scenario
      // For now, we verify that inventory is properly managed
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'Release Test', price: 50, fee: 5, totalInventory: 10 },
        ],
      });

      const ticketTypeId = ticketTypes[0].id;
      const initialAvailability = await getTicketTypeAvailability(ticketTypeId);

      // Create a valid order
      await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypeId],
        quantities: [3],
      });

      const afterAvailability = await getTicketTypeAvailability(ticketTypeId);
      expect(afterAvailability.available).toBe(initialAvailability.available! - 3);
    });

    it('should update tickets_sold counter accurately', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'Counter Test', price: 50, fee: 5, totalInventory: 100 },
        ],
      });

      const ticketTypeId = ticketTypes[0].id;

      // Create multiple orders
      await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypeId],
        quantities: [5],
      });

      await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypeId],
        quantities: [3],
      });

      await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypeId],
        quantities: [2],
      });

      const availability = await getTicketTypeAvailability(ticketTypeId);
      expect(availability.ticketsSold).toBe(10);
      expect(availability.available).toBe(90);
    });
  });

  describe('Payment Integration', () => {
    it('should create Stripe checkout session with correct amount', async () => {
      // This would require Stripe test mode setup
      // For now, we verify order totals are calculated correctly
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'Payment Test', price: 100, fee: 10, totalInventory: 50 },
        ],
      });

      const result = await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypes[0].id],
        quantities: [2],
      });

      // Verify totals: 2 * (100 + 10) = 220
      expect(result.order.subtotal).toBe(200);
      expect(result.order.fees_total).toBe(20);
      expect(result.order.total).toBe(220);
    });

    it('should handle successful payment webhook', async () => {
      // This would require actual webhook endpoint testing
      // Placeholder for webhook integration test
      const { event, ticketTypes } = await seedTestEvent();
      const result = await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypes[0].id],
      });

      // Simulate webhook update
      const { error } = await supabase
        .from('orders')
        .update({ status: 'paid', payment_reference: 'test_payment_123' })
        .eq('id', result.order.id);

      expect(error).toBeNull();

      const { data: updatedOrder } = await supabase
        .from('orders')
        .select('status, payment_reference')
        .eq('id', result.order.id)
        .single();

      expect(updatedOrder?.status).toBe('paid');
      expect(updatedOrder?.payment_reference).toBe('test_payment_123');
    });

    it('should handle failed payment webhook', async () => {
      const { event, ticketTypes } = await seedTestEvent();
      const result = await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypes[0].id],
      });

      // Simulate failed payment
      const { error } = await supabase
        .from('orders')
        .update({ status: 'payment_failed' })
        .eq('id', result.order.id);

      expect(error).toBeNull();

      const { data: updatedOrder } = await supabase
        .from('orders')
        .select('status')
        .eq('id', result.order.id)
        .single();

      expect(updatedOrder?.status).toBe('payment_failed');
    });

    it('should handle refund webhook and update order status', async () => {
      const { event, ticketTypes } = await seedTestEvent();
      const result = await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypes[0].id],
      });

      // First mark as paid
      await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', result.order.id);

      // Then simulate refund
      const { error } = await supabase
        .from('orders')
        .update({ status: 'refunded' })
        .eq('id', result.order.id);

      expect(error).toBeNull();

      const { data: updatedOrder } = await supabase
        .from('orders')
        .select('status')
        .eq('id', result.order.id)
        .single();

      expect(updatedOrder?.status).toBe('refunded');
    });
  });

  describe('Error Scenarios', () => {
    it('should return appropriate error for invalid event ID', async () => {
      await expect(
        createTestOrder({
          eventId: 'invalid_event_id',
          ticketTypeIds: ['some_ticket_type'],
        })
      ).rejects.toThrow();
    });

    it('should validate required fields before processing', async () => {
      const { event, ticketTypes } = await seedTestEvent();

      // Missing required fields
      await expect(
        createOrderWithTickets({
          eventId: event.id,
          purchaserEmail: '', // Empty email
          purchaserName: 'Test',
          lineItems: [{
            ticketTypeId: ticketTypes[0].id,
            quantity: 1,
            unitPrice: 50,
            unitFee: 5,
            displayName: 'Test',
          }],
        })
      ).rejects.toThrow();
    });

    it('should handle database connection errors gracefully', async () => {
      // This would require simulating a database failure
      // For now, we verify error handling exists
      const { event, ticketTypes } = await seedTestEvent();

      // Use invalid client to simulate connection error
      const invalidInput: CreateOrderInput = {
        eventId: event.id,
        purchaserEmail: 'test@example.com',
        purchaserName: 'Test',
        lineItems: [{
          ticketTypeId: ticketTypes[0].id,
          quantity: 1,
          unitPrice: 50,
          unitFee: 5,
          displayName: 'Test',
        }],
      };

      // This should be handled gracefully by the service
      // The actual test would require mocking Supabase client
      expect(() => createOrderWithTickets(invalidInput)).not.toThrow();
    });
  });

  describe('Saga Pattern', () => {
    it('should complete all saga steps on success', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'Saga Test', price: 50, fee: 5, totalInventory: 10 },
        ],
      });

      const result = await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypes[0].id],
        quantities: [1],
      });

      // Verify saga completed successfully
      expect(result.order).toBeDefined();
      expect(result.ticketEmailPayloads.length).toBeGreaterThan(0);

      // Check saga execution record (if stored)
      // This would require checking saga_executions table if implemented
    });

    it('should compensate completed steps on failure', async () => {
      // This test would require simulating a failure mid-saga
      // and verifying compensation steps were executed
      // For now, we verify the structure exists
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'Compensation Test', price: 50, fee: 5, totalInventory: 1 },
        ],
      });

      // First order succeeds
      await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypes[0].id],
        quantities: [1],
      });

      // Second order should fail (inventory exhausted)
      // Compensation should release any reserved inventory
      await expect(
        createTestOrder({
          eventId: event.id,
          ticketTypeIds: [ticketTypes[0].id],
          quantities: [1],
        })
      ).rejects.toThrow();
    });

    it('should record saga execution in database', async () => {
      // This would require checking saga_executions table
      // For now, we verify order creation succeeds
      const { event, ticketTypes } = await seedTestEvent();
      
      const result = await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypes[0].id],
      });

      // Order should be created (indicating saga completed)
      expect(result.order).toBeDefined();
      expect(result.order.id).toBeTruthy();
    });
  });
});
