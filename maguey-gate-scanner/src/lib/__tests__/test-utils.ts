/**
 * Test Utilities for Scanner Service Tests
 * 
 * Provides mock factories and helpers for unit testing
 */

import { vi } from 'vitest'

// ============================================
// TYPES
// ============================================

export interface MockEvent {
  id: string
  name: string
  event_date: string
  event_time: string
  venue_name: string
  city: string | null
}

export interface MockTicketType {
  id: string
  name: string
  price: number
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
  nfc_tag_id: string | null
  nfc_signature: string | null
  status: 'issued' | 'scanned' | 'cancelled' | 'refunded'
  scanned_at: string | null
  issued_at: string
  current_status: 'outside' | 'inside' | null
  entry_count: number
  exit_count: number
  last_entry_at: string | null
  last_exit_at: string | null
  tier: string | null
  ticket_type: string | null
  event_name: string | null
}

export interface MockScanLog {
  id: string
  ticket_id: string
  scan_result: 'valid' | 'invalid' | 'already_scanned'
  scanned_at: string
  scanned_by: string | null
  scan_duration_ms: number | null
  scan_method: 'qr' | 'nfc' | 'manual'
  override_used: boolean
  override_reason: string | null
  metadata: Record<string, unknown> | null
}

// ============================================
// MOCK DATA FACTORIES
// ============================================

let eventCounter = 0
let ticketTypeCounter = 0
let ticketCounter = 0
let scanLogCounter = 0

/**
 * Reset all counters (call in beforeEach)
 */
export function resetCounters(): void {
  eventCounter = 0
  ticketTypeCounter = 0
  ticketCounter = 0
  scanLogCounter = 0
}

/**
 * Create a mock event
 */
export function createMockEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  const id = overrides.id ?? `event-${++eventCounter}`
  
  return {
    id,
    name: `Test Event ${eventCounter}`,
    event_date: '2025-06-15',
    event_time: '21:00:00',
    venue_name: 'Test Venue',
    city: 'Test City',
    ...overrides,
  }
}

/**
 * Create a mock ticket type
 */
export function createMockTicketType(overrides: Partial<MockTicketType> = {}): MockTicketType {
  const id = overrides.id ?? `ticket-type-${++ticketTypeCounter}`
  
  return {
    id,
    name: `Ticket Type ${ticketTypeCounter}`,
    price: 50,
    ...overrides,
  }
}

/**
 * Create a mock ticket with valid QR signature
 */
export function createMockTicket(overrides: Partial<MockTicket> = {}): MockTicket {
  const id = overrides.id ?? `ticket-${++ticketCounter}`
  const qrToken = overrides.qr_token ?? generateMockQRToken()
  const now = new Date().toISOString()
  
  return {
    id,
    order_id: `order-${ticketCounter}`,
    event_id: `event-1`,
    ticket_type_id: `ticket-type-1`,
    attendee_name: `Attendee ${ticketCounter}`,
    attendee_email: `attendee${ticketCounter}@example.com`,
    qr_token: qrToken,
    qr_signature: '', // Will be set by createMockTicketAsync or overrides
    nfc_tag_id: null,
    nfc_signature: null,
    status: 'issued',
    scanned_at: null,
    issued_at: now,
    current_status: 'outside',
    entry_count: 0,
    exit_count: 0,
    last_entry_at: null,
    last_exit_at: null,
    tier: null,
    ticket_type: null,
    event_name: null,
    ...overrides,
  }
}

/**
 * Create a mock ticket with valid async QR signature
 */
export async function createMockTicketAsync(overrides: Partial<MockTicket> = {}): Promise<MockTicket> {
  const ticket = createMockTicket(overrides)
  if (!overrides.qr_signature) {
    ticket.qr_signature = await generateQRSignature(ticket.qr_token)
  }
  return ticket
}

/**
 * Create a mock scan log
 */
export function createMockScanLog(
  ticketId: string,
  overrides: Partial<MockScanLog> = {}
): MockScanLog {
  const id = overrides.id ?? `scan-log-${++scanLogCounter}`
  const now = new Date().toISOString()
  
  return {
    id,
    ticket_id: ticketId,
    scan_result: 'valid',
    scanned_at: now,
    scanned_by: null,
    scan_duration_ms: 45,
    scan_method: 'qr',
    override_used: false,
    override_reason: null,
    metadata: null,
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
export async function generateQRSignature(qrToken: string, secret: string = TEST_QR_SECRET): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(qrToken))
  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
}

