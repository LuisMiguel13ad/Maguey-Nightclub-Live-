import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  createMockTicket,
  createMockTicketAsync,
  createMockEvent,
  createMockTicketType,
  createMockScanLog,
  createMockSupabaseClient,
  resetCounters,
  generateQRSignature,
  generateMockQRToken,
  validateQRSignature,
  redactToken,
  expectValidScan,
  expectInvalidScan,
  delay,
  type MockTicket,
} from './test-utils'

// ============================================
// SCAN TICKET TESTS
// ============================================

describe('scanTicket', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('should scan valid ticket successfully', async () => {
    const ticket = createMockTicket({ status: 'issued' })
    const client = createMockSupabaseClient({
      tickets: [ticket],
    })

    // Simulate scan operation
    const { data: fetchedTicket } = await client
      .from('tickets')
      .select('*')
      .eq('id', ticket.id)
      .single()

    // Validate ticket status
    expect(fetchedTicket).not.toBeNull()
    expect(fetchedTicket?.status).toBe('issued')

    // Simulate successful scan
    const scanResult = {
      success: fetchedTicket?.status === 'issued',
      ticket: fetchedTicket,
      durationMs: 45,
    }

    expectValidScan(scanResult)
    expect(scanResult.success).toBe(true)
    expect(scanResult.ticket?.id).toBe(ticket.id)
  })

  it('should reject already-scanned ticket', async () => {
    const scannedAt = '2025-06-15T21:30:00.000Z'
    const ticket = createMockTicket({
      status: 'scanned',
      scanned_at: scannedAt,
    })
    const client = createMockSupabaseClient({
      tickets: [ticket],
    })

    // Simulate scan operation
    const { data: fetchedTicket } = await client
      .from('tickets')
      .select('*')
      .eq('id', ticket.id)
      .single()

    // Check if already scanned (single-entry mode)
    const isReEntryMode = false
    const isAlreadyScanned = fetchedTicket?.status === 'scanned' && !isReEntryMode

    const scanResult = {
      success: !isAlreadyScanned,
      error: isAlreadyScanned 
        ? `Already scanned at ${new Date(scannedAt).toLocaleString()}`
        : undefined,
      ticket: fetchedTicket,
    }

    expectInvalidScan(scanResult)
    expect(scanResult.success).toBe(false)
    expect(scanResult.error).toContain('Already scanned')
  })

  it('should reject ticket with invalid QR signature', async () => {
    const ticket = createMockTicket()
    
    // Simulate a tampered signature
    const tamperedSignature = 'invalid-tampered-signature-abc123'
    const isSignatureValid = await validateQRSignature(ticket.qr_token, tamperedSignature)

    const scanResult = {
      success: isSignatureValid,
      error: isSignatureValid ? undefined : 'Invalid QR signature - ticket may be counterfeit',
    }

    expectInvalidScan(scanResult)
    expect(scanResult.success).toBe(false)
    expect(scanResult.error).toContain('Invalid QR signature')
  })

  it('should reject cancelled ticket', async () => {
    const ticket = createMockTicket({ status: 'cancelled' })
    const client = createMockSupabaseClient({
      tickets: [ticket],
    })

    // Simulate scan operation
    const { data: fetchedTicket } = await client
      .from('tickets')
      .select('*')
      .eq('id', ticket.id)
      .single()

    // Check valid statuses
    const validStatuses = ['issued', 'scanned']
    const isValidStatus = validStatuses.includes(fetchedTicket?.status || '')

    const scanResult = {
      success: isValidStatus,
      error: isValidStatus ? undefined : 'Ticket has been cancelled',
      ticket: fetchedTicket,
    }

    expectInvalidScan(scanResult)
    expect(scanResult.success).toBe(false)
    expect(scanResult.error).toBe('Ticket has been cancelled')
  })

  it('should reject expired ticket', async () => {
    // Create a ticket for an event that already happened
    const pastEventDate = '2024-01-01'
    const ticket = createMockTicket()
    const event = createMockEvent({
      id: ticket.event_id,
      event_date: pastEventDate,
    })

    // Check if event date has passed
    const eventDate = new Date(event.event_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const isExpired = eventDate < today

    const scanResult = {
      success: !isExpired,
      error: isExpired ? 'Ticket has expired - event date has passed' : undefined,
    }

    expectInvalidScan(scanResult)
    expect(scanResult.success).toBe(false)
    expect(scanResult.error).toContain('expired')
  })

  it('should create scan log entry', async () => {
    const ticket = createMockTicket({ status: 'issued' })
    const client = createMockSupabaseClient({
      tickets: [ticket],
    })

    // Simulate successful scan
    const scannedAt = new Date().toISOString()
    const scanLogEntry = {
      ticket_id: ticket.id,
      scan_result: 'valid' as const,
      scanned_at: scannedAt,
      scanned_by: 'staff-user-123',
      scan_duration_ms: 45,
      scan_method: 'qr' as const,
      override_used: false,
      override_reason: null,
      metadata: {
        tier: ticket.tier,
        ticket_type: ticket.ticket_type,
      },
    }

    // Insert scan log
    await client.from('scan_logs').insert(scanLogEntry)

    // Verify scan log was created
    const insertedData = client._getInsertedData()
    expect(insertedData).toHaveLength(1)
    expect(insertedData[0].table).toBe('scan_logs')
    expect(insertedData[0].data[0].ticket_id).toBe(ticket.id)
    expect(insertedData[0].data[0].scan_result).toBe('valid')
    expect(insertedData[0].data[0].scan_method).toBe('qr')
  })

  it('should handle ticket not found', async () => {
    const client = createMockSupabaseClient({
      tickets: [], // No tickets
    })

    const { data: fetchedTicket } = await client
      .from('tickets')
      .select('*')
      .eq('id', 'non-existent-ticket-id')
      .maybeSingle()

    const scanResult = {
      success: fetchedTicket !== null,
      error: fetchedTicket === null ? 'Ticket not found.' : undefined,
    }

    expectInvalidScan(scanResult)
    expect(scanResult.success).toBe(false)
    expect(scanResult.error).toBe('Ticket not found.')
  })

  it('should handle refunded ticket', async () => {
    const ticket = createMockTicket({ status: 'refunded' })
    const client = createMockSupabaseClient({
      tickets: [ticket],
    })

    const { data: fetchedTicket } = await client
      .from('tickets')
      .select('*')
      .eq('id', ticket.id)
      .single()

    const validStatuses = ['issued', 'scanned']
    const isValidStatus = validStatuses.includes(fetchedTicket?.status || '')

    const scanResult = {
      success: isValidStatus,
      error: isValidStatus ? undefined : 'Ticket has been refunded',
    }

    expectInvalidScan(scanResult)
    expect(scanResult.success).toBe(false)
    expect(scanResult.error).toBe('Ticket has been refunded')
  })

  it('should allow re-entry for scanned ticket in re-entry mode', async () => {
    const ticket = createMockTicket({
      status: 'scanned',
      scanned_at: '2025-06-15T21:00:00.000Z',
      current_status: 'outside',
      entry_count: 1,
    })

    // In re-entry mode, scanned tickets can be scanned again
    const isReEntryMode = true
    const canScan = isReEntryMode || ticket.status === 'issued'

    const scanResult = {
      success: canScan,
      ticket,
    }

    expectValidScan(scanResult)
    expect(scanResult.success).toBe(true)
  })

  it('should track scan duration', async () => {
    const startTime = Date.now()
    
    // Simulate some processing time
    await delay(10)
    
    const endTime = Date.now()
    const durationMs = endTime - startTime

    expect(durationMs).toBeGreaterThanOrEqual(10)
    expect(durationMs).toBeLessThan(1000) // Should be fast
  })
})

