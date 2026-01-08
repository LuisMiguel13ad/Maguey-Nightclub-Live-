import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { supabase, type Ticket, type Event, type TicketType } from './supabase';
import { updateTicketReEntryStatus, determineScanType, type ReEntryMode } from './re-entry-service';
import { requiresIDVerification, checkIDRequirementByName, isTicketVerified } from './id-verification-service';
import { validateNFCSignature, type ScanMethod } from './nfc-service';
import { collectScanMetadata, saveScanMetadata, getClientIPAddress } from './scan-metadata-service';
import { detectFraud, saveFraudDetectionResult } from './fraud-detection-service';
import { createLogger, redact, type LogContext } from './logger';
import { 
  publishTicketScanned, 
  publishTicketReEntry, 
  publishTicketExit,
  publishTicketScanRejected,
  publishTicketFraudFlagged,
  createScannerMetadata,
  generateCorrelationId,
} from './events/ticket-events';
import { tracer, traceAsync, traceQuery, extractTraceContext, getCurrentTraceContext } from './tracing';
import { createScanSpan, createValidationSpan, createLookupSpan, createStatusUpdateSpan, createEventPublishSpan } from './tracing/scan-spans';
import { errorTracker } from './errors/error-tracker';
import { ScanError, ScanErrorType, getScanErrorRecovery } from './errors/scanner-errors';
import { DatabaseError, ErrorSeverity, ErrorCategory } from './errors/error-types';
import { logAuditEvent } from './audit-service';
import {
  applyPagination,
  buildPaginatedResponse,
  applyCursorPagination,
  buildCursorPaginatedResponse,
  type PaginationOptions,
  type PaginatedResult,
  type CursorPaginationOptions,
  type CursorPaginatedResult,
} from './pagination';

// Create module-scoped logger
const logger = createLogger({ module: 'scanner-service' });

// Support both Vite (import.meta.env) and Node.js (process.env) environments
const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

const qrSigningSecret = getEnvVar('VITE_QR_SIGNING_SECRET') || 'placeholder-secret-for-development';

type RelationMaybeArray<T> = T | T[] | null;

const normalizeRelation = <T>(relation: RelationMaybeArray<T>): T | null => {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
};

type TicketQueryRow = Ticket & {
  events: RelationMaybeArray<Event>;
  ticket_types: RelationMaybeArray<TicketType>;
};

export interface TicketWithRelations extends Ticket {
  events: Event | null;
  ticket_types: TicketType | null;
}

export interface ScanResult {
  success: boolean;
  error?: string;
  ticket?: TicketWithRelations;
  durationMs?: number; // Scan duration in milliseconds
}

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
};

/**
 * Validates QR signature using HMAC SHA-256
 * @param qrToken - The QR token to validate
 * @param signature - The signature to compare against
 * @returns Promise<boolean> - true if signature matches, false otherwise
 */
export const validateQRSignature = async (
  qrToken: string,
  signature: string
): Promise<boolean> => {
  if (!qrToken || !signature) return false;

  const log = logger.child({ qrToken: redact(qrToken) });

  try {
    const keyBytes = utf8ToBytes(qrSigningSecret);
    const tokenBytes = utf8ToBytes(qrToken);
    const expectedSignature = bytesToHex(hmac(sha256, keyBytes, tokenBytes));

    const isValid = timingSafeEqual(signature.toLowerCase(), expectedSignature.toLowerCase());
    
    if (!isValid) {
      log.warn('QR signature validation failed');
      
      // Track invalid QR error
      const scanError = new ScanError(
        ScanErrorType.INVALID_QR,
        'Invalid QR code signature',
        {
          context: {
            qrToken: redact(qrToken),
            traceId: getCurrentTraceContext()?.traceId,
          },
        }
      );
      
      errorTracker.captureError(scanError, {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.VALIDATION,
        context: {
          traceId: getCurrentTraceContext()?.traceId,
        },
        tags: {
          scanOperation: 'qr_validation',
        },
      });
    }
    
    return isValid;
  } catch (error) {
    log.error('QR signature validation error', error);

    // Track QR validation error
    errorTracker.captureError(
      error instanceof Error ? error : new Error(error?.message || JSON.stringify(error)),
      {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.VALIDATION,
        context: {
          operation: 'validateQRSignature',
          traceId: getCurrentTraceContext()?.traceId,
        },
        tags: {
          scanOperation: 'qr_validation',
        },
      }
    );
    
    return false;
  }
};

/**
 * Looks up a ticket by QR token with full event and ticket type information
 * @param qrToken - The QR token to lookup
 * @returns Promise<TicketWithRelations | null> - Full ticket info with relations, or null if not found
 */
export const lookupTicketByQR = async (
  qrToken: string
): Promise<TicketWithRelations | null> => {
  if (!qrToken) return null;

  const log = logger.child({ qrToken: redact(qrToken) });
  const done = log.time('lookupTicketByQR');

  const { data, error } = await supabase
    .from('tickets')
    .select(
      `
      id,
      order_id,
      event_id,
      ticket_type_id,
      attendee_name,
      qr_token,
      qr_signature,
      status,
      scanned_at,
      issued_at,
      events (
        id,
        name,
        event_date,
        event_time,
        venue_name,
        city
      ),
      ticket_types (
        id,
        name,
        price
      )
    `
    )
    .eq('qr_token', qrToken)
    .maybeSingle();

  done();

  if (error) {
    log.error('Ticket lookup failed', error);
    throw new Error(error.message);
  }

  if (!data) {
    log.debug('Ticket not found');
    return null;
  }

  const normalized = data as TicketQueryRow;
  log.debug('Ticket found', { ticketId: normalized.id, status: normalized.status });

  return {
    ...normalized,
    events: normalizeRelation(normalized.events),
    ticket_types: normalizeRelation(normalized.ticket_types),
  };
};

/**
 * Looks up a ticket by NFC tag ID or NFC token with full event and ticket type information
 * @param nfcTagIdOrToken - The NFC tag ID or NFC token to lookup
 * @param nfcSignature - Optional NFC signature for validation
 * @returns Promise<TicketWithRelations | null> - Full ticket info with relations, or null if not found
 */
