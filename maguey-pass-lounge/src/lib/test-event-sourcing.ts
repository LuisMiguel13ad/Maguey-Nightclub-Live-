/**
 * Test Script for Event Sourcing Implementation
 * 
 * Run with: npx tsx src/lib/test-event-sourcing.ts
 */

import 'dotenv/config';
import { randomUUID } from 'crypto';
import { supabase } from './supabase';
import { eventStore, EventStore } from './event-store';
import { 
  publishTicketIssued, 
  publishTicketScanned,
  publishTicketRefunded,
  getTicketHistory,
  TicketEventTypes,
} from './events/ticket-events';
import { generateCorrelationId, createEventMetadata } from './event-store';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logSection(message: string) {
  console.log();
  log(`${'='.repeat(60)}`, colors.cyan);
  log(`  ${message}`, colors.cyan);
  log(`${'='.repeat(60)}`, colors.cyan);
}

async function runTests() {
  logSection('Event Sourcing Test Suite');
  
  // Generate a test ticket ID (simulating a new ticket)
  const testTicketId = randomUUID();
  const testOrderId = randomUUID();
  const testEventId = 'test-event-001';
  const correlationId = generateCorrelationId();
  
  logInfo(`Test Ticket ID: ${testTicketId}`);
  logInfo(`Correlation ID: ${correlationId}`);
  
  // ============================================
  // Test 1: Append TicketIssued Event
  // ============================================
  logSection('Test 1: Append TicketIssued Event');
  
  try {
    const metadata = createEventMetadata({
      actorType: 'system',
      source: 'test-script',
    });
    
    const issuedEvent = await publishTicketIssued(
      testTicketId,
      {
        orderId: testOrderId,
        eventId: testEventId,
        attendeeName: 'John Doe',
        attendeeEmail: 'john@example.com',
        ticketTypeId: 'vip-001',
        ticketTypeName: 'VIP Entry',
        price: 99.99,
        feeTotal: 10.00,
        qrToken: `QR-${testTicketId.slice(0, 8)}`,
        qrSignature: 'test-signature-123',
      },
      metadata,
      correlationId
    );
    
    logSuccess('TicketIssued event appended successfully');
    logInfo(`Event ID: ${issuedEvent.id}`);
    logInfo(`Sequence Number: ${issuedEvent.sequenceNumber}`);
    console.log('Event Data:', JSON.stringify(issuedEvent.eventData, null, 2));
  } catch (error) {
    logError(`Failed to append TicketIssued event: ${error}`);
    return;
  }
  
  // ============================================
  // Test 2: Get Events for Ticket
  // ============================================
  logSection('Test 2: Get Events for Ticket');
  
  try {
    const events = await eventStore.getEvents(testTicketId);
    
    logSuccess(`Retrieved ${events.length} event(s)`);
    events.forEach((event, index) => {
      logInfo(`Event ${index + 1}: ${event.eventType} (seq: ${event.sequenceNumber})`);
    });
  } catch (error) {
    logError(`Failed to get events: ${error}`);
  }
  
  // ============================================
  // Test 3: Append TicketScanned Event
  // ============================================
  logSection('Test 3: Append TicketScanned Event');
  
  try {
    const scannedEvent = await publishTicketScanned(
      testTicketId,
      {
        scannedBy: 'staff@example.com',
        scanMethod: 'qr',
        scanDurationMs: 150,
        gate: 'Gate A',
        location: 'Main Entrance',
      },
      createEventMetadata({
        actorId: 'staff@example.com',
        actorType: 'scanner',
        deviceId: 'scanner-001',
      }),
      correlationId
    );
    
    logSuccess('TicketScanned event appended successfully');
    logInfo(`Event ID: ${scannedEvent.id}`);
    logInfo(`Sequence Number: ${scannedEvent.sequenceNumber}`);
    console.log('Event Data:', JSON.stringify(scannedEvent.eventData, null, 2));
  } catch (error) {
    logError(`Failed to append TicketScanned event: ${error}`);
  }
  
  // ============================================
  // Test 4: Check Events After Scan
  // ============================================
  logSection('Test 4: Check Events After Scan');
  
  try {
    const events = await eventStore.getEvents(testTicketId);
    
    logSuccess(`Retrieved ${events.length} event(s)`);
    events.forEach((event, index) => {
      logInfo(`Event ${index + 1}: ${event.eventType} (seq: ${event.sequenceNumber})`);
      console.log(`  Data: ${JSON.stringify(event.eventData)}`);
    });
  } catch (error) {
    logError(`Failed to get events: ${error}`);
  }
  
  // ============================================
  // Test 5: Rebuild State from Events
  // ============================================
  logSection('Test 5: Rebuild State from Events');
  
  try {
    const state = await eventStore.rebuildState(testTicketId);
    
    logSuccess('State rebuilt successfully');
    console.log('Current State:', JSON.stringify({
      ticketId: state.ticketId,
      status: state.status,
      orderId: state.orderId,
      attendeeName: state.attendeeName,
      ticketTypeName: state.ticketTypeName,
      price: state.price,
      isScanned: state.isScanned,
      scanCount: state.scanCount,
      firstScannedAt: state.firstScannedAt,
      scannedBy: state.scannedBy,
      isCurrentlyInside: state.isCurrentlyInside,
      eventCount: state.eventCount,
      version: state.version,
    }, null, 2));
  } catch (error) {
    logError(`Failed to rebuild state: ${error}`);
  }
  
  // ============================================
  // Test 6: Get Events Since Sequence
  // ============================================
  logSection('Test 6: Get Events Since Sequence Number');
  
  try {
    // Get events since sequence 1 (should only return the scan event)
    const eventsSince = await eventStore.getEventsSince(testTicketId, 1);
    
    logSuccess(`Retrieved ${eventsSince.length} event(s) since sequence 1`);
    eventsSince.forEach((event, index) => {
      logInfo(`Event: ${event.eventType} (seq: ${event.sequenceNumber})`);
    });
  } catch (error) {
    logError(`Failed to get events since: ${error}`);
  }
  
  // ============================================
  // Test 7: Add a Refund Event
  // ============================================
  logSection('Test 7: Append TicketRefunded Event');
  
  try {
    const refundedEvent = await publishTicketRefunded(
      testTicketId,
      {
        refundId: `refund-${Date.now()}`,
        refundAmount: 99.99,
        refundReason: 'Customer requested',
        refundedBy: 'admin@example.com',
      },
      createEventMetadata({
        actorId: 'admin@example.com',
        actorType: 'admin',
      }),
      correlationId
    );
    
    logSuccess('TicketRefunded event appended successfully');
    logInfo(`Event ID: ${refundedEvent.id}`);
    logInfo(`Sequence Number: ${refundedEvent.sequenceNumber}`);
  } catch (error) {
    logError(`Failed to append TicketRefunded event: ${error}`);
  }
  
  // ============================================
  // Test 8: Final State After Refund
  // ============================================
  logSection('Test 8: Final State After Refund');
  
  try {
    const finalState = await eventStore.rebuildState(testTicketId);
    
    logSuccess('Final state rebuilt successfully');
    console.log('Final State:', JSON.stringify({
      ticketId: finalState.ticketId,
      status: finalState.status,
      isScanned: finalState.isScanned,
      isRefunded: finalState.isRefunded,
      refundAmount: finalState.refundAmount,
      eventCount: finalState.eventCount,
      version: finalState.version,
    }, null, 2));
  } catch (error) {
    logError(`Failed to rebuild final state: ${error}`);
  }
  
  // ============================================
  // Test 9: Get Full Audit Trail
  // ============================================
  logSection('Test 9: Full Audit Trail');
  
  try {
    const auditTrail = await getTicketHistory(testTicketId);
    
    logSuccess(`Full audit trail (${auditTrail.length} events):`);
    console.log();
    
    auditTrail.forEach((event, index) => {
      console.log(`${colors.yellow}[${index + 1}] ${event.eventType}${colors.reset}`);
      console.log(`    Sequence: ${event.sequenceNumber}`);
      console.log(`    Occurred: ${event.occurredAt.toISOString()}`);
      console.log(`    Data: ${JSON.stringify(event.eventData)}`);
      console.log();
    });
  } catch (error) {
    logError(`Failed to get audit trail: ${error}`);
  }
  
  // ============================================
  // Test 10: Query Events in Database
  // ============================================
  logSection('Test 10: Verify in Database (SQL Query)');
  
  try {
    const { data, error } = await supabase
      .from('ticket_events')
      .select('event_type, event_data, metadata, sequence_number, occurred_at')
      .eq('aggregate_id', testTicketId)
      .order('sequence_number', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    logSuccess(`Database query returned ${data?.length || 0} rows`);
    console.log();
    
    if (data) {
      data.forEach((row, index) => {
        console.log(`${colors.cyan}Row ${index + 1}:${colors.reset}`);
        console.log(`  event_type: ${row.event_type}`);
        console.log(`  sequence_number: ${row.sequence_number}`);
        console.log(`  occurred_at: ${row.occurred_at}`);
        console.log(`  event_data: ${JSON.stringify(row.event_data)}`);
        console.log();
      });
    }
  } catch (error) {
    logError(`Database query failed: ${error}`);
  }
  
  // ============================================
  // Test 11: Get Events by Correlation ID
  // ============================================
  logSection('Test 11: Get Events by Correlation ID');
  
  try {
    const correlatedEvents = await eventStore.getEventsByCorrelationId(correlationId);
    
    logSuccess(`Found ${correlatedEvents.length} events with correlation ID`);
    correlatedEvents.forEach((event) => {
      logInfo(`${event.eventType} - ${event.occurredAt.toISOString()}`);
    });
  } catch (error) {
    logError(`Failed to get correlated events: ${error}`);
  }
  
  // ============================================
  // Cleanup (optional)
  // ============================================
  logSection('Test Summary');
  
  logSuccess('All tests completed!');
  logInfo(`Test ticket ID: ${testTicketId}`);
  logInfo('You can query this ticket in the database:');
  console.log();
  console.log(`${colors.yellow}SELECT event_type, event_data, occurred_at`);
  console.log(`FROM ticket_events`);
  console.log(`WHERE aggregate_id = '${testTicketId}'`);
  console.log(`ORDER BY sequence_number;${colors.reset}`);
  console.log();
  
  // Optional: Clean up test data
  // const { error: cleanupError } = await supabase
  //   .from('ticket_events')
  //   .delete()
  //   .eq('aggregate_id', testTicketId);
  // if (!cleanupError) {
  //   logInfo('Test data cleaned up');
  // }
}

// Run the tests
runTests()
  .then(() => {
    log('\n✨ Test script completed', colors.green);
    process.exit(0);
  })
  .catch((error) => {
    logError(`Test script failed: ${error}`);
    process.exit(1);
  });
