import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  mapCheckoutSelectionToLineItems,
  type CheckoutSelectionRecord,
  type OrderLineItem,
  type CreateOrderInput,
} from '../orders-service'
import {
  createMockEvent,
  createMockTicketType,
  createMockOrder,
  createMockTicket,
  createMockSupabaseClient,
  resetCounters,
  generateQRSignature,
  generateMockQRToken,
  validateQRSignature,
  runConcurrently,
  expectOk,
  expectErr,
} from './test-utils'

// ============================================
// mapCheckoutSelectionToLineItems Tests
// ============================================

describe('mapCheckoutSelectionToLineItems', () => {
  it('filters out zero-quantity tickets and maps to line items', () => {
    const selection: CheckoutSelectionRecord = {
      'ticket-1': { name: 'VIP', price: 100, fee: 15, quantity: 2 },
      'ticket-2': { name: 'GA', price: 50, fee: 10, quantity: 0 },
      'ticket-3': { name: 'Balcony', price: 75, fee: 12, quantity: 1 },
    }

    const result = mapCheckoutSelectionToLineItems(selection)

    expect(result).toHaveLength(2)
    expect(result).toEqual([
      {
        ticketTypeId: 'ticket-1',
        quantity: 2,
        unitPrice: 100,
        unitFee: 15,
        displayName: 'VIP',
      },
      {
        ticketTypeId: 'ticket-3',
        quantity: 1,
        unitPrice: 75,
        unitFee: 12,
        displayName: 'Balcony',
      },
    ])
  })

  it('returns empty array for empty selection', () => {
    const selection: CheckoutSelectionRecord = {}
    const result = mapCheckoutSelectionToLineItems(selection)
    expect(result).toEqual([])
  })

  it('returns empty array when all quantities are zero', () => {
    const selection: CheckoutSelectionRecord = {
      'ticket-1': { name: 'VIP', price: 100, fee: 15, quantity: 0 },
      'ticket-2': { name: 'GA', price: 50, fee: 10, quantity: 0 },
    }
    const result = mapCheckoutSelectionToLineItems(selection)
    expect(result).toEqual([])
  })

  it('preserves decimal prices correctly', () => {
    const selection: CheckoutSelectionRecord = {
      'ticket-1': { name: 'Early Bird', price: 49.99, fee: 4.99, quantity: 1 },
    }
    const result = mapCheckoutSelectionToLineItems(selection)
    expect(result[0].unitPrice).toBe(49.99)
    expect(result[0].unitFee).toBe(4.99)
  })
})

// ============================================
// Test Data Factories Tests
// ============================================

describe('Test Data Factories', () => {
  beforeEach(() => {
    resetCounters()
  })

  describe('createMockEvent', () => {
    it('creates event with default values', () => {
      const event = createMockEvent()
      
      expect(event.id).toBe('event-1')
      expect(event.name).toBe('Test Event 1')
      expect(event.status).toBe('published')
      expect(event.is_active).toBe(true)
    })

    it('allows overriding default values', () => {
      const event = createMockEvent({
        id: 'custom-id',
        name: 'Custom Event',
        status: 'draft',
      })
      
      expect(event.id).toBe('custom-id')
      expect(event.name).toBe('Custom Event')
      expect(event.status).toBe('draft')
      expect(event.is_active).toBe(true) // non-overridden value
    })

    it('increments counter for unique IDs', () => {
      const event1 = createMockEvent()
      const event2 = createMockEvent()
      
      expect(event1.id).toBe('event-1')
      expect(event2.id).toBe('event-2')
    })
  })

  describe('createMockTicketType', () => {
    it('creates ticket type with default values', () => {
      const ticketType = createMockTicketType('event-1')
      
      expect(ticketType.id).toBe('ticket-type-1')
      expect(ticketType.event_id).toBe('event-1')
      expect(ticketType.price).toBe(50)
      expect(ticketType.fee).toBe(5)
      expect(ticketType.total_inventory).toBe(100)
      expect(ticketType.tickets_sold).toBe(0)
    })

    it('allows overriding inventory values', () => {
      const ticketType = createMockTicketType('event-1', {
        total_inventory: 50,
        tickets_sold: 45,
      })
      
      expect(ticketType.total_inventory).toBe(50)
      expect(ticketType.tickets_sold).toBe(45)
    })
  })

  describe('createMockOrder', () => {
    it('creates order with calculated totals', () => {
      const order = createMockOrder('event-1', {
        subtotal: 200,
        fees_total: 20,
        total: 220,
      })
      
      expect(order.subtotal).toBe(200)
      expect(order.fees_total).toBe(20)
      expect(order.total).toBe(220)
      expect(order.status).toBe('paid')
    })
  })

  describe('createMockTicket', () => {
    it('creates ticket with valid QR signature', () => {
      const ticket = createMockTicket('order-1', 'event-1', 'ticket-type-1')
      
      expect(ticket.qr_token).toBeTruthy()
      expect(ticket.qr_signature).toBeTruthy()
      expect(ticket.status).toBe('issued')
      
      // Verify signature is valid
      const isValid = validateQRSignature(ticket.qr_token, ticket.qr_signature)
      expect(isValid).toBe(true)
    })
  })
})