export const lookupTicketByNFC = async (
  nfcTagIdOrToken: string,
  nfcSignature?: string
): Promise<TicketWithRelations | null> => {
  if (!nfcTagIdOrToken) return null;

  const log = logger.child({ nfcTag: redact(nfcTagIdOrToken), method: 'nfc' });
  const done = log.time('lookupTicketByNFC');

  // First try to find by NFC tag ID
  let { data, error } = await supabase
    .from('tickets')
    .select(
      `
      id,
      order_id,
      event_id,
      ticket_type_id,
      attendee_name,
      qr_token,
      qr_signature,
      nfc_tag_id,
      nfc_signature,
      status,
      scanned_at,
      issued_at,
      events (
        id,
        name,
        event_date,
        event_time,
        venue_name,
        city
      ),
      ticket_types (
        id,
        name,
        price
      )
    `
    )
    .eq('nfc_tag_id', nfcTagIdOrToken)
    .maybeSingle();

  // If not found by tag ID, try to find by QR token (NFC can contain QR token)
  if (!data && !error) {
    log.debug('NFC tag not found, trying QR token lookup');
    const result = await supabase
      .from('tickets')
      .select(
        `
        id,
        order_id,
        event_id,
        ticket_type_id,
        attendee_name,
        qr_token,
        qr_signature,
        nfc_tag_id,
        nfc_signature,
        status,
        scanned_at,
        issued_at,
        events (
          id,
          name,
          event_date,
          event_time,
          venue_name,
          city
        ),
        ticket_types (
          id,
          name,
          price
        )
      `
      )
      .eq('qr_token', nfcTagIdOrToken)
      .maybeSingle();
    
    data = result.data;
    error = result.error;
  }

  done();

  if (error) {
    log.error('NFC ticket lookup failed', error);
    throw new Error(error.message);
  }

  if (!data) {
    log.debug('Ticket not found via NFC');
    return null;
  }

  // Validate NFC signature if provided
  if (nfcSignature && data.nfc_signature) {
    const isValid = await validateNFCSignature(nfcTagIdOrToken, nfcSignature);
    if (!isValid) {
      log.warn('NFC signature validation failed', { ticketId: data.id });
      // Still return the ticket but log the warning
    }
  }

  const normalized = data as TicketQueryRow & { nfc_tag_id?: string; nfc_signature?: string };
  log.debug('Ticket found via NFC', { ticketId: normalized.id, status: normalized.status });

  return {
    ...normalized,
    events: normalizeRelation(normalized.events),
    ticket_types: normalizeRelation(normalized.ticket_types),
  };
};

/**
 * Scans a ticket, updating its status and logging the scan
 * @param ticketId - The ticket ID to scan
 * @param scannedBy - Optional user ID who scanned the ticket
 * @param reEntryMode - Optional re-entry mode ('single', 'reentry', 'exit_tracking')
 * @param scanStartTime - Optional timestamp when scan started (for duration tracking)
 * @param scanMethod - Optional scan method ('qr', 'nfc', 'manual'), defaults to 'qr'
 * @param overrideUsed - Optional flag indicating if emergency override was used
 * @param overrideReason - Optional reason for override if overrideUsed is true
 * @returns Promise<ScanResult> - Success/error result with ticket info
 */
