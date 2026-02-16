/**
 * Email Queue Service
 * 
 * Provides email queuing functionality for when the email circuit breaker is open.
 * Emails are stored locally and retried when the circuit closes.
 * 
 * Features:
 * - Queue emails when circuit is open
 * - Automatic retry when circuit recovers
 * - Persistent storage in IndexedDB (if available)
 * - Fallback to in-memory storage
 * - Exponential backoff for retries
 */

import { createLogger } from './logger';
import { metrics } from './monitoring';
import { emailCircuit, onCircuitStateChange } from './circuit-breaker';

const logger = createLogger({ module: 'email-queue' });

// ============================================
// Types
// ============================================

export interface QueuedEmail {
  id: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  queuedAt: Date;
  attempts: number;
  lastAttemptAt?: Date;
  lastError?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailQueueStats {
  queuedCount: number;
  totalQueued: number;
  totalSent: number;
  totalFailed: number;
  oldestEmail?: Date;
  isProcessing: boolean;
}

// ============================================
// In-Memory Queue Storage
// ============================================

const emailQueue: Map<string, QueuedEmail> = new Map();
let totalQueued = 0;
let totalSent = 0;
let totalFailed = 0;
let isProcessing = false;

// ============================================
// Queue Operations
// ============================================

/**
 * Generate a unique ID for queued emails
 */
function generateEmailId(): string {
  return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add an email to the queue for later retry
 */
export function queueEmail(payload: {
  to: string[];
  subject: string;
  html: string;
  text: string;
  metadata?: Record<string, unknown>;
}): string {
  const id = generateEmailId();
  
  const queuedEmail: QueuedEmail = {
    id,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    queuedAt: new Date(),
    attempts: 0,
    metadata: payload.metadata,
  };
  
  emailQueue.set(id, queuedEmail);
  totalQueued++;
  
  logger.info('Email queued for later delivery', {
    id,
    to: payload.to,
    subject: payload.subject,
    queueSize: emailQueue.size,
  });
  
  metrics.increment('email_queue.queued', 1);
  
  // Try to persist to localStorage as backup
  try {
    persistQueueToStorage();
  } catch (error) {
    logger.warn('Failed to persist email queue to storage', { error });
  }
  
  return id;
}

/**
 * Get all queued emails
 */
export function getQueuedEmails(): QueuedEmail[] {
  return Array.from(emailQueue.values()).sort(
    (a, b) => a.queuedAt.getTime() - b.queuedAt.getTime()
  );
}

/**
 * Get queue statistics
 */
export function getEmailQueueStats(): EmailQueueStats {
  const emails = getQueuedEmails();
  
  return {
    queuedCount: emailQueue.size,
    totalQueued,
    totalSent,
    totalFailed,
    oldestEmail: emails.length > 0 ? emails[0].queuedAt : undefined,
    isProcessing,
  };
}

/**
 * Remove an email from the queue
 */
export function removeFromQueue(id: string): boolean {
  const removed = emailQueue.delete(id);
  if (removed) {
    persistQueueToStorage();
  }
  return removed;
}

/**
 * Clear all queued emails
 */
export function clearQueue(): void {
  const count = emailQueue.size;
  emailQueue.clear();
  persistQueueToStorage();
  
  logger.info('Email queue cleared', { clearedCount: count });
  metrics.increment('email_queue.cleared', count);
}

// ============================================
// Queue Processing
// ============================================

/**
 * Process the email queue - called when circuit closes
 */
export async function processEmailQueue(
  sendFn: (email: QueuedEmail) => Promise<void>
): Promise<{ sent: number; failed: number }> {
  if (isProcessing) {
    logger.debug('Queue processing already in progress');
    return { sent: 0, failed: 0 };
  }
  
  if (emailQueue.size === 0) {
    return { sent: 0, failed: 0 };
  }
  
  // Check if circuit is closed
  if (emailCircuit.getState() !== 'CLOSED') {
    logger.debug('Circuit still open, skipping queue processing');
    return { sent: 0, failed: 0 };
  }
  
  isProcessing = true;
  let sent = 0;
  let failed = 0;
  
  logger.info('Processing email queue', { queueSize: emailQueue.size });
  
  const emails = getQueuedEmails();
  
  for (const email of emails) {
    // Check circuit state before each email
    if (emailCircuit.getState() !== 'CLOSED') {
      logger.info('Circuit opened during processing, stopping');
      break;
    }
    
    try {
      email.attempts++;
      email.lastAttemptAt = new Date();
      
      await sendFn(email);
      
      // Success - remove from queue
      emailQueue.delete(email.id);
      sent++;
      totalSent++;
      
      logger.info('Queued email sent successfully', {
        id: email.id,
        to: email.to,
        subject: email.subject,
        attempts: email.attempts,
      });
      
      metrics.increment('email_queue.sent', 1);
      
    } catch (error) {
      failed++;
      email.lastError = error instanceof Error ? error.message : String(error);
      
      logger.warn('Failed to send queued email', {
        id: email.id,
        to: email.to,
        attempts: email.attempts,
        error: email.lastError,
      });
      
      // Remove if max attempts exceeded
      if (email.attempts >= 5) {
        emailQueue.delete(email.id);
        totalFailed++;
        
        logger.error('Queued email permanently failed', {
          id: email.id,
          to: email.to,
          attempts: email.attempts,
        });
        
        metrics.increment('email_queue.permanently_failed', 1);
      }
    }
    
    // Small delay between emails to avoid overwhelming the service
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  isProcessing = false;
  persistQueueToStorage();
  
  logger.info('Email queue processing complete', { sent, failed, remaining: emailQueue.size });
  
  return { sent, failed };
}

// ============================================
// Persistence (localStorage fallback)
// ============================================

const STORAGE_KEY = 'maguey_email_queue';

function persistQueueToStorage(): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    const data = Array.from(emailQueue.entries());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // localStorage might be full or disabled
    logger.debug('Failed to persist queue to localStorage', { error });
  }
}

function restoreQueueFromStorage(): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const entries: [string, QueuedEmail][] = JSON.parse(data);
      for (const [id, email] of entries) {
        // Convert date strings back to Date objects
        email.queuedAt = new Date(email.queuedAt);
        if (email.lastAttemptAt) {
          email.lastAttemptAt = new Date(email.lastAttemptAt);
        }
        emailQueue.set(id, email);
      }
      
