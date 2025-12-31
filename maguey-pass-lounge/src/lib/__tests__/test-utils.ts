/**
 * Test Utilities for Orders Service Tests
 * 
 * Provides mock factories and helpers for unit testing
 */

import { vi } from 'vitest'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils'

// ============================================
// TYPES
// ============================================

export interface MockEvent {
  id: string
  name: string
  description: string | null
  image_url: string | null
  event_date: string
  event_time: string
  venue_name: string
  venue_address: string | null
  city: string | null
  status: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MockTicketType {
  id: string
  event_id: string
  name: string
  description: string | null
  price: number
  fee: number
  total_inventory: number
  tickets_sold: number
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface MockOrder {
  id: string
  event_id: string
  purchaser_email: string
  purchaser_name: string
  user_id: string | null
  subtotal: number
  fees_total: number
  total: number
  status: string
  promo_code_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface MockTicket {
  id: string
  order_id: string
  event_id: string
  ticket_type_id: string
  attendee_name: string
  attendee_email: string | null
  qr_token: string
  qr_signature: string
  status: string
  scanned_at: string | null
  issued_at: string
  human_readable_id: string | null
  tier: string | null
  ticket_type: string | null
  event_name: string | null
}

// ============================================
// MOCK DATA FACTORIES
// ============================================

let eventCounter = 0
let ticketTypeCounter = 0
let orderCounter = 0
let ticketCounter = 0

/**
 * Reset all counters (call in beforeEach)
 */
export function resetCounters(): void {
  eventCounter = 0
  ticketTypeCounter = 0
  orderCounter = 0
  ticketCounter = 0
}

/**
 * Create a mock event with sensible defaults
 */
export function createMockEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  const id = overrides.id ?? `event-${++eventCounter}`
  const now = new Date().toISOString()
  
  return {
    id,
    name: `Test Event ${eventCounter}`,
    description: 'A test event for unit testing',
    image_url: 'https://example.com/image.jpg',
    event_date: '2025-06-15',
    event_time: '21:00:00',
    venue_name: 'Test Venue',
    venue_address: '123 Test Street',
    city: 'Test City',
    status: 'published',
    is_active: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

/**
 * Create a mock ticket type with sensible defaults
 */
export function createMockTicketType(
  eventId: string,
  overrides: Partial<MockTicketType> = {}
): MockTicketType {
  const id = overrides.id ?? `ticket-type-${++ticketTypeCounter}`
  const now = new Date().toISOString()
  
  return {
    id,
    event_id: eventId,
    name: `Ticket Type ${ticketTypeCounter}`,
    description: null,
    price: 50,
    fee: 5,
    total_inventory: 100,
    tickets_sold: 0,
    is_active: true,
    sort_order: ticketTypeCounter,
    created_at: now,
    ...overrides,
  }
}

/**
 * Create a mock order with sensible defaults
 */
export function createMockOrder(
  eventId: string,
  overrides: Partial<MockOrder> = {}
): MockOrder {
  const id = overrides.id ?? `order-${++orderCounter}`
  const now = new Date().toISOString()
  
  return {
    id,
    event_id: eventId,
    purchaser_email: `test${orderCounter}@example.com`,
    purchaser_name: `Test User ${orderCounter}`,
    user_id: null,
    subtotal: 100,
    fees_total: 10,
    total: 110,
    status: 'paid',
    promo_code_id: null,
    metadata: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

/**
 * Create a mock ticket with sensible defaults
 */
export function createMockTicket(
  orderId: string,
  eventId: string,
  ticketTypeId: string,
  overrides: Partial<MockTicket> = {}
): MockTicket {
  const id = overrides.id ?? `ticket-${++ticketCounter}`
  const qrToken = overrides.qr_token ?? generateMockQRToken()
  const now = new Date().toISOString()
  
  return {
    id,
    order_id: orderId,
    event_id: eventId,
    ticket_type_id: ticketTypeId,
    attendee_name: `Attendee ${ticketCounter}`,
    attendee_email: `attendee${ticketCounter}@example.com`,
    qr_token: qrToken,
    qr_signature: generateQRSignature(qrToken),
    status: 'issued',
    scanned_at: null,
    issued_at: now,
    human_readable_id: `TKT-${ticketCounter.toString().padStart(6, '0')}`,
    tier: null,
    ticket_type: null,
    event_name: null,
    ...overrides,
  }
}

// ============================================
// QR CODE HELPERS
// ============================================

const TEST_QR_SECRET = 'test-qr-signing-secret-for-unit-tests'

/**
 * Generate a mock QR token (UUID-like)
 */
export function generateMockQRToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Generate a valid QR signature for testing
 */
export function generateQRSignature(qrToken: string, secret: string = TEST_QR_SECRET): string {
  const keyBytes = utf8ToBytes(secret)
  const tokenBytes = utf8ToBytes(qrToken)
  return bytesToHex(hmac(sha256, keyBytes, tokenBytes))
}

/**
 * Validate a QR signature (for test assertions)
 */
export function validateQRSignature(
  qrToken: string,
  signature: string,
  secret: string = TEST_QR_SECRET
): boolean {
  const expected = generateQRSignature(qrToken, secret)
  return signature.toLowerCase() === expected.toLowerCase()
}

// ============================================
// MOCK SUPABASE CLIENT FACTORY
// ============================================

export interface MockSupabaseConfig {
  events?: MockEvent[]
  ticketTypes?: MockTicketType[]
  orders?: MockOrder[]
  tickets?: MockTicket[]
  rpcResponses?: Record<string, unknown>
  errors?: {
    events?: Error | null
    ticketTypes?: Error | null
    orders?: Error | null
    tickets?: Error | null
    rpc?: Record<string, Error | null>
  }
}

/**
 * Create a mock Supabase client for testing
 */
export function createMockSupabaseClient(config: MockSupabaseConfig = {}) {
  const {
    events = [],
    ticketTypes = [],
    orders = [],
    tickets = [],
    rpcResponses = {},
    errors = {},
  } = config

  // Helper to create chainable query builder
  const createQueryBuilder = <T>(data: T[], error: Error | null = null) => {
    let filteredData = [...data]
    let selectedData: T[] | T | null = filteredData
    let isSingle = false

    const builder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockImplementation((newData: T | T[]) => {
        const items = Array.isArray(newData) ? newData : [newData]
        filteredData = [...filteredData, ...items]
        selectedData = items
        return builder
      }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((column: string, value: unknown) => {
        filteredData = filteredData.filter((item: any) => item[column] === value)
        selectedData = isSingle ? (filteredData[0] ?? null) : filteredData
        return builder
      }),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockImplementation((column: string, values: unknown[]) => {
        filteredData = filteredData.filter((item: any) => values.includes(item[column]))
        selectedData = isSingle ? (filteredData[0] ?? null) : filteredData
        return builder
      }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        isSingle = true
        selectedData = filteredData[0] ?? null
        return builder
      }),
      maybeSingle: vi.fn().mockImplementation(() => {
        isSingle = true
        selectedData = filteredData[0] ?? null
        return builder
      }),
      then: vi.fn().mockImplementation((resolve: (result: { data: T[] | T | null; error: Error | null }) => void) => {
        resolve({ data: error ? null : selectedData, error })
      }),
    }

    // Make it thenable
    Object.defineProperty(builder, 'then', {
      value: (resolve: (result: { data: T[] | T | null; error: Error | null }) => void) => {
        return Promise.resolve({ data: error ? null : selectedData, error }).then(resolve)
      },
    })

    return builder
  }

  const mockClient = {
    from: vi.fn().mockImplementation((table: string) => {
      switch (table) {
        case 'events':
          return createQueryBuilder(events, errors.events ?? null)
        case 'ticket_types':
          return createQueryBuilder(ticketTypes, errors.ticketTypes ?? null)
        case 'orders':
          return createQueryBuilder(orders, errors.orders ?? null)
        case 'tickets':
          return createQueryBuilder(tickets, errors.tickets ?? null)
        default:
          return createQueryBuilder([])
      }
    }),
    rpc: vi.fn().mockImplementation((functionName: string, params?: Record<string, unknown>) => {
      const error = errors.rpc?.[functionName] ?? null
      const response = rpcResponses[functionName]
      
      return Promise.resolve({
        data: error ? null : response,
        error,
      })
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  }

  return mockClient
}

// ============================================
// ASSERTION HELPERS
// ============================================

/**
 * Assert that a result is successful
 */
export function expectOk<T, E>(result: { success: boolean; data?: T; error?: E }): asserts result is { success: true; data: T } {
  if (!result.success) {
    throw new Error(`Expected success but got error: ${JSON.stringify(result.error)}`)
  }
}

/**
 * Assert that a result is an error
 */
export function expectErr<T, E>(result: { success: boolean; data?: T; error?: E }): asserts result is { success: false; error: E } {
  if (result.success) {
    throw new Error(`Expected error but got success: ${JSON.stringify(result.data)}`)
  }
}

// ============================================
// CONCURRENCY HELPERS
// ============================================

/**
 * Run multiple async operations concurrently
 * Useful for testing race conditions
 */
export async function runConcurrently<T>(
  operations: (() => Promise<T>)[],
  options: { delay?: number } = {}
): Promise<T[]> {
  const { delay = 0 } = options
  
  if (delay > 0) {
    // Stagger the operations slightly
    const promises = operations.map((op, index) =>
      new Promise<T>((resolve) =>
        setTimeout(async () => resolve(await op()), index * delay)
      )
    )
    return Promise.all(promises)
  }
  
  return Promise.all(operations.map((op) => op()))
}

/**
 * Create a deferred promise for controlling async flow in tests
 */
export function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  
  return { promise, resolve, reject }
}

// ============================================
// TIME HELPERS
// ============================================

/**
 * Create a mock timer that can be controlled in tests
 */
export function createMockTimer() {
  const originalDateNow = Date.now
  let currentTime = Date.now()
  
  return {
    install: () => {
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
    },
    advance: (ms: number) => {
      currentTime += ms
    },
    setTime: (time: number) => {
      currentTime = time
    },
    restore: () => {
      vi.spyOn(Date, 'now').mockRestore()
    },
  }
}