export const scanTicket = async (
  ticketId: string,
  scannedBy?: string,
  reEntryMode?: ReEntryMode,
  scanStartTime?: number,
  scanMethod: ScanMethod = 'qr',
  overrideUsed: boolean = false,
  overrideReason: string | null = null,
  parentTraceContext?: import('./tracing').TraceContext
): Promise<ScanResult> => {
  return tracer.withSpan('scanner.scanTicket', async (span) => {
    const startTime = scanStartTime || Date.now();
    
    // Set span attributes
    span.setAttributes({
      'scanner.ticket_id': ticketId,
      'scanner.scanner_id': scannedBy || 'unknown',
      'scanner.scan_method': scanMethod,
      'scanner.re_entry_mode': reEntryMode || 'single',
      'scanner.override_used': overrideUsed,
    });
    
    // Create scan-specific logger with redacted ticket ID
    const log = logger.child({ 
      ticketId: ticketId ? redact(ticketId, 8) : 'none',
      scannedBy: scannedBy || 'unknown',
      scanMethod,
      reEntryMode: reEntryMode || 'single',
    });
    const endTimer = log.time('scanTicket');
    
    log.info('Scan attempt started');
    
    if (!ticketId) {
      log.warn('Scan rejected: missing ticket ID');
      span.setError('Ticket ID is required');
      
      const scanError = new ScanError(
        ScanErrorType.INVALID_QR,
        'Ticket ID is required',
        {
          scannerId: scannedBy,
          context: {
            traceId: getCurrentTraceContext()?.traceId,
            scanMethod,
          },
        }
      );
      
      errorTracker.captureError(scanError, {
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        context: {
          scannerId: scannedBy,
          scanMethod,
          traceId: getCurrentTraceContext()?.traceId,
        },
      });
      
      return { success: false, error: 'Ticket ID is required.' };
    }

    // Database lookup with tracing
    const ticket = await traceQuery('scanner.lookupTicket', async () => {
      const { data: ticketData, error: fetchError } = await supabase
        .from('tickets')
        .select(
          `
          id,
          order_id,
          event_id,
          ticket_type_id,
          attendee_name,
          qr_token,
          qr_signature,
          status,
          scanned_at,
          issued_at,
          ticket_type,
          event_name,
          events (
            id,
            name,
            event_date,
            event_time,
            venue_name,
            city
          ),
          ticket_types (
            id,
            name,
            price
          )
        `
        )
        .eq('id', ticketId)
        .maybeSingle();

      if (fetchError) {
        span.addEvent('ticket.lookup.failed', { error: fetchError.message });
        
        const dbError = new DatabaseError(
          'lookup_ticket',
          fetchError instanceof Error ? fetchError : new Error(fetchError?.message || JSON.stringify(fetchError)),
          {
            ticketId,
            scannerId: scannedBy,
            traceId: getCurrentTraceContext()?.traceId,
          }
        );
        
        errorTracker.captureError(dbError, {
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.DATABASE,
          context: {
            ticketId,
            scannerId: scannedBy,
            traceId: getCurrentTraceContext()?.traceId,
          },
        });
        
        throw dbError;
      }

      if (!ticketData) {
        span.addEvent('ticket.not_found');
        
        const scanError = new ScanError(
          ScanErrorType.TICKET_NOT_FOUND,
          `Ticket not found: ${ticketId}`,
          {
            ticketId,
            scannerId: scannedBy,
            context: {
              traceId: getCurrentTraceContext()?.traceId,
              scanMethod,
            },
          }
        );
        
        errorTracker.captureError(scanError, {
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.VALIDATION,
          context: {
            ticketId,
            scannerId: scannedBy,
            scanMethod,
            traceId: getCurrentTraceContext()?.traceId,
          },
        });
        
        throw scanError;
      }

      return ticketData;
    });

    span.setAttributes({
      'scanner.event_id': ticket.event_id,
      'scanner.ticket_status': ticket.status,
    });
    span.addEvent('ticket.fetched', { event_id: ticket.event_id });
    
    log.debug('Ticket fetched', {
      status: ticket.status,
      eventId: ticket.event_id,
      ticketType: ticket.ticket_type,
    });

  const normalizedTicket = ticket as TicketQueryRow;
  const ticketWithRelations: TicketWithRelations = {
    ...normalizedTicket,
    events: normalizeRelation(normalizedTicket.events),
    ticket_types: normalizeRelation(normalizedTicket.ticket_types),
  };

  // Handle re-entry mode
  const mode = reEntryMode || 'single';
  const isReEntryMode = mode !== 'single';

    // For single entry mode, check if already scanned
    if (!isReEntryMode && ticketWithRelations.status === 'scanned') {
      const scannedAt = ticketWithRelations.scanned_at
        ? new Date(ticketWithRelations.scanned_at).toLocaleString()
        : 'unknown time';
      log.warn('Scan rejected: already used', { 
        result: 'already_scanned',
        scannedAt: ticketWithRelations.scanned_at,
      });
      
      span.addEvent('scan.rejected', { reason: 'already_scanned' });
      span.setError('Ticket already scanned');
      
      // Track already scanned error
      const scanError = new ScanError(
        ScanErrorType.ALREADY_SCANNED,
        `Ticket already scanned at ${scannedAt}`,
        {
          ticketId,
          scannerId: scannedBy,
          eventId: ticketWithRelations.event_id,
          context: {
            scannedAt: ticketWithRelations.scanned_at,
            traceId: getCurrentTraceContext()?.traceId,
            scanMethod,
          },
        }
      );
      
      errorTracker.captureError(scanError, {
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        context: {
          ticketId,
          scannerId: scannedBy,
          eventId: ticketWithRelations.event_id,
          scannedAt: ticketWithRelations.scanned_at,
          traceId: getCurrentTraceContext()?.traceId,
        },
        tags: {
          scanOperation: 'duplicate_scan',
        },
      });
      
      // Publish scan rejected event (fire and forget)
      const traceContext = getCurrentTraceContext();
      if (traceContext) {
        const publishSpan = createEventPublishSpan('TicketScanRejected', ticketId, traceContext);
        publishTicketScanRejected(ticketId, {
          reason: 'already_scanned',
          details: `Previously scanned at ${scannedAt}`,
          scannedBy,
          scanMethod,
        }).then(() => {
          publishSpan.setOk();
          publishSpan.end();
        }).catch((err) => {
          publishSpan.setError(err);
          publishSpan.end();
        });
      } else {
        publishTicketScanRejected(ticketId, {
          reason: 'already_scanned',
          details: `Previously scanned at ${scannedAt}`,
          scannedBy,
          scanMethod,
        }).catch(() => {});
      }
      
      // Audit log: duplicate scan attempt
      logAuditEvent('ticket_scanned', 'ticket', `Duplicate scan rejected - already scanned at ${scannedAt}`, {
        userId: scannedBy,
        resourceId: ticketId,
        severity: 'warning',
        metadata: {
          eventId: ticketWithRelations.event_id,
          scanMethod,
          previousScannedAt: ticketWithRelations.scanned_at,
          result: 'already_scanned',
        },
      }).catch(() => {}); // Non-blocking

      endTimer();
      return {
        success: false,
        error: `Already scanned at ${scannedAt}`,
        ticket: ticketWithRelations,
      };
    }

  const scannedAt = new Date().toISOString();

  // Determine scan type for re-entry tracking
  let scanType: 'entry' | 'exit' = 'entry';
  if (isReEntryMode) {
    scanType = await determineScanType(ticketId, mode);
  }

    // Update ticket status with tracing
    await traceQuery('scanner.updateTicketStatus', async () => {
      const updateData: any = {
        scanned_at: scannedAt,
      };

      // For single entry mode, set status to scanned
      // For re-entry modes, status remains but we track entry/exit
      if (!isReEntryMode) {
        updateData.status = 'scanned';
      }

      const { error: updateError } = await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (updateError) {
        span.addEvent('status.update.failed', { error: updateError.message });
        
        const dbError = new DatabaseError(
          'update_ticket_status',
          updateError instanceof Error ? updateError : new Error(updateError?.message || JSON.stringify(updateError)),
          {
            ticketId,
            scannerId: scannedBy,
            traceId: getCurrentTraceContext()?.traceId,
          }
        );
        
        errorTracker.captureError(dbError, {
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.DATABASE,
          context: {
            ticketId,
            scannerId: scannedBy,
            traceId: getCurrentTraceContext()?.traceId,
          },
        });
        
        throw dbError;
      }

      span.addEvent('status.updated', { new_status: updateData.status || 'unchanged' });
    });

    const currentTraceContext = getCurrentTraceContext();
    if (currentTraceContext) {
      span.setAttribute('scanner.trace_id', currentTraceContext.traceId);
    }

  // Update re-entry status if in re-entry mode
  if (isReEntryMode) {
    const deviceId = typeof window !== 'undefined' 
      ? localStorage.getItem('scanner_device_id') || undefined 
      : undefined;
    
    await updateTicketReEntryStatus(ticketId, scanType, scannedBy, deviceId);
  }

  // Calculate scan duration
  const durationMs = Date.now() - startTime;

    // Log to scan_logs - only use columns that exist in the database
    // Extra fields go into metadata JSON
    const traceContext = getCurrentTraceContext();
    const { data: scanLogData, error: logError } = await traceQuery('scanner.insertScanLog', async () => {
      const insertData: any = {
        ticket_id: ticketId,
        scan_result: 'valid',
        scanned_at: scannedAt,
        scanned_by: scannedBy ?? null,
        metadata: {
          ticket_type: ticketWithRelations.ticket_type || null,
          ticket_id: ticketWithRelations.ticket_id || null,
          scan_method: scanMethod,
          scan_duration_ms: durationMs,
          override_used: overrideUsed,
          override_reason: overrideReason,
          trace_id: traceContext?.traceId || null,
        },
      };

      const { data, error } = await supabase.from('scan_logs').insert(insertData).select('id').single();

      if (error) {
        throw error;
      }

      return data;
    });

  if (logError) {
    log.warn('Failed to save scan log', { error: logError.message });
  }

    // Collect scan metadata and run fraud detection (async, don't block scan)
    if (scanLogData?.id) {
      (async () => {
        try {
          const traceContextForFraud = getCurrentTraceContext();
          
          // Collect metadata
          const ipAddress = await getClientIPAddress();
          const scanMetadata = await collectScanMetadata(ipAddress);
          
          // Save metadata
          await saveScanMetadata(scanLogData.id, scanMetadata);
          
          // Run fraud detection
          const fraudResult = await detectFraud(ticketId, scanMetadata);
          
          // Save fraud detection result
          await saveFraudDetectionResult(scanLogData.id, ticketId, fraudResult, scanMetadata);
          
          // Log high-risk scans and publish fraud event
          if (fraudResult.shouldAlert) {
            log.warn('High-risk scan detected', {
              riskScore: fraudResult.riskScore,
              indicators: fraudResult.indicators.map(i => i.type),
            });
            
            // Publish fraud flagged event with tracing
            if (traceContextForFraud) {
              const publishSpan = createEventPublishSpan('TicketFraudFlagged', ticketId, traceContextForFraud);
              publishTicketFraudFlagged(ticketId, {
                riskScore: fraudResult.riskScore,
                indicators: fraudResult.indicators.map(i => i.type),
                flaggedBy: 'system',
                details: fraudResult.indicators.map(i => `${i.type}: ${i.description}`).join('; '),
              }).then(() => {
                publishSpan.setOk();
                publishSpan.end();
              }).catch((err) => {
                publishSpan.setError(err);
                publishSpan.end();
              });
            } else {
              publishTicketFraudFlagged(ticketId, {
                riskScore: fraudResult.riskScore,
                indicators: fraudResult.indicators.map(i => i.type),
                flaggedBy: 'system',
                details: fraudResult.indicators.map(i => `${i.type}: ${i.description}`).join('; '),
              }).catch(() => {});
            }
          }
        } catch (error) {
          // Don't fail the scan if fraud detection fails
          log.error('Fraud detection failed', error);
          
          // Track fraud detection error (non-blocking)
          const traceContextForFraud = getCurrentTraceContext();
          errorTracker.captureError(
            error instanceof Error ? error : new Error(error?.message || JSON.stringify(error)),
            {
              severity: ErrorSeverity.LOW,
              category: ErrorCategory.UNKNOWN,
              context: {
                ticketId,
                scannerId: scannedBy,
                operation: 'fraud_detection',
                traceId: traceContextForFraud?.traceId,
              },
              tags: {
                handled: 'true',
                nonBlocking: 'true',
              },
            }
          );
        }
      })();
    }

    // Fetch updated ticket with re-entry fields
    const { data: updatedTicketData } = await traceQuery('scanner.fetchUpdatedTicket', async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(
          `
          id,
          order_id,
          event_id,
          ticket_type_id,
          attendee_name,
          qr_token,
          qr_signature,
          status,
          scanned_at,
          issued_at,
          current_status,
          entry_count,
          exit_count,
          last_entry_at,
          last_exit_at,
          events (
            id,
            name,
            event_date,
            event_time,
            venue_name,
            city
          ),
          ticket_types (
            id,
            name,
            price
          )
        `
        )
        .eq('id', ticketId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    });

    const updatedNormalized = updatedTicketData as TicketQueryRow | null;
    const updatedTicket: TicketWithRelations = {
      ...ticketWithRelations,
      ...(updatedNormalized || {}),
      status: isReEntryMode ? ticketWithRelations.status : 'scanned',
      scanned_at: scannedAt,
      events: updatedNormalized ? normalizeRelation(updatedNormalized.events) : ticketWithRelations.events,
      ticket_types: updatedNormalized ? normalizeRelation(updatedNormalized.ticket_types) : ticketWithRelations.ticket_types,
    };

    // Log successful scan
    log.info('Scan completed', { 
      result: 'valid',
      scanType,
      durationMs,
      overrideUsed,
    });
    
    span.setAttributes({
      'scanner.scan_type': scanType,
      'scanner.duration_ms': durationMs,
    });
    span.addEvent('scan.completed', { scan_type: scanType });
    
    // Publish scan event to event store (fire and forget - don't block scan response)
    const deviceId = typeof window !== 'undefined' 
      ? localStorage.getItem('scanner_device_id') || undefined 
      : undefined;
      
    const eventMetadata = createScannerMetadata({
      scannerId: deviceId,
      deviceId,
      scannedBy,
    });
    
    // Get trace context once for all event publishing
    const traceContextForEvents = getCurrentTraceContext();
    
    if (scanType === 'exit') {
      // Publish exit event
      const exitCount = (updatedTicket as any).exit_count || 1;
      if (traceContextForEvents) {
        const publishSpan = createEventPublishSpan('TicketExit', ticketId, traceContextForEvents);
        publishTicketExit(ticketId, {
          scannedBy,
          scanMethod,
          exitCount,
        }, eventMetadata).then(() => {
          publishSpan.setOk();
          publishSpan.end();
        }).catch((err) => {
          publishSpan.setError(err);
          publishSpan.end();
        });
      } else {
        publishTicketExit(ticketId, {
          scannedBy,
          scanMethod,
          exitCount,
        }, eventMetadata).catch(() => {});
      }
    } else if (isReEntryMode) {
      // Publish re-entry event
      const entryCount = (updatedTicket as any).entry_count || 1;
      if (traceContextForEvents) {
        const publishSpan = createEventPublishSpan('TicketReEntry', ticketId, traceContextForEvents);
        publishTicketReEntry(ticketId, {
          scannedBy,
          scanMethod,
          entryCount,
        }, eventMetadata).then(() => {
          publishSpan.setOk();
          publishSpan.end();
        }).catch((err) => {
          publishSpan.setError(err);
          publishSpan.end();
        });
      } else {
        publishTicketReEntry(ticketId, {
          scannedBy,
          scanMethod,
          entryCount,
        }, eventMetadata).catch(() => {});
      }
    } else {
      // Publish first scan event
      if (traceContextForEvents) {
        const publishSpan = createEventPublishSpan('TicketScanned', ticketId, traceContextForEvents);
        publishTicketScanned(ticketId, {
          scannedBy,
          scanMethod,
          scanDurationMs: durationMs,
          overrideUsed,
          overrideReason: overrideReason || undefined,
        }, eventMetadata).then(() => {
          publishSpan.setOk();
          publishSpan.end();
        }).catch((err) => {
          publishSpan.setError(err);
          publishSpan.end();
        });
      } else {
        publishTicketScanned(ticketId, {
          scannedBy,
          scanMethod,
          scanDurationMs: durationMs,
          overrideUsed,
          overrideReason: overrideReason || undefined,
        }, eventMetadata).catch(() => {});
      }
    }
    
    endTimer();

    // Audit log: successful scan
    logAuditEvent('ticket_scanned', 'ticket', `Ticket scanned successfully${overrideUsed ? ' (override used)' : ''}`, {
      userId: scannedBy,
      resourceId: ticketId,
      severity: 'info',
      metadata: {
        eventId: ticketWithRelations.event_id,
        scanMethod,
        durationMs,
        overrideUsed,
        overrideReason: overrideReason || undefined,
        scanType,
        result: 'valid',
      },
    }).catch(() => {}); // Non-blocking

    span.setOk();
    return { success: true, ticket: updatedTicket, durationMs };
  }, {
    attributes: {
      'operation': 'scanTicket',
    }
  });
};