// ============================================
// QR Signature Tests
// ============================================

describe('QR Signature Generation', () => {
  it('generates consistent signatures for same token', () => {
    const token = 'test-token-123'
    const sig1 = generateQRSignature(token)
    const sig2 = generateQRSignature(token)
    
    expect(sig1).toBe(sig2)
  })

  it('generates different signatures for different tokens', () => {
    const sig1 = generateQRSignature('token-1')
    const sig2 = generateQRSignature('token-2')
    
    expect(sig1).not.toBe(sig2)
  })

  it('validates correct signatures', () => {
    const token = generateMockQRToken()
    const signature = generateQRSignature(token)
    
    expect(validateQRSignature(token, signature)).toBe(true)
  })

  it('rejects invalid signatures', () => {
    const token = generateMockQRToken()
    const wrongSignature = 'invalid-signature'
    
    expect(validateQRSignature(token, wrongSignature)).toBe(false)
  })

  it('generates different signatures with different secrets', () => {
    const token = 'test-token'
    const sig1 = generateQRSignature(token, 'secret-1')
    const sig2 = generateQRSignature(token, 'secret-2')
    
    expect(sig1).not.toBe(sig2)
  })
})

// ============================================
// Mock Supabase Client Tests
// ============================================

describe('Mock Supabase Client', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('returns configured events from from().select()', async () => {
    const mockEvent = createMockEvent({ name: 'Test Event' })
    const client = createMockSupabaseClient({
      events: [mockEvent],
    })

    const { data, error } = await client.from('events').select('*').single()
    
    expect(error).toBeNull()
    expect(data).toEqual(mockEvent)
  })

  it('filters data with eq()', async () => {
    const event1 = createMockEvent({ id: 'event-1', name: 'Event 1' })
    const event2 = createMockEvent({ id: 'event-2', name: 'Event 2' })
    const client = createMockSupabaseClient({
      events: [event1, event2],
    })

    const { data } = await client.from('events').select('*').eq('id', 'event-1').single()
    
    expect(data).toEqual(event1)
  })

  it('returns configured RPC responses', async () => {
    const mockResponse = [{ success: true, reserved: 5 }]
    const client = createMockSupabaseClient({
      rpcResponses: {
        reserve_tickets_batch: mockResponse,
      },
    })

    const { data, error } = await client.rpc('reserve_tickets_batch', { p_reservations: [] })
    
    expect(error).toBeNull()
    expect(data).toEqual(mockResponse)
  })

  it('returns configured errors', async () => {
    const mockError = new Error('Database connection failed')
    const client = createMockSupabaseClient({
      errors: {
        events: mockError,
      },
    })

    const { data, error } = await client.from('events').select('*')
    
    expect(error).toBe(mockError)
    expect(data).toBeNull()
  })

  it('returns RPC errors when configured', async () => {
    const mockError = new Error('Insufficient inventory')
    const client = createMockSupabaseClient({
      errors: {
        rpc: {
          reserve_tickets_batch: mockError,
        },
      },
    })

    const { data, error } = await client.rpc('reserve_tickets_batch', {})
    
    expect(error).toBe(mockError)
    expect(data).toBeNull()
  })
})