/**
 * Validate a QR signature
 */
export async function validateQRSignature(
  qrToken: string,
  signature: string | null | undefined,
  secret: string = TEST_QR_SECRET
): Promise<boolean> {
  if (!qrToken || !signature) {
    return false
  }
  const expected = await generateQRSignature(qrToken, secret)
  return signature === expected
}

/**
 * Redact a token for logging (shows first N characters)
 */
export function redactToken(token: string, visibleChars: number = 8): string {
  if (!token || token.length <= visibleChars) {
    return '***'
  }
  return token.substring(0, visibleChars) + '...'
}

// ============================================
// MOCK SUPABASE CLIENT FACTORY
// ============================================

export interface MockSupabaseConfig {
  tickets?: MockTicket[]
  events?: MockEvent[]
  ticketTypes?: MockTicketType[]
  scanLogs?: MockScanLog[]
  rpcResponses?: Record<string, unknown>
  errors?: {
    tickets?: Error | null
    events?: Error | null
    ticketTypes?: Error | null
    scanLogs?: Error | null
    rpc?: Record<string, Error | null>
  }
}

/**
 * Create a mock Supabase client for testing scanner operations
 */
export function createMockSupabaseClient(config: MockSupabaseConfig = {}) {
  const {
    tickets = [],
    events = [],
    ticketTypes = [],
    scanLogs = [],
    rpcResponses = {},
    errors = {},
  } = config

  // Track inserted data for verification
  const insertedData: { table: string; data: unknown[] }[] = []

  // Helper to create chainable query builder
  const createQueryBuilder = <T>(data: T[], error: Error | null = null, tableName: string = '') => {
    let filteredData = [...data]
    let selectedData: T[] | T | null = filteredData
    let isSingle = false

    const builder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockImplementation((newData: T | T[]) => {
        const items = Array.isArray(newData) ? newData : [newData]
        insertedData.push({ table: tableName, data: items })
        filteredData = [...filteredData, ...items]
        selectedData = items
        return builder
      }),
      update: vi.fn().mockImplementation((updates: Partial<T>) => {
        // Apply updates to filtered data
        filteredData = filteredData.map((item) => ({ ...item, ...updates }))
        selectedData = isSingle ? (filteredData[0] ?? null) : filteredData
        return builder
      }),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((column: string, value: unknown) => {
        filteredData = filteredData.filter((item: any) => item[column] === value)
        selectedData = isSingle ? (filteredData[0] ?? null) : filteredData
        return builder
      }),
      neq: vi.fn().mockReturnThis(),
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
        case 'tickets':
          return createQueryBuilder(tickets, errors.tickets ?? null, 'tickets')
        case 'events':
          return createQueryBuilder(events, errors.events ?? null, 'events')
        case 'ticket_types':
          return createQueryBuilder(ticketTypes, errors.ticketTypes ?? null, 'ticket_types')
        case 'scan_logs':
          return createQueryBuilder(scanLogs, errors.scanLogs ?? null, 'scan_logs')
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
    // Helper to check what was inserted
    _getInsertedData: () => insertedData,
  }

  return mockClient
}

// ============================================
// TIMING HELPERS
// ============================================

/**
 * Create a mock performance timer
 */
export function createMockTimer() {
  let currentTime = 0
  
  return {
    now: () => currentTime,
    advance: (ms: number) => {
      currentTime += ms
    },
    reset: () => {
      currentTime = 0
    },
  }
}

/**
 * Wait for a specified duration (useful for async tests)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================
// ASSERTION HELPERS
// ============================================

/**
 * Assert scan result is successful
 */
export function expectValidScan(result: { success: boolean; error?: string }) {
  if (!result.success) {
    throw new Error(`Expected valid scan but got error: ${result.error}`)
  }
}

/**
 * Assert scan result is an error
 */
export function expectInvalidScan(result: { success: boolean; error?: string }, expectedError?: string) {
  if (result.success) {
    throw new Error('Expected invalid scan but got success')
  }
  if (expectedError && result.error !== expectedError) {
    throw new Error(`Expected error "${expectedError}" but got "${result.error}"`)
  }
}