/**
 * Check if a ticket requires ID verification
 * @param ticket - Ticket with relations
 * @returns Promise<boolean> - true if ID verification is required and not yet verified
 */
export const checkIDVerificationRequired = async (
  ticket: TicketWithRelations
): Promise<boolean> => {
  if (!ticket) return false;

  // Check if already verified
  const alreadyVerified = await isTicketVerified(ticket.id);
  if (alreadyVerified) return false;

  // Check via ticket_type_id if available
  if (ticket.ticket_type_id) {
    const required = await requiresIDVerification(ticket.ticket_type_id);
    if (required) return true;
  }

  // Fallback: check by ticket type name
  const ticketTypeName = ticket.ticket_types?.name || '';
  if (checkIDRequirementByName(ticketTypeName)) {
    return true;
  }

  return false;
};

// ============================================
// SCAN LOG TYPES
// ============================================

/**
 * Scan log entry with ticket and event details
 */
export interface ScanLogEntry {
  id: string;
  ticket_id: string;
  scan_result: string;
  scanned_at: string;
  scanned_by: string | null;
  scan_duration_ms: number | null;
  scan_method: string | null;
  override_used: boolean;
  override_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  /** Related ticket info */
  ticket?: {
    id: string;
    attendee_name: string | null;
    status: string;
    event_id: string;
  } | null;
  /** Related event info */
  event?: {
    id: string;
    name: string;
    event_date: string;
  } | null;
}