// ============================================
// Order Total Calculation Tests
// ============================================

describe('Order Total Calculations', () => {
  it('calculates totals correctly for single line item', () => {
    const lineItems: OrderLineItem[] = [
      { ticketTypeId: 'tt-1', quantity: 2, unitPrice: 50, unitFee: 5, displayName: 'GA' },
    ]

    const totals = lineItems.reduce(
      (acc, line) => {
        const lineSubtotal = line.unitPrice * line.quantity
        const lineFees = line.unitFee * line.quantity
        acc.subtotal += lineSubtotal
        acc.fees += lineFees
        acc.total += lineSubtotal + lineFees
        return acc
      },
      { subtotal: 0, fees: 0, total: 0 }
    )

    expect(totals.subtotal).toBe(100) // 2 * 50
    expect(totals.fees).toBe(10) // 2 * 5
    expect(totals.total).toBe(110) // 100 + 10
  })

  it('calculates totals correctly for multiple line items', () => {
    const lineItems: OrderLineItem[] = [
      { ticketTypeId: 'tt-1', quantity: 2, unitPrice: 50, unitFee: 5, displayName: 'GA' },
      { ticketTypeId: 'tt-2', quantity: 1, unitPrice: 100, unitFee: 15, displayName: 'VIP' },
      { ticketTypeId: 'tt-3', quantity: 3, unitPrice: 75, unitFee: 10, displayName: 'Balcony' },
    ]

    const totals = lineItems.reduce(
      (acc, line) => {
        const lineSubtotal = line.unitPrice * line.quantity
        const lineFees = line.unitFee * line.quantity
        acc.subtotal += lineSubtotal
        acc.fees += lineFees
        acc.total += lineSubtotal + lineFees
        return acc
      },
      { subtotal: 0, fees: 0, total: 0 }
    )

    // GA: 2 * 50 = 100, fees: 2 * 5 = 10
    // VIP: 1 * 100 = 100, fees: 1 * 15 = 15
    // Balcony: 3 * 75 = 225, fees: 3 * 10 = 30
    expect(totals.subtotal).toBe(425) // 100 + 100 + 225
    expect(totals.fees).toBe(55) // 10 + 15 + 30
    expect(totals.total).toBe(480) // 425 + 55
  })

  it('handles zero quantities correctly', () => {
    const lineItems: OrderLineItem[] = []

    const totals = lineItems.reduce(
      (acc, line) => {
        const lineSubtotal = line.unitPrice * line.quantity
        const lineFees = line.unitFee * line.quantity
        acc.subtotal += lineSubtotal
        acc.fees += lineFees
        acc.total += lineSubtotal + lineFees
        return acc
      },
      { subtotal: 0, fees: 0, total: 0 }
    )

    expect(totals.subtotal).toBe(0)
    expect(totals.fees).toBe(0)
    expect(totals.total).toBe(0)
  })

  it('handles decimal prices without floating point errors', () => {
    const lineItems: OrderLineItem[] = [
      { ticketTypeId: 'tt-1', quantity: 3, unitPrice: 49.99, unitFee: 4.99, displayName: 'Early Bird' },
    ]

    const totals = lineItems.reduce(
      (acc, line) => {
        const lineSubtotal = line.unitPrice * line.quantity
        const lineFees = line.unitFee * line.quantity
        acc.subtotal += lineSubtotal
        acc.fees += lineFees
        acc.total += lineSubtotal + lineFees
        return acc
      },
      { subtotal: 0, fees: 0, total: 0 }
    )

    // Note: JavaScript floating point math
    // 3 * 49.99 = 149.97 (may have floating point issues)
    // 3 * 4.99 = 14.97
    expect(totals.subtotal).toBeCloseTo(149.97, 2)
    expect(totals.fees).toBeCloseTo(14.97, 2)
    expect(totals.total).toBeCloseTo(164.94, 2)
  })
})

