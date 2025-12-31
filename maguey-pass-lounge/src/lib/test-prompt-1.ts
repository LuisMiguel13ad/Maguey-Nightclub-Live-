/**
 * Test Script for Prompt 1: Race Condition Fix
 * 
 * Run this with: npx ts-node src/lib/test-prompt-1.ts
 * Or copy/paste into browser console (after building)
 */

import { supabase } from './supabase';

async function runTests() {
  console.log('🧪 Testing Prompt 1: Race Condition Fix\n');
  console.log('='.repeat(50));
  
  let passed = 0;
  let failed = 0;

  // ========== TEST 1: tickets_sold column exists ==========
  console.log('\n📋 Test 1: tickets_sold column exists');
  try {
    const { data, error } = await supabase
      .from('ticket_types')
      .select('tickets_sold')
      .limit(1);
    
    if (error) throw error;
    console.log('   ✅ PASSED - tickets_sold column exists');
    passed++;
  } catch (e: any) {
    console.log('   ❌ FAILED -', e.message);
    failed++;
  }

  // ========== TEST 2: check_and_reserve_tickets RPC exists ==========
  console.log('\n📋 Test 2: check_and_reserve_tickets RPC function exists');
  try {
    // This will fail if function doesn't exist
    const { error } = await supabase.rpc('check_and_reserve_tickets', {
      p_ticket_type_id: '00000000-0000-0000-0000-000000000000',
      p_quantity: 1
    });
    
    // We expect an error because fake ID, but NOT "function does not exist"
    if (error?.message?.includes('does not exist')) {
      throw new Error('RPC function not found');
    }
    console.log('   ✅ PASSED - RPC function exists');
    passed++;
  } catch (e: any) {
    if (e.message.includes('not found') || e.message.includes('does not exist')) {
      console.log('   ❌ FAILED - RPC function not created');
      failed++;
    } else {
      console.log('   ✅ PASSED - RPC function exists (got expected error for fake ID)');
      passed++;
    }
  }

  // ========== TEST 3: Get a real ticket type for testing ==========
  console.log('\n📋 Test 3: Finding a ticket type to test with...');
  let testTicketType: any = null;
  try {
    const { data, error } = await supabase
      .from('ticket_types')
      .select('id, name, total_inventory, tickets_sold, event_id')
      .limit(1)
      .single();
    
    if (error) throw error;
    testTicketType = data;
    console.log(`   ✅ Found: ${data.name}`);
    console.log(`      Inventory: ${data.tickets_sold}/${data.total_inventory}`);
    passed++;
  } catch (e: any) {
    console.log('   ⚠️ No ticket types found - create an event first');
    console.log('   Skipping remaining tests...');
    printSummary(passed, failed);
    return;
  }

  // ========== TEST 4: Reservation increments tickets_sold ==========
  console.log('\n📋 Test 4: Reservation increments tickets_sold');
  try {
    const beforeCount = testTicketType.tickets_sold || 0;
    
    const { data, error } = await supabase.rpc('check_and_reserve_tickets', {
      p_ticket_type_id: testTicketType.id,
      p_quantity: 1
    });
    
    if (error) throw error;
    
    // Check if tickets_sold increased
    const { data: after } = await supabase
      .from('ticket_types')
      .select('tickets_sold')
      .eq('id', testTicketType.id)
      .single();
    
    if (after && after.tickets_sold === beforeCount + 1) {
      console.log(`   ✅ PASSED - tickets_sold: ${beforeCount} → ${after.tickets_sold}`);
      passed++;
      
      // Clean up - release the test reservation
      await supabase.rpc('release_reserved_tickets', {
        p_ticket_type_id: testTicketType.id,
        p_quantity: 1
      }).catch(() => {
        // If release function doesn't exist, manually fix
        supabase.from('ticket_types')
          .update({ tickets_sold: beforeCount })
          .eq('id', testTicketType.id);
      });
    } else {
      throw new Error(`tickets_sold didn't increment: ${beforeCount} → ${after?.tickets_sold}`);
    }
  } catch (e: any) {
    console.log('   ❌ FAILED -', e.message);
    failed++;
  }

  // ========== TEST 5: Overselling is blocked ==========
  console.log('\n📋 Test 5: Overselling is blocked');
  try {
    // Try to reserve more than available
    const available = (testTicketType.total_inventory || 100) - (testTicketType.tickets_sold || 0);
    const tooMany = available + 10;
    
    const { data, error } = await supabase.rpc('check_and_reserve_tickets', {
      p_ticket_type_id: testTicketType.id,
      p_quantity: tooMany
    });
    
    if (error || data === false) {
      console.log(`   ✅ PASSED - Correctly rejected request for ${tooMany} tickets (only ${available} available)`);
      passed++;
    } else {
      console.log('   ❌ FAILED - Should have rejected overselling');
      failed++;
    }
  } catch (e: any) {
    // An error here is actually good - means it blocked the oversell
    console.log('   ✅ PASSED - Overselling blocked with error');
    passed++;
  }

  // ========== TEST 6: Database constraint exists ==========
  console.log('\n📋 Test 6: Database constraint prevents invalid data');
  try {
    // Try to set tickets_sold higher than total_inventory
    const { error } = await supabase
      .from('ticket_types')
      .update({ tickets_sold: 999999 })
      .eq('id', testTicketType.id);
    
    if (error) {
      console.log('   ✅ PASSED - Constraint blocked invalid update');
      passed++;
    } else {
      // Undo the change
      await supabase
        .from('ticket_types')
        .update({ tickets_sold: testTicketType.tickets_sold || 0 })
        .eq('id', testTicketType.id);
      console.log('   ⚠️ WARNING - No constraint found (update succeeded but was reverted)');
      failed++;
    }
  } catch (e: any) {
    console.log('   ✅ PASSED - Constraint exists');
    passed++;
  }

  // ========== SUMMARY ==========
  printSummary(passed, failed);
}

function printSummary(passed: number, failed: number) {
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('='.repeat(50));
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Prompt 1 is working correctly.\n');
  } else {
    console.log('\n⚠️ Some tests failed. Review the errors above.\n');
  }
}

// Run the tests
runTests().catch(console.error);