/**
 * Filter options for scan log queries
 */
export interface ScanLogFilters {
  /** Filter by scan result (valid, invalid, already_scanned, etc.) */
  scanResult?: string | null;
  /** Filter by scan method (qr, nfc, manual) */
  scanMethod?: string | null;
  /** Filter by scanned_by user */
  scannedBy?: string | null;
  /** Filter by date range - start */
  dateFrom?: string | null;
  /** Filter by date range - end */
  dateTo?: string | null;
  /** Filter by override usage */
  overrideUsed?: boolean | null;
}

// ============================================
// PAGINATED SCAN LOG FUNCTIONS
// ============================================

/**
 * Get scan logs for a specific ticket with pagination
 * 
 * @param ticketId - Ticket ID to get scan logs for
 * @param options - Pagination options
 * @param filters - Additional filter criteria
 * @returns Paginated result with scan logs
 * 
 * @example
 * ```typescript
 * const result = await getScanLogsPaginated(
 *   'ticket-123',
 *   { page: 1, pageSize: 20, sortBy: 'scanned_at', sortOrder: 'desc' }
 * );
 * console.log(result.pagination.totalItems);
 * ```
 */
export async function getScanLogsPaginated(
  ticketId: string,
  options: PaginationOptions = {},
  filters: ScanLogFilters = {}
): Promise<PaginatedResult<ScanLogEntry>> {
  const log = logger.child({ operation: 'getScanLogsPaginated', ticketId: redact(ticketId) });
  
  if (!ticketId) {
    throw new Error('Ticket ID is required');
  }
  
  // Build count query
  let countQuery = supabase
    .from('scan_logs')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_id', ticketId);
  
  // Build data query - only select columns that exist in the database
  let dataQuery = supabase
    .from('scan_logs')
    .select(`
      id,
      ticket_id,
      scan_result,
      scanned_at,
      scanned_by,
      metadata,
      created_at,
      tickets (
        id,
        attendee_name,
        status,
        event_id
      )
    `)
    .eq('ticket_id', ticketId);
  
  // Apply filters
  if (filters.scanResult) {
    countQuery = countQuery.eq('scan_result', filters.scanResult);
    dataQuery = dataQuery.eq('scan_result', filters.scanResult);
  }
  
  if (filters.scanMethod) {
    countQuery = countQuery.eq('scan_method', filters.scanMethod);
    dataQuery = dataQuery.eq('scan_method', filters.scanMethod);
  }
  
  if (filters.scannedBy) {
    countQuery = countQuery.eq('scanned_by', filters.scannedBy);
    dataQuery = dataQuery.eq('scanned_by', filters.scannedBy);
  }
  
  if (filters.dateFrom) {
    countQuery = countQuery.gte('scanned_at', filters.dateFrom);
    dataQuery = dataQuery.gte('scanned_at', filters.dateFrom);
  }
  
  if (filters.dateTo) {
    countQuery = countQuery.lte('scanned_at', filters.dateTo);
    dataQuery = dataQuery.lte('scanned_at', filters.dateTo);
  }
  
  if (filters.overrideUsed !== null && filters.overrideUsed !== undefined) {
    countQuery = countQuery.eq('override_used', filters.overrideUsed);
    dataQuery = dataQuery.eq('override_used', filters.overrideUsed);
  }
  
  // Get count
  const { count, error: countError } = await countQuery;
  
  if (countError) {
    log.error('Failed to get scan log count', { error: countError.message });
    throw new Error(`Failed to get scan logs: ${countError.message}`);
  }
  
  const totalCount = count ?? 0;
  
  // Apply pagination
  dataQuery = applyPagination(dataQuery, {
    ...options,
    sortBy: options.sortBy ?? 'scanned_at',
  });
  
  const { data, error: dataError } = await dataQuery;
  
  if (dataError) {
    log.error('Failed to get scan logs', { error: dataError.message });
    throw new Error(`Failed to get scan logs: ${dataError.message}`);
  }
  
  // Transform data - read extra fields from metadata JSON
  const scanLogs: ScanLogEntry[] = (data ?? []).map((row: any) => ({
    id: row.id,
    ticket_id: row.ticket_id,
    scan_result: row.scan_result,
    scanned_at: row.scanned_at,
    scanned_by: row.scanned_by,
    scan_duration_ms: row.metadata?.scan_duration_ms ?? null,
    scan_method: row.metadata?.scan_method ?? null,
    override_used: row.metadata?.override_used ?? false,
    override_reason: row.metadata?.override_reason ?? null,
    metadata: row.metadata,
    created_at: row.created_at,
    ticket: row.tickets,
  }));

  log.debug('Scan logs fetched', { count: scanLogs.length, totalCount });

  return buildPaginatedResponse(scanLogs, totalCount, options);
}