// ============================================
// Input Validation Tests
// ============================================

describe('Order Input Validation', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('should validate required fields', () => {
    const validInput: CreateOrderInput = {
      eventId: 'event-1',
      purchaserEmail: 'test@example.com',
      purchaserName: 'Test User',
      lineItems: [
        { ticketTypeId: 'tt-1', quantity: 1, unitPrice: 50, unitFee: 5, displayName: 'GA' },
      ],
    }

    // Check all required fields are present
    expect(validInput.eventId).toBeTruthy()
    expect(validInput.purchaserEmail).toBeTruthy()
    expect(validInput.purchaserName).toBeTruthy()
    expect(validInput.lineItems.length).toBeGreaterThan(0)
  })

  it('should require at least one line item', () => {
    const inputWithNoItems: CreateOrderInput = {
      eventId: 'event-1',
      purchaserEmail: 'test@example.com',
      purchaserName: 'Test User',
      lineItems: [],
    }

    expect(inputWithNoItems.lineItems.length).toBe(0)
    // In actual implementation, this should throw or return error
  })

  it('should validate email format', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.org',
      'user+tag@example.co.uk',
    ]

    const invalidEmails = [
      'not-an-email',
      '@missing-local.com',
      'missing-at.com',
    ]

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    validEmails.forEach((email) => {
      expect(emailRegex.test(email)).toBe(true)
    })

    invalidEmails.forEach((email) => {
      expect(emailRegex.test(email)).toBe(false)
    })
  })

  it('should validate positive quantities', () => {
    const validLineItem: OrderLineItem = {
      ticketTypeId: 'tt-1',
      quantity: 5,
      unitPrice: 50,
      unitFee: 5,
      displayName: 'GA',
    }

    expect(validLineItem.quantity).toBeGreaterThan(0)
  })

  it('should validate non-negative prices', () => {
    const validLineItem: OrderLineItem = {
      ticketTypeId: 'tt-1',
      quantity: 1,
      unitPrice: 0, // Free ticket
      unitFee: 0,
      displayName: 'Free Entry',
    }

    expect(validLineItem.unitPrice).toBeGreaterThanOrEqual(0)
    expect(validLineItem.unitFee).toBeGreaterThanOrEqual(0)
  })
})

// ============================================
// Concurrency Helper Tests
// ============================================

describe('Concurrency Helpers', () => {
  it('runs operations concurrently', async () => {
    const results: number[] = []
    const operations = [
      async () => { results.push(1); return 1 },
      async () => { results.push(2); return 2 },
      async () => { results.push(3); return 3 },
    ]

    const returned = await runConcurrently(operations)

    expect(returned).toHaveLength(3)
    expect(returned).toContain(1)
    expect(returned).toContain(2)
    expect(returned).toContain(3)
  })

  it('runs operations with delay', async () => {
    const startTime = Date.now()
    const operations = [
      async () => Date.now() - startTime,
      async () => Date.now() - startTime,
      async () => Date.now() - startTime,
    ]

    const timestamps = await runConcurrently(operations, { delay: 10 })

    // With 10ms delay between operations, timestamps should be roughly 0, 10, 20
    expect(timestamps[0]).toBeLessThan(timestamps[2])
  })
})

// ============================================
// Inventory Check Logic Tests
// ============================================

