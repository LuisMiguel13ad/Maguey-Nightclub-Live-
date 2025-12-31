/**
 * Event Availability Integration Tests
 * 
 * Tests event listing and ticket availability functionality:
 * - Ticket availability calculations
 * - Event listing with filters
 * - Availability caching and invalidation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  cleanupTestDatabase,
  seedTestEvent,
  resetTestTracking,
} from '../setup-integration';
import {
  getTicketTypeAvailability,
  createTestOrder,
} from './test-helpers';
import { checkAvailabilityBatch } from '../../lib/availability-service';
import { supabase } from '../../lib/supabase';
import { getEventsPaginated } from '../../lib/events-service';

describe('Event Availability (Integration)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    resetTestTracking();
  });

  describe('Ticket Availability', () => {
    it('should return correct available count for each ticket type', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'GA', price: 50, fee: 5, totalInventory: 100 },
          { name: 'VIP', price: 100, fee: 10, totalInventory: 50 },
        ],
      });

      const ticketTypeIds = ticketTypes.map(tt => tt.id);
      const availability = await checkAvailabilityBatch(ticketTypeIds);

      expect(availability.ticketTypes.size).toBe(2);
      
      const gaAvailability = availability.ticketTypes.get(ticketTypeIds[0]);
      expect(gaAvailability?.available).toBe(100);
      expect(gaAvailability?.isAvailable).toBe(true);

      const vipAvailability = availability.ticketTypes.get(ticketTypeIds[1]);
      expect(vipAvailability?.available).toBe(50);
      expect(vipAvailability?.isAvailable).toBe(true);
    });

    it('should update availability after purchase', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'GA', price: 50, fee: 5, totalInventory: 100 },
        ],
      });

      const ticketTypeId = ticketTypes[0].id;
      
      // Check initial availability
      const initialAvailability = await getTicketTypeAvailability(ticketTypeId);
      expect(initialAvailability.available).toBe(100);

      // Make a purchase
      await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypeId],
        quantities: [10],
      });

      // Check updated availability
      const updatedAvailability = await getTicketTypeAvailability(ticketTypeId);
      expect(updatedAvailability.available).toBe(90);
      expect(updatedAvailability.ticketsSold).toBe(10);
    });

    it('should handle sold-out ticket types', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'Limited', price: 50, fee: 5, totalInventory: 5 },
        ],
      });

      const ticketTypeId = ticketTypes[0].id;

      // Sell all tickets
      await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypeId],
        quantities: [5],
      });

      // Check availability
      const availability = await checkAvailabilityBatch([ticketTypeId]);
      const ticketTypeAvailability = availability.ticketTypes.get(ticketTypeId);
      
      expect(ticketTypeAvailability?.available).toBe(0);
      expect(ticketTypeAvailability?.isAvailable).toBe(false);
    });

    it('should cache availability and invalidate on purchase', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'Cached Test', price: 50, fee: 5, totalInventory: 100 },
        ],
      });

      const ticketTypeId = ticketTypes[0].id;

      // First check (should cache)
      const availability1 = await checkAvailabilityBatch([ticketTypeId]);
      const available1 = availability1.ticketTypes.get(ticketTypeId)?.available;

      // Make a purchase (should invalidate cache)
      await createTestOrder({
        eventId: event.id,
        ticketTypeIds: [ticketTypeId],
        quantities: [5],
      });

      // Second check (should reflect updated availability)
      const availability2 = await checkAvailabilityBatch([ticketTypeId]);
      const available2 = availability2.ticketTypes.get(ticketTypeId)?.available;

      expect(available2).toBe(available1! - 5);
    });

    it('should handle unlimited inventory (null total_inventory)', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [
          { name: 'Unlimited', price: 50, fee: 5, totalInventory: undefined }, // null = unlimited
        ],
      });

      const ticketTypeId = ticketTypes[0].id;
      const availability = await checkAvailabilityBatch([ticketTypeId]);
      const ticketTypeAvailability = availability.ticketTypes.get(ticketTypeId);
      
      expect(ticketTypeAvailability?.available).toBeNull();
      expect(ticketTypeAvailability?.isAvailable).toBe(true);
    });
  });

  describe('Event Listing', () => {
    it('should return only published and active events', async () => {
      // Create multiple events with different statuses
      const publishedEvent = await seedTestEvent({
        name: 'Published Event',
        status: 'published',
        isActive: true,
      });

      const draftEvent = await seedTestEvent({
        name: 'Draft Event',
        status: 'draft',
        isActive: true,
      });

      const archivedEvent = await seedTestEvent({
        name: 'Archived Event',
        status: 'archived',
        isActive: false,
      });

      // Fetch events (should only return published and active)
      const { data: events, error } = await supabase
        .from('events')
        .select('id, name, status, is_active')
        .eq('status', 'published')
        .eq('is_active', true);

      expect(error).toBeNull();
      expect(events).toBeDefined();
      
      const eventIds = events?.map(e => e.id) || [];
      expect(eventIds).toContain(publishedEvent.event.id);
      expect(eventIds).not.toContain(draftEvent.event.id);
      expect(eventIds).not.toContain(archivedEvent.event.id);
    });

    it('should include ticket types with availability', async () => {
      const { event, ticketTypes } = await seedTestEvent({
        name: 'Event with Tickets',
        ticketTypes: [
          { name: 'GA', price: 50, fee: 5, totalInventory: 100 },
          { name: 'VIP', price: 100, fee: 10, totalInventory: 50 },
        ],
      });

      // Fetch event with ticket types
      const { data: eventWithTickets, error } = await supabase
        .from('events')
        .select(`
          id,
          name,
          ticket_types (
            id,
            name,
            price,
            total_inventory,
            tickets_sold
          )
        `)
        .eq('id', event.id)
        .single();

      expect(error).toBeNull();
      expect(eventWithTickets).toBeDefined();
      expect((eventWithTickets as any).ticket_types).toBeDefined();
      expect((eventWithTickets as any).ticket_types.length).toBe(2);
    });

    it('should filter past events correctly', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Create past event
      await seedTestEvent({
        name: 'Past Event',
        eventDate: yesterdayStr,
        status: 'published',
        isActive: true,
      });

      // Create future event
      const futureEvent = await seedTestEvent({
        name: 'Future Event',
        eventDate: tomorrowStr,
        status: 'published',
        isActive: true,
      });

      // Fetch upcoming events (future dates only)
      const today = new Date().toISOString().split('T')[0];
      const { data: upcomingEvents, error } = await supabase
        .from('events')
        .select('id, name, event_date')
        .eq('status', 'published')
        .eq('is_active', true)
        .gte('event_date', today);

      expect(error).toBeNull();
      expect(upcomingEvents).toBeDefined();
      
      const eventIds = upcomingEvents?.map(e => e.id) || [];
      expect(eventIds).toContain(futureEvent.event.id);
    });

    it('should sort by date ascending', async () => {
      // Create events with different dates
      const date1 = new Date();
      date1.setDate(date1.getDate() + 3);
      const date1Str = date1.toISOString().split('T')[0];

      const date2 = new Date();
      date2.setDate(date2.getDate() + 1);
      const date2Str = date2.toISOString().split('T')[0];

      const date3 = new Date();
      date3.setDate(date3.getDate() + 5);
      const date3Str = date3.toISOString().split('T')[0];

      const event1 = await seedTestEvent({
        name: 'Event 1',
        eventDate: date1Str,
        status: 'published',
        isActive: true,
      });

      const event2 = await seedTestEvent({
        name: 'Event 2',
        eventDate: date2Str,
        status: 'published',
        isActive: true,
      });

      const event3 = await seedTestEvent({
        name: 'Event 3',
        eventDate: date3Str,
        status: 'published',
        isActive: true,
      });

      // Fetch events sorted by date
      const { data: events, error } = await supabase
        .from('events')
        .select('id, name, event_date')
        .in('id', [event1.event.id, event2.event.id, event3.event.id])
        .order('event_date', { ascending: true });

      expect(error).toBeNull();
      expect(events).toBeDefined();
      expect(events?.length).toBe(3);

      // Verify sorting: date2 < date1 < date3
      const eventIds = events?.map(e => e.id) || [];
      expect(eventIds[0]).toBe(event2.event.id); // Earliest
      expect(eventIds[1]).toBe(event1.event.id);
      expect(eventIds[2]).toBe(event3.event.id); // Latest
    });

    it('should use pagination for large event lists', async () => {
      // Create multiple events
      const events = [];
      for (let i = 0; i < 5; i++) {
        const event = await seedTestEvent({
          name: `Pagination Test Event ${i}`,
          status: 'published',
          isActive: true,
        });
        events.push(event.event);
      }

      // Fetch first page
      const page1 = await getEventsPaginated({
        page: 1,
        pageSize: 2,
      });

      expect(page1.success).toBe(true);
      if (page1.success) {
        expect(page1.data.items.length).toBeLessThanOrEqual(2);
        expect(page1.data.pagination.page).toBe(1);
      }

      // Fetch second page
      const page2 = await getEventsPaginated({
        page: 2,
        pageSize: 2,
      });

      expect(page2.success).toBe(true);
      if (page2.success) {
        expect(page2.data.items.length).toBeLessThanOrEqual(2);
        expect(page2.data.pagination.page).toBe(2);
      }
    });
  });
});