/**
 * Get all scans for a specific event with pagination
 * 
 * @param eventId - Event ID to get scans for
 * @param options - Pagination options
 * @param filters - Additional filter criteria
 * @returns Paginated result with scan logs
 * 
 * @example
 * ```typescript
 * const result = await getEventScansPaginated(
 *   'event-456',
 *   { page: 1, pageSize: 50, sortBy: 'scanned_at', sortOrder: 'desc' },
 *   { scanResult: 'valid' }
 * );
 * ```
 */
export async function getEventScansPaginated(
  eventId: string,
  options: PaginationOptions = {},
  filters: ScanLogFilters = {}
): Promise<PaginatedResult<ScanLogEntry>> {
  const log = logger.child({ operation: 'getEventScansPaginated', eventId });
  
  if (!eventId) {
    throw new Error('Event ID is required');
  }
  
  // First get all ticket IDs for this event
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('id')
    .eq('event_id', eventId);
  
  if (ticketsError) {
    log.error('Failed to get tickets for event', { error: ticketsError.message });
    throw new Error(`Failed to get event scans: ${ticketsError.message}`);
  }
  
  const ticketIds = (tickets ?? []).map(t => t.id);
  
  if (ticketIds.length === 0) {
    return buildPaginatedResponse([], 0, options);
  }
  
  // Build count query
  let countQuery = supabase
    .from('scan_logs')
    .select('id', { count: 'exact', head: true })
    .in('ticket_id', ticketIds);
  
  // Build data query with event info - only select columns that exist
  let dataQuery = supabase
    .from('scan_logs')
    .select(`
      id,
      ticket_id,
      scan_result,
      scanned_at,
      scanned_by,
      metadata,
      created_at,
      tickets!inner (
        id,
        attendee_name,
        status,
        event_id,
        events (
          id,
          name,
          event_date
        )
      )
    `)
    .in('ticket_id', ticketIds);
  
  // Apply filters
  if (filters.scanResult) {
    countQuery = countQuery.eq('scan_result', filters.scanResult);
    dataQuery = dataQuery.eq('scan_result', filters.scanResult);
  }
  
  if (filters.scanMethod) {
    countQuery = countQuery.eq('scan_method', filters.scanMethod);
    dataQuery = dataQuery.eq('scan_method', filters.scanMethod);
  }
  
  if (filters.scannedBy) {
    countQuery = countQuery.eq('scanned_by', filters.scannedBy);
    dataQuery = dataQuery.eq('scanned_by', filters.scannedBy);
  }
  
  if (filters.dateFrom) {
    countQuery = countQuery.gte('scanned_at', filters.dateFrom);
    dataQuery = dataQuery.gte('scanned_at', filters.dateFrom);
  }
  
  if (filters.dateTo) {
    countQuery = countQuery.lte('scanned_at', filters.dateTo);
    dataQuery = dataQuery.lte('scanned_at', filters.dateTo);
  }
  
  if (filters.overrideUsed !== null && filters.overrideUsed !== undefined) {
    countQuery = countQuery.eq('override_used', filters.overrideUsed);
    dataQuery = dataQuery.eq('override_used', filters.overrideUsed);
  }
  
  // Get count
  const { count, error: countError } = await countQuery;
  
  if (countError) {
    log.error('Failed to get event scan count', { error: countError.message });
    throw new Error(`Failed to get event scans: ${countError.message}`);
  }
  
  const totalCount = count ?? 0;
  
  // Apply pagination
  dataQuery = applyPagination(dataQuery, {
    ...options,
    sortBy: options.sortBy ?? 'scanned_at',
  });
  
  const { data, error: dataError } = await dataQuery;
  
  if (dataError) {
    log.error('Failed to get event scans', { error: dataError.message });
    throw new Error(`Failed to get event scans: ${dataError.message}`);
  }
  
  // Transform data - read extra fields from metadata JSON
  const scanLogs: ScanLogEntry[] = (data ?? []).map((row: any) => ({
    id: row.id,
    ticket_id: row.ticket_id,
    scan_result: row.scan_result,
    scanned_at: row.scanned_at,
    scanned_by: row.scanned_by,
    scan_duration_ms: row.metadata?.scan_duration_ms ?? null,
    scan_method: row.metadata?.scan_method ?? null,
    override_used: row.metadata?.override_used ?? false,
    override_reason: row.metadata?.override_reason ?? null,
    metadata: row.metadata,
    created_at: row.created_at,
    ticket: row.tickets ? {
      id: row.tickets.id,
      attendee_name: row.tickets.attendee_name,
      status: row.tickets.status,
      event_id: row.tickets.event_id,
    } : null,
    event: row.tickets?.events ?? null,
  }));

  log.debug('Event scans fetched', { eventId, count: scanLogs.length, totalCount });

  return buildPaginatedResponse(scanLogs, totalCount, options);
}

/**
 * Get recent scans by a specific scanner/user with pagination
 * 
 * @param scannerId - Scanner ID (user ID or device ID) to get scans for
 * @param options - Pagination options
 * @param filters - Additional filter criteria
 * @returns Paginated result with scan logs
 * 
 * @example
 * ```typescript
 * const result = await getRecentScansPaginated(
 *   'scanner-device-001',
 *   { page: 1, pageSize: 20, sortBy: 'scanned_at', sortOrder: 'desc' }
 * );
 * ```
 */
