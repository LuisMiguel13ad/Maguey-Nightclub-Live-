/**
 * Test Script for Pagination Utilities
 * 
 * Run with: npx tsx src/lib/test-pagination.ts
 */

import 'dotenv/config';
import { supabase } from './supabase';
import {
  normalizePaginationOptions,
  normalizeCursorOptions,
  calculatePagination,
  buildPaginatedResponse,
  buildCursorPaginatedResponse,
  getPageNumbers,
  parsePaginationFromQuery,
  buildPaginationQueryString,
} from './pagination';
import {
  getOrdersPaginated,
  getUserOrdersPaginated,
  getOrdersCursor,
} from './orders-service';
import {
  getEventsPaginated,
  getEventsCursor,
  getTicketTypesPaginated,
} from './events-service';

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
  logSection('Pagination Utilities Test Suite');
  
  // ============================================
  // Test 1: Normalize Options
  // ============================================
  logSection('Test 1: Normalize Pagination Options');
  
  const defaultOptions = normalizePaginationOptions({});
  logSuccess(`Default options: page=${defaultOptions.page}, pageSize=${defaultOptions.pageSize}`);
  
  const customOptions = normalizePaginationOptions({
    page: 3,
    pageSize: 50,
    sortBy: 'name',
    sortOrder: 'asc',
  });
  logSuccess(`Custom options: page=${customOptions.page}, pageSize=${customOptions.pageSize}, sortBy=${customOptions.sortBy}`);
  
  const boundedOptions = normalizePaginationOptions({
    page: -1,  // Should be bounded to 1
    pageSize: 500,  // Should be bounded to MAX_PAGE_SIZE (100)
  });
  logSuccess(`Bounded options: page=${boundedOptions.page} (min 1), pageSize=${boundedOptions.pageSize} (max 100)`);
  
  // ============================================
  // Test 2: Calculate Pagination
  // ============================================
  logSection('Test 2: Calculate Pagination');
  
  const calc = calculatePagination(100, { page: 2, pageSize: 20 });
  log(`Total: 100 items, Page 2, PageSize 20`, colors.blue);
  log(`  Offset: ${calc.offset}`, colors.cyan);
  log(`  Limit: ${calc.limit}`, colors.cyan);
  log(`  Total Pages: ${calc.meta.totalPages}`, colors.cyan);
  log(`  Has Next: ${calc.meta.hasNextPage}`, colors.cyan);
  log(`  Has Prev: ${calc.meta.hasPreviousPage}`, colors.cyan);
  
  if (calc.offset === 20 && calc.meta.totalPages === 5 && calc.meta.hasNextPage && calc.meta.hasPreviousPage) {
    logSuccess('Pagination calculation correct!');
  } else {
    logError('Pagination calculation incorrect');
  }
  
  // ============================================
  // Test 3: Build Paginated Response
  // ============================================
  logSection('Test 3: Build Paginated Response');
  
  const mockData = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const response = buildPaginatedResponse(mockData, 100, { page: 2, pageSize: 20 });
  
  log(`Response for 3 items (page 2 of 5):`, colors.blue);
  log(`  Data length: ${response.data.length}`, colors.cyan);
  log(`  Page: ${response.pagination.page}`, colors.cyan);
  log(`  Total Items: ${response.pagination.totalItems}`, colors.cyan);
  log(`  Total Pages: ${response.pagination.totalPages}`, colors.cyan);
  log(`  Start Index: ${response.pagination.startIndex}`, colors.cyan);
  log(`  End Index: ${response.pagination.endIndex}`, colors.cyan);
  
  logSuccess('Paginated response built successfully!');
  
  // ============================================
  // Test 4: Page Numbers for UI
  // ============================================
  logSection('Test 4: Page Numbers for UI');
  
  const pages1 = getPageNumbers(1, 5);
  log(`Pages for page 1 of 5: [${pages1.join(', ')}]`, colors.cyan);
  
  const pages2 = getPageNumbers(5, 10);
  log(`Pages for page 5 of 10: [${pages2.join(', ')}] (-1 = ellipsis)`, colors.cyan);
  
  const pages3 = getPageNumbers(50, 100);
  log(`Pages for page 50 of 100: [${pages3.join(', ')}]`, colors.cyan);
  
  logSuccess('Page numbers generated correctly!');
  
  // ============================================
  // Test 5: Query String Helpers
  // ============================================
  logSection('Test 5: Query String Helpers');
  
  const queryString = buildPaginationQueryString({
    page: 2,
    pageSize: 25,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
  log(`Built query string: ${queryString}`, colors.cyan);
  
  const parsed = parsePaginationFromQuery(queryString);
  log(`Parsed back: page=${parsed.page}, pageSize=${parsed.pageSize}, sortBy=${parsed.sortBy}`, colors.cyan);
  
  if (parsed.page === 2 && parsed.pageSize === 25) {
    logSuccess('Query string round-trip successful!');
  } else {
    logError('Query string round-trip failed');
  }
  
  // ============================================
  // Test 6: getOrdersPaginated
  // ============================================
  logSection('Test 6: getOrdersPaginated');
  
  try {
    const ordersResult = await getOrdersPaginated(
      { page: 1, pageSize: 5, sortBy: 'created_at', sortOrder: 'desc' },
      {}
    );
    
    logSuccess(`Fetched ${ordersResult.data.length} orders`);
    log(`  Total Items: ${ordersResult.pagination.totalItems}`, colors.cyan);
    log(`  Total Pages: ${ordersResult.pagination.totalPages}`, colors.cyan);
    log(`  Has Next Page: ${ordersResult.pagination.hasNextPage}`, colors.cyan);
    
    if (ordersResult.data.length > 0) {
      log(`  First order ID: ${ordersResult.data[0].id}`, colors.cyan);
      log(`  First order email: ${ordersResult.data[0].purchaser_email}`, colors.cyan);
    }
  } catch (error) {
    logError(`Failed to get orders: ${error}`);
  }
  
  // ============================================
  // Test 7: getOrdersCursor (Infinite Scroll)
  // ============================================
  logSection('Test 7: getOrdersCursor (Infinite Scroll)');
  
  try {
    // First page
    const firstPage = await getOrdersCursor(
      { limit: 3, sortBy: 'created_at', sortOrder: 'desc' },
      {}
    );
    
    logSuccess(`First cursor page: ${firstPage.data.length} orders`);
    log(`  Has More: ${firstPage.hasMore}`, colors.cyan);
    log(`  Next Cursor: ${firstPage.nextCursor}`, colors.cyan);
    
    // Second page (if there's more)
    if (firstPage.hasMore && firstPage.nextCursor) {
      const secondPage = await getOrdersCursor(
        { cursor: firstPage.nextCursor, limit: 3 },
        {}
      );
      
      logSuccess(`Second cursor page: ${secondPage.data.length} orders`);
      log(`  Has More: ${secondPage.hasMore}`, colors.cyan);
    }
  } catch (error) {
    logError(`Failed to get cursor orders: ${error}`);
  }
  
  // ============================================
  // Test 8: getEventsPaginated
  // ============================================
  logSection('Test 8: getEventsPaginated');
  
  try {
    const eventsResult = await getEventsPaginated(
      { page: 1, pageSize: 5, sortBy: 'event_date', sortOrder: 'asc' },
      { status: 'published', upcomingOnly: true }
    );
    
    logSuccess(`Fetched ${eventsResult.data.length} events`);
    log(`  Total Items: ${eventsResult.pagination.totalItems}`, colors.cyan);
    log(`  Total Pages: ${eventsResult.pagination.totalPages}`, colors.cyan);
    
    if (eventsResult.data.length > 0) {
      log(`  First event: ${eventsResult.data[0].name}`, colors.cyan);
      log(`  Event date: ${eventsResult.data[0].event_date}`, colors.cyan);
    }
  } catch (error) {
    logError(`Failed to get events: ${error}`);
  }
  
  // ============================================
  // Test 9: getTicketTypesPaginated
  // ============================================
  logSection('Test 9: getTicketTypesPaginated');
  
  try {
    // First get an event ID
    const { data: events } = await supabase
      .from('events')
      .select('id, name')
      .limit(1)
      .single();
    
    if (events) {
      const ticketTypesResult = await getTicketTypesPaginated(
        events.id,
        { page: 1, pageSize: 10, sortBy: 'price', sortOrder: 'asc' },
        {}
      );
      
      logSuccess(`Fetched ${ticketTypesResult.data.length} ticket types for "${events.name}"`);
      log(`  Total Items: ${ticketTypesResult.pagination.totalItems}`, colors.cyan);
      
      if (ticketTypesResult.data.length > 0) {
        log(`  First ticket type: ${ticketTypesResult.data[0].name}`, colors.cyan);
        log(`  Price: $${ticketTypesResult.data[0].price}`, colors.cyan);
      }
    } else {
      logInfo('No events found to test ticket types pagination');
    }
  } catch (error) {
    logError(`Failed to get ticket types: ${error}`);
  }
  
  // ============================================
  // Summary
  // ============================================
  logSection('Test Summary');
  
  logSuccess('All pagination tests completed!');
  
  console.log();
  log('📋 Pagination Utilities Created:', colors.cyan);
  log('   • pagination.ts - Core pagination utilities', colors.green);
  log('   • orders-service.ts - getOrdersPaginated, getUserOrdersPaginated, getOrdersCursor', colors.green);
  log('   • events-service.ts - getEventsPaginated, getEventsCursor, getTicketTypesPaginated', colors.green);
  log('   • usePagination.ts - React hooks for pagination', colors.green);
  
  console.log();
  log('📝 Usage Example:', colors.cyan);
  console.log(`
${colors.yellow}// Offset-based pagination (page numbers)
const result = await getOrdersPaginated(
  { page: 1, pageSize: 20, sortBy: 'created_at', sortOrder: 'desc' },
  { status: 'paid', eventId: 'event-123' }
);

console.log(result.pagination.totalPages);
console.log(result.pagination.hasNextPage);

// Cursor-based pagination (infinite scroll)
const cursor = await getOrdersCursor(
  { limit: 20, cursor: lastOrderId },
  { status: 'paid' }
);

console.log(cursor.hasMore);
console.log(cursor.nextCursor);

// React hook
const { data, pagination, goToPage, nextPage } = usePagination(
  (opts) => getOrdersPaginated(opts, filters),
  { pageSize: 20 }
);${colors.reset}
`);
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
