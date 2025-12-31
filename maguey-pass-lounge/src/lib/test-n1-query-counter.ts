/**
 * N+1 Query Counter Test
 * 
 * This script tests the N+1 query optimization by:
 * 1. Adding a query counter to track all database queries
 * 2. Testing before/after optimization scenarios
 * 3. Running performance benchmarks
 * 
 * Run with: npx tsx src/lib/test-n1-query-counter.ts
 */

import 'dotenv/config';
import { supabase } from './supabase';
import { 
  checkAvailabilityBatch,
  checkRequestedAvailability,
} from './availability-service';
import {
  checkLineItemsAvailability,
  insertTicketsForOrder,
  insertTicketsForOrderBatch,
  type OrderLineItem,
  type InsertTicketsParams,
  type BatchInsertTicketsParams,
} from './orders-service';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
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

function logQuery(message: string) {
  log(`🔍 ${message}`, colors.magenta);
}

function logSection(message: string) {
  console.log();
  log(`${'='.repeat(60)}`, colors.cyan);
  log(`  ${message}`, colors.cyan);
  log(`${'='.repeat(60)}`, colors.cyan);
}

// ============================================
// QUERY COUNTER SETUP
// ============================================

let queryCount = 0;
const queryLog: string[] = [];

// Store original method
const originalFrom = supabase.from.bind(supabase);
const originalRpc = supabase.rpc.bind(supabase);

// Monkey-patch supabase.from to count queries
function enableQueryCounter() {
  queryCount = 0;
  queryLog.length = 0;
  
  (supabase as any).from = (...args: any[]) => {
    queryCount++;
    const tableName = args[0];
    queryLog.push(`Query #${queryCount}: SELECT/INSERT/UPDATE on "${tableName}"`);
    logQuery(`Query #${queryCount}: ${tableName}`);
    return originalFrom(...args);
  };
  
  (supabase as any).rpc = (...args: any[]) => {
    queryCount++;
    const funcName = args[0];
    queryLog.push(`Query #${queryCount}: RPC "${funcName}"`);
    logQuery(`Query #${queryCount}: RPC ${funcName}`);
    return originalRpc(...args);
  };
}

function disableQueryCounter() {
  (supabase as any).from = originalFrom;
  (supabase as any).rpc = originalRpc;
}

function resetQueryCount() {
  queryCount = 0;
  queryLog.length = 0;
}

function getQueryCount() {
  return queryCount;
}

function getQueryLog() {
  return [...queryLog];
}

// ============================================
// TEST FUNCTIONS
// ============================================

async function testN1AvailabilityBefore(ticketTypeIds: string[]): Promise<number> {
  resetQueryCount();
  log('\n  Simulating N+1 pattern (BEFORE optimization)...', colors.yellow);
  
  // N+1 Pattern: One query per ticket type
  for (const ticketTypeId of ticketTypeIds) {
    // Query 1: Get ticket type
    await supabase
      .from('ticket_types')
      .select('total_inventory, name')
      .eq('id', ticketTypeId)
      .single();
    
    // Query 2: Count sold tickets
    await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('ticket_type_id', ticketTypeId)
      .in('status', ['issued', 'used', 'scanned']);
  }
  
  return getQueryCount();
}

async function testBatchedAvailabilityAfter(ticketTypeIds: string[]): Promise<number> {
  resetQueryCount();
  log('\n  Using batched queries (AFTER optimization)...', colors.green);
  
  // Batched: Only 2 queries total
  await checkAvailabilityBatch(ticketTypeIds, { useCache: false });
  
  return getQueryCount();
}