export async function getRecentScansPaginated(
  scannerId: string,
  options: PaginationOptions = {},
  filters: ScanLogFilters = {}
): Promise<PaginatedResult<ScanLogEntry>> {
  const log = logger.child({ operation: 'getRecentScansPaginated', scannerId: redact(scannerId) });
  
  if (!scannerId) {
    throw new Error('Scanner ID is required');
  }
  
  // Build count query
  let countQuery = supabase
    .from('scan_logs')
    .select('id', { count: 'exact', head: true })
    .eq('scanned_by', scannerId);
  
  // Build data query with ticket and event info - only select columns that exist
  let dataQuery = supabase
    .from('scan_logs')
    .select(`
      id,
      ticket_id,
      scan_result,
      scanned_at,
      scanned_by,
      metadata,
      created_at,
      tickets (
        id,
        attendee_name,
        status,
        event_id,
        events (
          id,
          name,
          event_date
        )
      )
    `)
    .eq('scanned_by', scannerId);
  
  // Apply filters
  if (filters.scanResult) {
    countQuery = countQuery.eq('scan_result', filters.scanResult);
    dataQuery = dataQuery.eq('scan_result', filters.scanResult);
  }
  
  if (filters.scanMethod) {
    countQuery = countQuery.eq('scan_method', filters.scanMethod);
    dataQuery = dataQuery.eq('scan_method', filters.scanMethod);
  }
  
  if (filters.dateFrom) {
    countQuery = countQuery.gte('scanned_at', filters.dateFrom);
    dataQuery = dataQuery.gte('scanned_at', filters.dateFrom);
  }
  
  if (filters.dateTo) {
    countQuery = countQuery.lte('scanned_at', filters.dateTo);
    dataQuery = dataQuery.lte('scanned_at', filters.dateTo);
  }
  
  if (filters.overrideUsed !== null && filters.overrideUsed !== undefined) {
    countQuery = countQuery.eq('override_used', filters.overrideUsed);
    dataQuery = dataQuery.eq('override_used', filters.overrideUsed);
  }
  
  // Get count
  const { count, error: countError } = await countQuery;
  
  if (countError) {
    log.error('Failed to get scanner scan count', { error: countError.message });
    throw new Error(`Failed to get scanner scans: ${countError.message}`);
  }
  
  const totalCount = count ?? 0;
  
  // Apply pagination
  dataQuery = applyPagination(dataQuery, {
    ...options,
    sortBy: options.sortBy ?? 'scanned_at',
  });
  
  const { data, error: dataError } = await dataQuery;
  
  if (dataError) {
    log.error('Failed to get scanner scans', { error: dataError.message });
    throw new Error(`Failed to get scanner scans: ${dataError.message}`);
  }
  
  // Transform data - read extra fields from metadata JSON
  const scanLogs: ScanLogEntry[] = (data ?? []).map((row: any) => ({
    id: row.id,
    ticket_id: row.ticket_id,
    scan_result: row.scan_result,
    scanned_at: row.scanned_at,
    scanned_by: row.scanned_by,
    scan_duration_ms: row.metadata?.scan_duration_ms ?? null,
    scan_method: row.metadata?.scan_method ?? null,
    override_used: row.metadata?.override_used ?? false,
    override_reason: row.metadata?.override_reason ?? null,
    metadata: row.metadata,
    created_at: row.created_at,
    ticket: row.tickets ? {
      id: row.tickets.id,
      attendee_name: row.tickets.attendee_name,
      status: row.tickets.status,
      event_id: row.tickets.event_id,
    } : null,
    event: row.tickets?.events ?? null,
  }));

  log.debug('Scanner scans fetched', { count: scanLogs.length, totalCount });

  return buildPaginatedResponse(scanLogs, totalCount, options);
}

// ============================================
// CURSOR-BASED PAGINATION (REAL-TIME FEEDS)
// ============================================

/**
 * Get scan logs with cursor-based pagination (for real-time feeds)
 * 
 * @param ticketId - Optional ticket ID to filter by
 * @param options - Cursor pagination options
 * @param filters - Additional filter criteria
 * @returns Cursor-paginated result with scan logs
 * 
 * @example
 * ```typescript
 * // Initial load
 * const first = await getScanLogsCursor(null, { limit: 20 });
 * 
 * // Load more
 * const next = await getScanLogsCursor(null, { 
 *   cursor: first.nextCursor, 
 *   limit: 20 
 * });
 * ```
 */
export async function getScanLogsCursor(
  ticketId: string | null,
  options: CursorPaginationOptions = {},
  filters: ScanLogFilters = {}
): Promise<CursorPaginatedResult<ScanLogEntry>> {
  const log = logger.child({ operation: 'getScanLogsCursor' });
  
  // Only select columns that exist in the database
  let query = supabase
    .from('scan_logs')
    .select(`
      id,
      ticket_id,
      scan_result,
      scanned_at,
      scanned_by,
      metadata,
      created_at,
      tickets (
        id,
        attendee_name,
        status,
        event_id,
        events (
          id,
          name,
          event_date
        )
      )
    `);

  // Filter by ticket if provided
  if (ticketId) {
    query = query.eq('ticket_id', ticketId);
  }
  
  // Apply filters
  if (filters.scanResult) {
    query = query.eq('scan_result', filters.scanResult);
  }
  
  if (filters.scanMethod) {
    query = query.eq('scan_method', filters.scanMethod);
  }
  
  if (filters.scannedBy) {
    query = query.eq('scanned_by', filters.scannedBy);
  }
  
  if (filters.dateFrom) {
    query = query.gte('scanned_at', filters.dateFrom);
  }
  
  if (filters.dateTo) {
    query = query.lte('scanned_at', filters.dateTo);
  }
  
  // Apply cursor pagination
  query = applyCursorPagination(query, {
    ...options,
    cursorColumn: 'id',
    sortBy: options.sortBy ?? 'scanned_at',
  });
  
  const { data, error } = await query;
  
  if (error) {
    log.error('Failed to get scan logs with cursor', { error: error.message });
    throw new Error(`Failed to get scan logs: ${error.message}`);
  }
  
  // Transform data - read extra fields from metadata JSON
  const scanLogs: ScanLogEntry[] = (data ?? []).map((row: any) => ({
    id: row.id,
    ticket_id: row.ticket_id,
    scan_result: row.scan_result,
    scanned_at: row.scanned_at,
    scanned_by: row.scanned_by,
    scan_duration_ms: row.metadata?.scan_duration_ms ?? null,
    scan_method: row.metadata?.scan_method ?? null,
    override_used: row.metadata?.override_used ?? false,
    override_reason: row.metadata?.override_reason ?? null,
    metadata: row.metadata,
    created_at: row.created_at,
    ticket: row.tickets ? {
      id: row.tickets.id,
      attendee_name: row.tickets.attendee_name,
      status: row.tickets.status,
      event_id: row.tickets.event_id,
    } : null,
    event: row.tickets?.events ?? null,
  }));

  return buildCursorPaginatedResponse(
    scanLogs,
    options,
    (scan) => scan.id
  );
}