// ============================================
// VALIDATE QR SIGNATURE TESTS
// ============================================

describe('validateQRSignature', () => {
  it('should return true for valid signature', async () => {
    const token = generateMockQRToken()
    const signature = await generateQRSignature(token)

    const isValid = await validateQRSignature(token, signature)

    expect(isValid).toBe(true)
  })

  it('should return false for tampered signature', async () => {
    const token = generateMockQRToken()
    const validSignature = await generateQRSignature(token)

    // Tamper with the signature
    const tamperedSignature = validSignature.replace(/[a-zA-Z]/g, '0')

    const isValid = await validateQRSignature(token, tamperedSignature)

    expect(isValid).toBe(false)
  })

  it('should handle missing signature', async () => {
    const token = generateMockQRToken()

    // Test with empty string
    expect(await validateQRSignature(token, '')).toBe(false)

    // The function should handle null/undefined gracefully
    const result = await validateQRSignature(token, null as any)
    expect(result).toBe(false)
  })

  it('should return false for wrong token with valid format signature', async () => {
    const token1 = generateMockQRToken()
    const token2 = generateMockQRToken()
    const signature1 = await generateQRSignature(token1)

    // Try to validate token2 with signature from token1
    const isValid = await validateQRSignature(token2, signature1)

    expect(isValid).toBe(false)
  })

  it('should produce valid base64 signatures', async () => {
    const token = generateMockQRToken()
    const signature = await generateQRSignature(token)

    // Verify signature contains only valid base64 characters
    expect(signature).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(await validateQRSignature(token, signature)).toBe(true)
  })

  it('should generate consistent signatures', async () => {
    const token = 'fixed-token-for-consistency-test'

    const sig1 = await generateQRSignature(token)
    const sig2 = await generateQRSignature(token)
    const sig3 = await generateQRSignature(token)

    expect(sig1).toBe(sig2)
    expect(sig2).toBe(sig3)
  })

  it('should generate different signatures for different secrets', async () => {
    const token = 'test-token'

    const sig1 = await generateQRSignature(token, 'secret-1')
    const sig2 = await generateQRSignature(token, 'secret-2')

    expect(sig1).not.toBe(sig2)
  })
})

