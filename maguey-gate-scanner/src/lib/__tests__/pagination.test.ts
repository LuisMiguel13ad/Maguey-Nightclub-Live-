/**
 * Pagination Utilities Tests for Gate Scanner
 * 
 * Tests for offset-based and cursor-based pagination in scanner service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  // Pagination utilities
  normalizePaginationOptions,
  normalizeCursorOptions,
  calculatePagination,
  buildPaginatedResponse,
  buildCursorPaginatedResponse,
  applyPagination,
  applyCursorPagination,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type PaginationOptions,
  type PaginatedResult,
  type CursorPaginationOptions,
  type CursorPaginatedResult,
} from '../pagination'
import {
  createMockTicket,
  createMockScanLog,
  resetCounters,
  type MockScanLog,
} from './test-utils'

// ============================================
// OFFSET PAGINATION TESTS
// ============================================

describe('Pagination Utilities', () => {
  describe('normalizePaginationOptions', () => {
    it('should use default values when no options provided', () => {
      const options = normalizePaginationOptions({})
      
      expect(options.page).toBe(1)
      expect(options.pageSize).toBe(DEFAULT_PAGE_SIZE)
      expect(options.sortBy).toBe('created_at')
      expect(options.sortOrder).toBe('desc')
    })

    it('should preserve custom values when provided', () => {
      const options = normalizePaginationOptions({
        page: 3,
        pageSize: 50,
        sortBy: 'scanned_at',
        sortOrder: 'asc',
      })
      
      expect(options.page).toBe(3)
      expect(options.pageSize).toBe(50)
      expect(options.sortBy).toBe('scanned_at')
      expect(options.sortOrder).toBe('asc')
    })

    it('should enforce minimum page of 1', () => {
      const options = normalizePaginationOptions({ page: -5 })
      expect(options.page).toBe(1)
    })

    it('should enforce maximum pageSize of 100', () => {
      const options = normalizePaginationOptions({ pageSize: 500 })
      expect(options.pageSize).toBe(MAX_PAGE_SIZE)
    })
  })

  describe('calculatePagination', () => {
    it('should calculate correct offset and totalPages', () => {
      const result = calculatePagination(100, { page: 3, pageSize: 20 })
      
      expect(result.offset).toBe(40) // (3-1) * 20
      expect(result.meta.totalPages).toBe(5) // 100 / 20
      expect(result.meta.hasNextPage).toBe(true)
      expect(result.meta.hasPreviousPage).toBe(true)
    })

    it('should set hasNextPage false on last page', () => {
      const result = calculatePagination(100, { page: 5, pageSize: 20 })
      expect(result.meta.hasNextPage).toBe(false)
    })

    it('should set hasPreviousPage false on first page', () => {
      const result = calculatePagination(100, { page: 1, pageSize: 20 })
      expect(result.meta.hasPreviousPage).toBe(false)
    })
  })

  describe('buildPaginatedResponse', () => {
    it('should build correct response structure', () => {
      const data = [{ id: '1' }, { id: '2' }, { id: '3' }]
      const result = buildPaginatedResponse(data, 100, { page: 1, pageSize: 20 })
      
      expect(result.data).toEqual(data)
      expect(result.pagination).toHaveProperty('page')
      expect(result.pagination).toHaveProperty('pageSize')
      expect(result.pagination).toHaveProperty('totalItems')
      expect(result.pagination).toHaveProperty('totalPages')
      expect(result.pagination).toHaveProperty('hasNextPage')
      expect(result.pagination).toHaveProperty('hasPreviousPage')
      expect(result.pagination).toHaveProperty('startIndex')
      expect(result.pagination).toHaveProperty('endIndex')
    })

    it('should calculate correct pagination metadata', () => {
      const data = [{ id: '1' }]
      const result = buildPaginatedResponse(data, 50, { page: 2, pageSize: 10 })
      
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.pageSize).toBe(10)
      expect(result.pagination.totalItems).toBe(50)
      expect(result.pagination.totalPages).toBe(5)
      expect(result.pagination.hasNextPage).toBe(true)
      expect(result.pagination.hasPreviousPage).toBe(true)
      expect(result.pagination.startIndex).toBe(11)
      expect(result.pagination.endIndex).toBe(11)
    })

    it('should handle empty results', () => {
      const result = buildPaginatedResponse([], 0, { page: 1, pageSize: 20 })
      
      expect(result.data).toEqual([])
      expect(result.pagination.totalItems).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
      expect(result.pagination.startIndex).toBe(0)
      expect(result.pagination.endIndex).toBe(0)
    })
  })

  describe('applyPagination', () => {
    it('should apply correct range and order to query', () => {
      const mockQuery = {
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
      }
      
      applyPagination(mockQuery as any, { page: 2, pageSize: 25, sortBy: 'scanned_at', sortOrder: 'desc' })
      
      expect(mockQuery.order).toHaveBeenCalledWith('scanned_at', { ascending: false })
      expect(mockQuery.range).toHaveBeenCalledWith(25, 49) // page 2: offset=25, end=49
    })
  })
})

// ============================================
// CURSOR PAGINATION TESTS
// ============================================

describe('Cursor Pagination', () => {
  describe('normalizeCursorOptions', () => {
    it('should use default values when no options provided', () => {
      const options = normalizeCursorOptions({})
      
      expect(options.limit).toBe(DEFAULT_PAGE_SIZE)
      expect(options.cursor).toBeNull()
      expect(options.direction).toBe('forward')
      expect(options.cursorColumn).toBe('id')
    })

    it('should preserve custom values', () => {
      const options = normalizeCursorOptions({
        limit: 50,
        cursor: 'abc123',
        direction: 'backward',
      })
      
      expect(options.limit).toBe(50)
      expect(options.cursor).toBe('abc123')
      expect(options.direction).toBe('backward')
    })
  })

  describe('buildCursorPaginatedResponse', () => {
    it('should detect hasMore when extra item exists', () => {
      const data = [{ id: '1' }, { id: '2' }, { id: '3' }]
      const result = buildCursorPaginatedResponse(
        data,
        { limit: 2 },
        (item) => item.id
      )
      
      expect(result.hasMore).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.nextCursor).toBe('2')
    })

    it('should set hasMore false when no extra item', () => {
      const data = [{ id: '1' }, { id: '2' }]
      const result = buildCursorPaginatedResponse(
        data,
        { limit: 2 },
        (item) => item.id
      )
      
      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeNull()
    })

    it('should handle empty results', () => {
      const result = buildCursorPaginatedResponse(
        [],
        { limit: 20 },
        (item: any) => item.id
      )
      
      expect(result.data).toEqual([])
      expect(result.hasMore).toBe(false)
      expect(result.count).toBe(0)
    })
  })

  describe('applyCursorPagination', () => {
    it('should apply cursor filter for forward pagination', () => {
      const mockQuery = {
        order: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      }
      
      applyCursorPagination(mockQuery as any, {
        cursor: 'cursor-123',
        limit: 20,
        direction: 'forward',
        sortOrder: 'desc',
      })
      
      expect(mockQuery.lt).toHaveBeenCalledWith('id', 'cursor-123')
      expect(mockQuery.limit).toHaveBeenCalledWith(21) // limit + 1
    })

    it('should not apply cursor filter when cursor is null', () => {
      const mockQuery = {
        order: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      }
      
      applyCursorPagination(mockQuery as any, {
        cursor: null,
        limit: 20,
      })
      
      expect(mockQuery.lt).not.toHaveBeenCalled()
      expect(mockQuery.gt).not.toHaveBeenCalled()
    })
  })
})

// ============================================
// SCAN LOG PAGINATION STRUCTURE TESTS
// ============================================

describe('Scan Log Pagination Structure', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('getScanLogsPaginated should return correct PaginatedResult structure', () => {
    // Create mock scan logs
    const ticket = createMockTicket()
    const scanLogs: MockScanLog[] = [
      createMockScanLog(ticket.id, { scan_result: 'valid' }),
      createMockScanLog(ticket.id, { scan_result: 'valid' }),
    ]
    
    // Build paginated response
    const result = buildPaginatedResponse(scanLogs, 10, { page: 1, pageSize: 20 })
    
    // Validate structure
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('pagination')
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(typeof result.pagination.page).toBe('number')
    expect(typeof result.pagination.pageSize).toBe('number')
    expect(typeof result.pagination.totalItems).toBe('number')
    expect(typeof result.pagination.totalPages).toBe('number')
    expect(typeof result.pagination.hasNextPage).toBe('boolean')
    expect(typeof result.pagination.hasPreviousPage).toBe('boolean')
  })

  it('getEventScansPaginated should return correct PaginatedResult structure', () => {
    // Create mock scan logs for an event
    const ticket1 = createMockTicket({ event_id: 'event-123' })
    const ticket2 = createMockTicket({ event_id: 'event-123' })
    
    const scanLogs: MockScanLog[] = [
      createMockScanLog(ticket1.id, { scan_result: 'valid', scan_method: 'qr' }),
      createMockScanLog(ticket2.id, { scan_result: 'valid', scan_method: 'nfc' }),
      createMockScanLog(ticket1.id, { scan_result: 'already_scanned' }),
    ]
    
    // Build paginated response
    const result = buildPaginatedResponse(scanLogs, 50, { page: 1, pageSize: 20, sortBy: 'scanned_at' })
    
    // Validate structure
    expect(result.data).toHaveLength(3)
    expect(result.pagination.totalItems).toBe(50)
    expect(result.pagination.totalPages).toBe(3)
    expect(result.pagination.hasNextPage).toBe(true)
    
    // Verify scan log data
    expect(result.data[0].ticket_id).toBe(ticket1.id)
    expect(result.data[0].scan_method).toBe('qr')
    expect(result.data[1].scan_method).toBe('nfc')
    expect(result.data[2].scan_result).toBe('already_scanned')
  })

  it('should handle pagination with filters', () => {
    const ticket = createMockTicket()
    
    // Create scan logs with different results
    const allLogs: MockScanLog[] = [
      createMockScanLog(ticket.id, { scan_result: 'valid' }),
      createMockScanLog(ticket.id, { scan_result: 'valid' }),
      createMockScanLog(ticket.id, { scan_result: 'invalid' }),
      createMockScanLog(ticket.id, { scan_result: 'already_scanned' }),
    ]
    
    // Filter to only valid scans
    const validLogs = allLogs.filter(log => log.scan_result === 'valid')
    
    const result = buildPaginatedResponse(validLogs, 2, { page: 1, pageSize: 10 })
    
    expect(result.data).toHaveLength(2)
    expect(result.pagination.totalItems).toBe(2)
    expect(result.data.every(log => log.scan_result === 'valid')).toBe(true)
  })

  it('cursor pagination should work for real-time scan feeds', () => {
    const ticket = createMockTicket()
    
    // Simulate a feed of scan logs
    const scanLogs: MockScanLog[] = Array.from({ length: 25 }, (_, i) =>
      createMockScanLog(ticket.id, { id: `scan-${i + 1}` })
    )
    
    // First page
    const firstPage = buildCursorPaginatedResponse(
      scanLogs.slice(0, 21), // 20 + 1 for hasMore check
      { limit: 20 },
      (log) => log.id
    )
    
    expect(firstPage.data).toHaveLength(20)
    expect(firstPage.hasMore).toBe(true)
    expect(firstPage.nextCursor).toBe('scan-20')
    
    // Second page (simulating cursor-based fetch)
    const secondPageData = scanLogs.slice(20)
    const secondPage = buildCursorPaginatedResponse(
      secondPageData,
      { limit: 20, cursor: 'scan-20' },
      (log) => log.id
    )
    
    expect(secondPage.data).toHaveLength(5)
    expect(secondPage.hasMore).toBe(false)
    expect(secondPage.previousCursor).toBe('scan-21')
  })
})

// ============================================
// SCANNER-SPECIFIC PAGINATION TESTS
// ============================================

describe('Scanner Pagination Scenarios', () => {
  beforeEach(() => {
    resetCounters()
  })

  it('should paginate scans by scanner ID', () => {
    const scannerId = 'scanner-device-001'
    
    const scanLogs: MockScanLog[] = [
      createMockScanLog('ticket-1', { scanned_by: scannerId }),
      createMockScanLog('ticket-2', { scanned_by: scannerId }),
      createMockScanLog('ticket-3', { scanned_by: 'other-scanner' }),
    ]
    
    // Filter by scanner
    const scannerLogs = scanLogs.filter(log => log.scanned_by === scannerId)
    const result = buildPaginatedResponse(scannerLogs, 2, { page: 1, pageSize: 10 })
    
    expect(result.data).toHaveLength(2)
    expect(result.data.every(log => log.scanned_by === scannerId)).toBe(true)
  })

  it('should paginate scans by scan method', () => {
    const ticket = createMockTicket()
    
    const scanLogs: MockScanLog[] = [
      createMockScanLog(ticket.id, { scan_method: 'qr' }),
      createMockScanLog(ticket.id, { scan_method: 'qr' }),
      createMockScanLog(ticket.id, { scan_method: 'nfc' }),
      createMockScanLog(ticket.id, { scan_method: 'manual' }),
    ]
    
    // Filter by QR scans
    const qrLogs = scanLogs.filter(log => log.scan_method === 'qr')
    const result = buildPaginatedResponse(qrLogs, 2, { page: 1, pageSize: 10 })
    
    expect(result.data).toHaveLength(2)
    expect(result.data.every(log => log.scan_method === 'qr')).toBe(true)
  })

  it('should paginate override scans', () => {
    const ticket = createMockTicket()
    
    const scanLogs: MockScanLog[] = [
      createMockScanLog(ticket.id, { override_used: true, override_reason: 'VIP' }),
      createMockScanLog(ticket.id, { override_used: false }),
      createMockScanLog(ticket.id, { override_used: true, override_reason: 'Manager approval' }),
    ]
    
    // Filter overridden scans
    const overrideLogs = scanLogs.filter(log => log.override_used)
    const result = buildPaginatedResponse(overrideLogs, 2, { page: 1, pageSize: 10 })
    
    expect(result.data).toHaveLength(2)
    expect(result.data.every(log => log.override_used === true)).toBe(true)
    expect(result.data[0].override_reason).toBe('VIP')
  })

  it('should handle large scan log datasets efficiently', () => {
    const ticket = createMockTicket()
    
    // Simulate 1000 scan logs
    const totalLogs = 1000
    const pageSize = 50
    const page = 5
    
    // Calculate expected pagination
    const result = calculatePagination(totalLogs, { page, pageSize })
    
    expect(result.meta.totalPages).toBe(20) // 1000 / 50
    expect(result.meta.hasNextPage).toBe(true)
    expect(result.meta.hasPreviousPage).toBe(true)
    expect(result.offset).toBe(200) // (5-1) * 50
  })
})

// ============================================
// EDGE CASES
// ============================================

describe('Pagination Edge Cases', () => {
  it('should handle page beyond total pages', () => {
    const result = buildPaginatedResponse([], 50, { page: 100, pageSize: 20 })
    
    expect(result.pagination.page).toBe(100)
    expect(result.pagination.totalPages).toBe(3)
    expect(result.pagination.hasNextPage).toBe(false)
  })

  it('should handle single scan log', () => {
    const scanLog = createMockScanLog('ticket-1')
    const result = buildPaginatedResponse([scanLog], 1, { page: 1, pageSize: 20 })
    
    expect(result.data).toHaveLength(1)
    expect(result.pagination.totalPages).toBe(1)
    expect(result.pagination.hasNextPage).toBe(false)
    expect(result.pagination.hasPreviousPage).toBe(false)
  })

  it('should handle exactly one page of results', () => {
    const scanLogs = Array.from({ length: 20 }, (_, i) =>
      createMockScanLog(`ticket-${i}`)
    )
    
    const result = buildPaginatedResponse(scanLogs, 20, { page: 1, pageSize: 20 })
    
    expect(result.pagination.totalPages).toBe(1)
    expect(result.pagination.hasNextPage).toBe(false)
  })
})