/**
 * Get event scans with cursor-based pagination (for real-time dashboard)
 * 
 * @param eventId - Event ID to get scans for
 * @param options - Cursor pagination options
 * @param filters - Additional filter criteria
 * @returns Cursor-paginated result with scan logs
 */
export async function getEventScansCursor(
  eventId: string,
  options: CursorPaginationOptions = {},
  filters: ScanLogFilters = {}
): Promise<CursorPaginatedResult<ScanLogEntry>> {
  const log = logger.child({ operation: 'getEventScansCursor', eventId });
  
  if (!eventId) {
    throw new Error('Event ID is required');
  }
  
  // Get ticket IDs for this event
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('id')
    .eq('event_id', eventId);
  
  if (ticketsError) {
    log.error('Failed to get tickets for event', { error: ticketsError.message });
    throw new Error(`Failed to get event scans: ${ticketsError.message}`);
  }
  
  const ticketIds = (tickets ?? []).map(t => t.id);
  
  if (ticketIds.length === 0) {
    return {
      data: [],
      nextCursor: null,
      previousCursor: null,
      hasMore: false,
      count: 0,
    };
  }
  
  // Only select columns that exist in the database
  let query = supabase
    .from('scan_logs')
    .select(`
      id,
      ticket_id,
      scan_result,
      scanned_at,
      scanned_by,
      metadata,
      created_at,
      tickets!inner (
        id,
        attendee_name,
        status,
        event_id,
        events (
          id,
          name,
          event_date
        )
      )
    `)
    .in('ticket_id', ticketIds);

  // Apply filters
  if (filters.scanResult) {
    query = query.eq('scan_result', filters.scanResult);
  }

  if (filters.scanMethod) {
    query = query.eq('scan_method', filters.scanMethod);
  }

  if (filters.scannedBy) {
    query = query.eq('scanned_by', filters.scannedBy);
  }

  // Apply cursor pagination
  query = applyCursorPagination(query, {
    ...options,
    cursorColumn: 'id',
    sortBy: options.sortBy ?? 'scanned_at',
  });

  const { data, error } = await query;

  if (error) {
    log.error('Failed to get event scans with cursor', { error: error.message });
    throw new Error(`Failed to get event scans: ${error.message}`);
  }

  // Transform data - read extra fields from metadata JSON
  const scanLogs: ScanLogEntry[] = (data ?? []).map((row: any) => ({
    id: row.id,
    ticket_id: row.ticket_id,
    scan_result: row.scan_result,
    scanned_at: row.scanned_at,
    scanned_by: row.scanned_by,
    scan_duration_ms: row.metadata?.scan_duration_ms ?? null,
    scan_method: row.metadata?.scan_method ?? null,
    override_used: row.metadata?.override_used ?? false,
    override_reason: row.metadata?.override_reason ?? null,
    metadata: row.metadata,
    created_at: row.created_at,
    ticket: row.tickets ? {
      id: row.tickets.id,
      attendee_name: row.tickets.attendee_name,
      status: row.tickets.status,
      event_id: row.tickets.event_id,
    } : null,
    event: row.tickets?.events ?? null,
  }));

  return buildCursorPaginatedResponse(
    scanLogs,
    options,
    (scan) => scan.id
  );
}

/**
 * Get recent scans by scanner with cursor-based pagination
 * 
 * @param scannerId - Scanner ID to get scans for
 * @param options - Cursor pagination options
 * @param filters - Additional filter criteria
 * @returns Cursor-paginated result with scan logs
 */
export async function getRecentScansCursor(
  scannerId: string,
  options: CursorPaginationOptions = {},
  filters: ScanLogFilters = {}
): Promise<CursorPaginatedResult<ScanLogEntry>> {
  const log = logger.child({ operation: 'getRecentScansCursor', scannerId: redact(scannerId) });
  
  if (!scannerId) {
    throw new Error('Scanner ID is required');
  }
  
  // Only select columns that exist in the database
  let query = supabase
    .from('scan_logs')
    .select(`
      id,
      ticket_id,
      scan_result,
      scanned_at,
      scanned_by,
      metadata,
      created_at,
      tickets (
        id,
        attendee_name,
        status,
        event_id,
        events (
          id,
          name,
          event_date
        )
      )
    `)
    .eq('scanned_by', scannerId);

  // Apply filters
  if (filters.scanResult) {
    query = query.eq('scan_result', filters.scanResult);
  }

  if (filters.scanMethod) {
    query = query.eq('scan_method', filters.scanMethod);
  }

  if (filters.dateFrom) {
    query = query.gte('scanned_at', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('scanned_at', filters.dateTo);
  }

  // Apply cursor pagination
  query = applyCursorPagination(query, {
    ...options,
    cursorColumn: 'id',
    sortBy: options.sortBy ?? 'scanned_at',
  });

  const { data, error } = await query;

  if (error) {
    log.error('Failed to get scanner scans with cursor', { error: error.message });
    throw new Error(`Failed to get scanner scans: ${error.message}`);
  }

  // Transform data - read extra fields from metadata JSON
  const scanLogs: ScanLogEntry[] = (data ?? []).map((row: any) => ({
    id: row.id,
    ticket_id: row.ticket_id,
    scan_result: row.scan_result,
    scanned_at: row.scanned_at,
    scanned_by: row.scanned_by,
    scan_duration_ms: row.metadata?.scan_duration_ms ?? null,
    scan_method: row.metadata?.scan_method ?? null,
    override_used: row.metadata?.override_used ?? false,
    override_reason: row.metadata?.override_reason ?? null,
    metadata: row.metadata,
    created_at: row.created_at,
    ticket: row.tickets ? {
      id: row.tickets.id,
      attendee_name: row.tickets.attendee_name,
      status: row.tickets.status,
      event_id: row.tickets.event_id,
    } : null,
    event: row.tickets?.events ?? null,
  }));

  return buildCursorPaginatedResponse(
    scanLogs,
    options,
    (scan) => scan.id
  );
}