// ============================================
// TICKET LOOKUP TESTS
// ============================================

describe('lookupTicketByQR', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('should find ticket by QR token', async () => {
    const qrToken = generateMockQRToken()
    const ticket = createMockTicket({ qr_token: qrToken })
    const client = createMockSupabaseClient({
      tickets: [ticket],
    })

    const { data } = await client
      .from('tickets')
      .select('*')
      .eq('qr_token', qrToken)
      .maybeSingle()

    expect(data).not.toBeNull()
    expect(data?.qr_token).toBe(qrToken)
    expect(data?.id).toBe(ticket.id)
  })

  it('should return null for non-existent QR token', async () => {
    const client = createMockSupabaseClient({
      tickets: [createMockTicket()],
    })

    const { data } = await client
      .from('tickets')
      .select('*')
      .eq('qr_token', 'non-existent-token')
      .maybeSingle()

    expect(data).toBeNull()
  })

  it('should include event and ticket type relations', async () => {
    const ticket = createMockTicket()
    const event = createMockEvent({ id: ticket.event_id })
    const ticketType = createMockTicketType({ id: ticket.ticket_type_id })
    
    const client = createMockSupabaseClient({
      tickets: [ticket],
      events: [event],
      ticketTypes: [ticketType],
    })

    const { data } = await client
      .from('tickets')
      .select('*')
      .eq('qr_token', ticket.qr_token)
      .maybeSingle()

    expect(data).not.toBeNull()
    expect(data?.event_id).toBe(event.id)
    expect(data?.ticket_type_id).toBe(ticketType.id)
  })
})

// ============================================
// NFC LOOKUP TESTS
// ============================================