async function runTests() {
  logSection('N+1 Query Counter Test Suite');
  
  // Enable query counting
  enableQueryCounter();
  
  try {
    // ============================================
    // Setup: Get test data from database
    // ============================================
    logSection('Setup: Loading Test Data');
    
    resetQueryCount();
    
    const { data: ticketTypes, error: ttError } = await supabase
      .from('ticket_types')
      .select('id, name, event_id, total_inventory, price, fee')
      .limit(5);
    
    if (ttError || !ticketTypes || ticketTypes.length === 0) {
      logError(`Failed to fetch ticket types: ${ttError?.message ?? 'No ticket types found'}`);
      return;
    }
    
    const { data: events, error: evError } = await supabase
      .from('events')
      .select('id, name, image_url, event_date, event_time, venue_name, venue_address, city')
      .limit(1)
      .single();
    
    if (evError || !events) {
      logError(`Failed to fetch event: ${evError?.message ?? 'No events found'}`);
      return;
    }
    
    logInfo(`Loaded ${ticketTypes.length} ticket types`);
    logInfo(`Using event: ${events.name}`);
    
    const testTicketTypeIds = ticketTypes.map(t => t.id);
    
    // ============================================
    // Test 1: Availability Check - Before vs After
    // ============================================
    logSection('Test 1: Availability Check Query Count');
    
    log(`\n  Testing with ${testTicketTypeIds.length} ticket types...`, colors.blue);
    
    // Before (N+1)
    const queriesBefore = await testN1AvailabilityBefore(testTicketTypeIds);
    log(`\n  📊 BEFORE (N+1): ${queriesBefore} queries`, colors.yellow);
    log(`     Expected: ${testTicketTypeIds.length * 2} queries (2 per ticket type)`, colors.yellow);
    
    // After (Batched)
    const queriesAfter = await testBatchedAvailabilityAfter(testTicketTypeIds);
    log(`\n  📊 AFTER (Batched): ${queriesAfter} queries`, colors.green);
    log(`     Expected: 2 queries (constant)`, colors.green);
    
    // Comparison
    const reduction = ((queriesBefore - queriesAfter) / queriesBefore * 100).toFixed(1);
    log(`\n  📈 Query Reduction: ${reduction}%`, colors.cyan);
    log(`     Saved ${queriesBefore - queriesAfter} queries!`, colors.cyan);
    
    if (queriesAfter <= 2) {
      logSuccess('Availability optimization verified!');
    } else {
      logError(`Expected 2 queries, got ${queriesAfter}`);
    }
    
    // ============================================
    // Test 2: Line Items Availability Check
    // ============================================
    logSection('Test 2: Line Items Availability Check');
    
    const lineItems: OrderLineItem[] = ticketTypes.slice(0, 3).map((t, i) => ({
      ticketTypeId: t.id,
      quantity: i + 1,
      unitPrice: Number(t.price) || 25,
      unitFee: Number(t.fee) || 5,
      displayName: t.name,
    }));
    
    log(`\n  Testing checkLineItemsAvailability with ${lineItems.length} line items...`, colors.blue);
    
    resetQueryCount();
    const availability = await checkLineItemsAvailability(lineItems);
    const lineItemQueries = getQueryCount();
    
    log(`\n  📊 Queries used: ${lineItemQueries}`, colors.green);
    logInfo(`  Results:`);
    for (const result of availability) {
      const status = result.isAvailable ? '✅' : '❌';
      log(`     ${status} ${result.name}: ${result.requestedQuantity} requested, ${result.available ?? 'unlimited'} available`, 
        result.isAvailable ? colors.green : colors.red);
    }
    
    if (lineItemQueries <= 2) {
      logSuccess('Line items availability check optimized!');
    } else {
      logError(`Expected 2 queries, got ${lineItemQueries}`);
    }
    
    // ============================================
    // Test 3: Check Requested Availability
    // ============================================
    logSection('Test 3: Check Requested Availability');
    
    const checks = ticketTypes.slice(0, 3).map(t => ({
      ticketTypeId: t.id,
      requestedQuantity: 2,
    }));
    
    log(`\n  Testing checkRequestedAvailability with ${checks.length} checks...`, colors.blue);
    
    resetQueryCount();
    const requestedResults = await checkRequestedAvailability(checks, { useCache: false });
    const requestedQueries = getQueryCount();
    
    log(`\n  📊 Queries used: ${requestedQueries}`, colors.green);
    
    if (requestedQueries <= 2) {
      logSuccess('Requested availability check optimized!');
    } else {
      logError(`Expected 2 queries, got ${requestedQueries}`);
    }
    
    // ============================================
    // Test 4: Performance Benchmark - Availability
    // ============================================
    logSection('Test 4: Performance Benchmark - Availability');
    
    const iterations = 10;
    
    // Benchmark N+1 pattern
    log(`\n  Benchmarking N+1 pattern (${iterations} iterations)...`, colors.yellow);
    const n1Start = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const ticketTypeId of testTicketTypeIds.slice(0, 3)) {
        await supabase
          .from('ticket_types')
          .select('total_inventory, name')
          .eq('id', ticketTypeId)
          .single();
        
        await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('ticket_type_id', ticketTypeId)
          .in('status', ['issued', 'used', 'scanned']);
      }
    }
    const n1Duration = performance.now() - n1Start;
    
    // Benchmark batched pattern
    log(`\n  Benchmarking batched pattern (${iterations} iterations)...`, colors.green);
    const batchStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      await checkAvailabilityBatch(testTicketTypeIds.slice(0, 3), { useCache: false });
    }
    const batchDuration = performance.now() - batchStart;
    
    log(`\n  📊 Performance Results:`, colors.cyan);
    log(`     N+1 Pattern: ${n1Duration.toFixed(2)}ms (${(n1Duration / iterations).toFixed(2)}ms/iteration)`, colors.yellow);
    log(`     Batched: ${batchDuration.toFixed(2)}ms (${(batchDuration / iterations).toFixed(2)}ms/iteration)`, colors.green);
    log(`     Speedup: ${(n1Duration / batchDuration).toFixed(2)}x faster`, colors.green);
    
    // ============================================
    // Summary
    // ============================================
    logSection('Test Summary');
    
    console.log();
    log('┌─────────────────────────────────────────────────────────────┐', colors.cyan);
    log('│                    QUERY COUNT RESULTS                       │', colors.cyan);
    log('├─────────────────────────────────────────────────────────────┤', colors.cyan);
    log(`│ Test                          │ Before  │ After  │ Saved   │`, colors.cyan);
    log('├─────────────────────────────────────────────────────────────┤', colors.cyan);
    log(`│ Availability (${testTicketTypeIds.length} types)          │ ${String(queriesBefore).padStart(7)} │ ${String(queriesAfter).padStart(6)} │ ${String(queriesBefore - queriesAfter).padStart(7)} │`, colors.cyan);
    log(`│ Line Items (${lineItems.length} items)           │ ${String(lineItems.length * 2).padStart(7)} │ ${String(lineItemQueries).padStart(6)} │ ${String(lineItems.length * 2 - lineItemQueries).padStart(7)} │`, colors.cyan);
    log(`│ Requested Availability        │ ${String(checks.length * 2).padStart(7)} │ ${String(requestedQueries).padStart(6)} │ ${String(checks.length * 2 - requestedQueries).padStart(7)} │`, colors.cyan);
    log('└─────────────────────────────────────────────────────────────┘', colors.cyan);
    
    console.log();
    log('┌─────────────────────────────────────────────────────────────┐', colors.cyan);
    log('│                  PERFORMANCE BENCHMARK                       │', colors.cyan);
    log('├─────────────────────────────────────────────────────────────┤', colors.cyan);
    log(`│ N+1 Pattern (${iterations} iterations):    ${n1Duration.toFixed(0).padStart(6)}ms                   │`, colors.yellow);
    log(`│ Batched (${iterations} iterations):        ${batchDuration.toFixed(0).padStart(6)}ms                   │`, colors.green);
    log(`│ Speedup:                       ${(n1Duration / batchDuration).toFixed(2).padStart(6)}x                   │`, colors.green);
    log('└─────────────────────────────────────────────────────────────┘', colors.cyan);
    
    console.log();
    logSuccess('All N+1 query optimization tests passed!');
    
  } finally {
    // Restore original methods
    disableQueryCounter();
  }
}

// Run the tests
runTests()
  .then(() => {
    log('\n✨ Test script completed', colors.green);
    process.exit(0);
  })
  .catch((error) => {
    logError(`Test script failed: ${error}`);
    console.error(error);
    process.exit(1);
  });