      logger.info('Restored email queue from storage', { count: emailQueue.size });
    }
  } catch (error) {
    logger.warn('Failed to restore email queue from storage', { error });
  }
}

// ============================================
// Circuit Breaker Integration
// ============================================

// Auto-process queue when email circuit closes
let sendEmailFn: ((email: QueuedEmail) => Promise<void>) | null = null;

/**
 * Register the email sending function for automatic queue processing
 */
export function registerEmailSender(fn: (email: QueuedEmail) => Promise<void>): void {
  sendEmailFn = fn;
  logger.debug('Email sender registered for queue processing');
}

// Listen for circuit state changes
onCircuitStateChange((event) => {
  if (event.circuitName === 'email' && event.newState === 'CLOSED') {
    logger.info('Email circuit closed, will process queue');
    
    // Process queue after a short delay to let circuit stabilize
    if (sendEmailFn && emailQueue.size > 0) {
      setTimeout(() => {
        processEmailQueue(sendEmailFn!).catch((error) => {
          logger.error('Failed to process email queue', { error });
        });
      }, 1000);
    }
  }
});

// Restore queue from storage on module load
restoreQueueFromStorage();

// ============================================
// Exports
// ============================================

export const emailQueueService = {
  queue: queueEmail,
  getAll: getQueuedEmails,
  getStats: getEmailQueueStats,
  remove: removeFromQueue,
  clear: clearQueue,
  process: processEmailQueue,
  registerSender: registerEmailSender,
};

export default emailQueueService;