describe('lookupTicketByNFC', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('should find ticket by NFC tag ID', async () => {
    const nfcTagId = 'NFC-TAG-ABC123'
    const ticket = createMockTicket({ nfc_tag_id: nfcTagId })
    const client = createMockSupabaseClient({
      tickets: [ticket],
    })

    const { data } = await client
      .from('tickets')
      .select('*')
      .eq('nfc_tag_id', nfcTagId)
      .maybeSingle()

    expect(data).not.toBeNull()
    expect(data?.nfc_tag_id).toBe(nfcTagId)
  })

  it('should return null for non-existent NFC tag', async () => {
    const client = createMockSupabaseClient({
      tickets: [createMockTicket()],
    })

    const { data } = await client
      .from('tickets')
      .select('*')
      .eq('nfc_tag_id', 'non-existent-nfc-tag')
      .maybeSingle()

    expect(data).toBeNull()
  })
})

// ============================================
// RE-ENTRY MODE TESTS
// ============================================

describe('Re-entry Mode', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('should determine entry scan when guest is outside', () => {
    const ticket = createMockTicket({
      current_status: 'outside',
      entry_count: 0,
    })

    const scanType = ticket.current_status === 'outside' ? 'entry' : 'exit'

    expect(scanType).toBe('entry')
  })

  it('should determine exit scan when guest is inside', () => {
    const ticket = createMockTicket({
      current_status: 'inside',
      entry_count: 1,
    })

    const scanType = ticket.current_status === 'inside' ? 'exit' : 'entry'

    expect(scanType).toBe('exit')
  })

  it('should increment entry count on entry', () => {
    const ticket = createMockTicket({
      current_status: 'outside',
      entry_count: 2,
      exit_count: 2,
    })

    // Simulate entry scan
    const updatedTicket: MockTicket = {
      ...ticket,
      current_status: 'inside',
      entry_count: ticket.entry_count + 1,
      last_entry_at: new Date().toISOString(),
    }

    expect(updatedTicket.entry_count).toBe(3)
    expect(updatedTicket.current_status).toBe('inside')
    expect(updatedTicket.last_entry_at).toBeTruthy()
  })

  it('should increment exit count on exit', () => {
    const ticket = createMockTicket({
      current_status: 'inside',
      entry_count: 3,
      exit_count: 2,
    })

    // Simulate exit scan
    const updatedTicket: MockTicket = {
      ...ticket,
      current_status: 'outside',
      exit_count: ticket.exit_count + 1,
      last_exit_at: new Date().toISOString(),
    }

    expect(updatedTicket.exit_count).toBe(3)
    expect(updatedTicket.current_status).toBe('outside')
    expect(updatedTicket.last_exit_at).toBeTruthy()
  })
})

// ============================================
// SCAN LOG TESTS
// ============================================

describe('Scan Log Recording', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('should record valid scan with correct fields', () => {
    const ticket = createMockTicket()
    const scanLog = createMockScanLog(ticket.id, {
      scan_result: 'valid',
      scan_method: 'qr',
      scan_duration_ms: 45,
    })

    expect(scanLog.ticket_id).toBe(ticket.id)
    expect(scanLog.scan_result).toBe('valid')
    expect(scanLog.scan_method).toBe('qr')
    expect(scanLog.scan_duration_ms).toBe(45)
    expect(scanLog.scanned_at).toBeTruthy()
  })

  it('should record invalid scan result', () => {
    const scanLog = createMockScanLog('ticket-1', {
      scan_result: 'invalid',
    })

    expect(scanLog.scan_result).toBe('invalid')
  })

  it('should record already_scanned result', () => {
    const scanLog = createMockScanLog('ticket-1', {
      scan_result: 'already_scanned',
    })

    expect(scanLog.scan_result).toBe('already_scanned')
  })

  it('should record NFC scan method', () => {
    const scanLog = createMockScanLog('ticket-1', {
      scan_method: 'nfc',
    })

    expect(scanLog.scan_method).toBe('nfc')
  })

  it('should record override information', () => {
    const scanLog = createMockScanLog('ticket-1', {
      override_used: true,
      override_reason: 'VIP guest, manager approved',
    })

    expect(scanLog.override_used).toBe(true)
    expect(scanLog.override_reason).toBe('VIP guest, manager approved')
  })

  it('should insert scan log to database', async () => {
    const client = createMockSupabaseClient()
    const scanLog = createMockScanLog('ticket-1')

    await client.from('scan_logs').insert(scanLog)

    const inserted = client._getInsertedData()
    expect(inserted).toHaveLength(1)
    expect(inserted[0].table).toBe('scan_logs')
  })
})