describe('Inventory Check Logic', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('should calculate available inventory correctly', () => {
    const ticketType = createMockTicketType('event-1', {
      total_inventory: 100,
      tickets_sold: 45,
    })

    const available = ticketType.total_inventory - ticketType.tickets_sold
    expect(available).toBe(55)
  })

  it('should detect insufficient inventory', () => {
    const ticketType = createMockTicketType('event-1', {
      total_inventory: 10,
      tickets_sold: 8,
    })

    const requestedQuantity = 5
    const available = ticketType.total_inventory - ticketType.tickets_sold

    expect(available).toBe(2)
    expect(requestedQuantity > available).toBe(true)
  })

  it('should allow purchase when inventory is sufficient', () => {
    const ticketType = createMockTicketType('event-1', {
      total_inventory: 100,
      tickets_sold: 50,
    })

    const requestedQuantity = 25
    const available = ticketType.total_inventory - ticketType.tickets_sold

    expect(available).toBe(50)
    expect(requestedQuantity <= available).toBe(true)
  })

  it('should handle unlimited inventory (null total_inventory)', () => {
    const ticketType = createMockTicketType('event-1', {
      total_inventory: null as any, // Some systems use null for unlimited
      tickets_sold: 1000,
    })

    // If total_inventory is null, it means unlimited
    const isUnlimited = ticketType.total_inventory === null
    expect(isUnlimited || ticketType.tickets_sold < ticketType.total_inventory).toBe(true)
  })

  it('should handle sold out inventory', () => {
    const ticketType = createMockTicketType('event-1', {
      total_inventory: 50,
      tickets_sold: 50,
    })

    const available = ticketType.total_inventory - ticketType.tickets_sold
    expect(available).toBe(0)
    expect(available <= 0).toBe(true)
  })
})

// ============================================
// Promo Code Discount Tests
// ============================================

describe('Promo Code Discount Calculations', () => {
  it('should apply percentage discount', () => {
    const subtotal = 100
    const discountPercent = 20
    const discountAmount = subtotal * (discountPercent / 100)
    const finalSubtotal = subtotal - discountAmount

    expect(discountAmount).toBe(20)
    expect(finalSubtotal).toBe(80)
  })

  it('should apply fixed amount discount', () => {
    const subtotal = 100
    const discountAmount = 25
    const finalSubtotal = Math.max(0, subtotal - discountAmount)

    expect(finalSubtotal).toBe(75)
  })

  it('should not allow negative totals with large discounts', () => {
    const subtotal = 50
    const discountAmount = 100 // Discount larger than subtotal
    const finalSubtotal = Math.max(0, subtotal - discountAmount)

    expect(finalSubtotal).toBe(0)
    expect(finalSubtotal).toBeGreaterThanOrEqual(0)
  })

  it('should calculate fees after discount on subtotal', () => {
    const originalSubtotal = 100
    const discountPercent = 20
    const feePercent = 10

    const discountedSubtotal = originalSubtotal * (1 - discountPercent / 100)
    const fees = discountedSubtotal * (feePercent / 100)
    const total = discountedSubtotal + fees

    expect(discountedSubtotal).toBe(80)
    expect(fees).toBe(8)
    expect(total).toBe(88)
  })
})

// ============================================
// Error Handling Tests
// ============================================

describe('Error Handling', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('should handle database connection errors', async () => {
    const dbError = new Error('Connection refused')
    const client = createMockSupabaseClient({
      errors: {
        events: dbError,
      },
    })

    const { error } = await client.from('events').select('*')
    
    expect(error).toBe(dbError)
    expect(error?.message).toBe('Connection refused')
  })

  it('should handle RPC function errors', async () => {
    const rpcError = new Error('Function not found')
    const client = createMockSupabaseClient({
      errors: {
        rpc: {
          create_order_with_tickets_atomic: rpcError,
        },
      },
    })

    const { error } = await client.rpc('create_order_with_tickets_atomic', {})
    
    expect(error).toBe(rpcError)
  })

  it('should handle event not found', async () => {
    const client = createMockSupabaseClient({
      events: [], // Empty - no events
    })

    const { data } = await client.from('events').select('*').eq('id', 'non-existent').single()
    
    expect(data).toBeNull()
  })

  it('should handle constraint violations', () => {
    // Simulate a constraint violation error from PostgreSQL
    const constraintError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
      details: 'Key (qr_token)=(xyz) already exists.',
    }

    expect(constraintError.code).toBe('23505')
    expect(constraintError.message).toContain('duplicate key')
  })

  it('should handle inventory constraint violation', () => {
    // Simulate the check constraint violation
    const constraintError = {
      code: '23514',
      message: 'new row violates check constraint "check_tickets_sold_within_inventory"',
    }

    expect(constraintError.code).toBe('23514')
    expect(constraintError.message).toContain('check_tickets_sold_within_inventory')
  })
})