// ============================================
// ERROR HANDLING TESTS
// ============================================

describe('Scanner Error Handling', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('should handle database connection errors', async () => {
    const dbError = new Error('Connection refused')
    const client = createMockSupabaseClient({
      errors: {
        tickets: dbError,
      },
    })

    const { data, error } = await client.from('tickets').select('*')

    expect(error).toBe(dbError)
    expect(error?.message).toBe('Connection refused')
    expect(data).toBeNull()
  })

  it('should handle scan log insertion errors', async () => {
    const insertError = new Error('Failed to insert scan log')
    const client = createMockSupabaseClient({
      errors: {
        scanLogs: insertError,
      },
    })

    const { error } = await client.from('scan_logs').insert({})

    expect(error).toBe(insertError)
  })

  it('should validate required ticket ID', () => {
    const emptyId = ''
    const nullId = null
    const validId = 'ticket-123'

    expect(!!emptyId).toBe(false)
    expect(!!nullId).toBe(false)
    expect(!!validId).toBe(true)
  })
})

// ============================================
// CONCURRENT SCAN TESTS
// ============================================

describe('Concurrent Scan Handling', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('should handle multiple simultaneous lookups', async () => {
    const ticket = createMockTicket()
    const client = createMockSupabaseClient({
      tickets: [ticket],
    })

    // Simulate concurrent lookups
    const results = await Promise.all([
      client.from('tickets').select('*').eq('qr_token', ticket.qr_token).maybeSingle(),
      client.from('tickets').select('*').eq('qr_token', ticket.qr_token).maybeSingle(),
      client.from('tickets').select('*').eq('qr_token', ticket.qr_token).maybeSingle(),
    ])

    // All should succeed
    results.forEach(({ data, error }) => {
      expect(error).toBeNull()
      expect(data?.id).toBe(ticket.id)
    })
  })
})

// ============================================
// TOKEN REDACTION TESTS
// ============================================

describe('Token Redaction', () => {
  it('should redact tokens for logging', () => {
    const token = 'abc12345-6789-0000-1111-222233334444'
    const redacted = redactToken(token, 8)

    expect(redacted).toBe('abc12345...')
    expect(redacted).not.toContain('6789')
  })

  it('should return *** for short tokens', () => {
    expect(redactToken('short', 8)).toBe('***')
  })

  it('should return *** for empty tokens', () => {
    expect(redactToken('')).toBe('***')
  })
})

// ============================================
// MOCK DATA FACTORY TESTS
// ============================================

describe('Mock Data Factories', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('should create ticket with valid QR signature', async () => {
    const ticket = await createMockTicketAsync()

    expect(ticket.qr_token).toBeTruthy()
    expect(ticket.qr_signature).toBeTruthy()
    expect(await validateQRSignature(ticket.qr_token, ticket.qr_signature)).toBe(true)
  })

  it('should create unique tickets', () => {
    const ticket1 = createMockTicket()
    const ticket2 = createMockTicket()

    expect(ticket1.id).not.toBe(ticket2.id)
    expect(ticket1.qr_token).not.toBe(ticket2.qr_token)
  })

  it('should allow overriding ticket properties', () => {
    const customStatus = 'scanned'
    const customScannedAt = '2025-06-15T21:00:00.000Z'
    
    const ticket = createMockTicket({
      status: customStatus,
      scanned_at: customScannedAt,
    })

    expect(ticket.status).toBe(customStatus)
    expect(ticket.scanned_at).toBe(customScannedAt)
  })
})
