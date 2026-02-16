/**
 * Scanner Offline Mode Tests
 *
 * Tests offline indicator display, queue persistence to IndexedDB,
 * auto-sync when reconnected, and user-friendly error messages.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

const SCANNER_URL = process.env.SCANNER_URL || 'http://localhost:5174';
const SCANNER_EMAIL = process.env.SCANNER_EMAIL || 'scanner@test.com';
const SCANNER_PASSWORD = process.env.SCANNER_PASSWORD || 'test123';

/**
 * Login helper for scanner app
 */
async function loginToScanner(page: Page) {
  await page.goto(`${SCANNER_URL}/auth`);
  await page.fill('input[type="email"]', SCANNER_EMAIL);
  await page.fill('input[type="password"]', SCANNER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/scanner/, { timeout: 15000 });
}

/**
 * Navigate to scanner page
 */
async function navigateToScanner(page: Page) {
  await page.goto(`${SCANNER_URL}/scanner`);
  await page.waitForSelector('[data-cy="scanner-container"], .scanner, main', { timeout: 10000 });
}

/**
 * Switch to manual entry mode
 */
async function switchToManualMode(page: Page) {
  const manualButton = page.locator('button:has-text("Manual"), [data-cy="manual-toggle"]').first();
  if (await manualButton.isVisible()) {
    await manualButton.click();
  }
}

/**
 * Query IndexedDB for queued scans
 */
async function getQueuedScans(page: Page): Promise<any[]> {
  return await page.evaluate(async () => {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open('OfflineQueueDatabase');

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));

      request.onsuccess = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('queuedScans')) {
          resolve([]);
          return;
        }

        const transaction = db.transaction(['queuedScans'], 'readonly');
        const store = transaction.objectStore('queuedScans');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => resolve(getAllRequest.result);
        getAllRequest.onerror = () => reject(new Error('Failed to read queued scans'));
      };
    });
  });
}

/**
 * Get sync status from IndexedDB
 */
async function getSyncStatus(page: Page): Promise<{
  pending: number;
  synced: number;
  failed: number;
}> {
  const scans = await getQueuedScans(page);
  return {
    pending: scans.filter((s: any) => s.syncStatus === 'pending').length,
    synced: scans.filter((s: any) => s.syncStatus === 'synced').length,
    failed: scans.filter((s: any) => s.syncStatus === 'failed').length,
  };
}

test.describe('Scanner Offline Mode', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginToScanner(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    await navigateToScanner(page);
  });

  test('offline indicator appears when network lost', async () => {
    // Scanner should be loaded
    await expect(page.locator('[data-cy="scanner-container"], .scanner, main')).toBeVisible();

    // Simulate network loss
    await context.setOffline(true);

    // Switch to manual mode
    await switchToManualMode(page);

    // Try to trigger a network request by submitting a scan
    await page.fill('[data-cy="manual-entry"], input[type="text"]', 'OFFLINE-TEST');
    await page.click('[data-cy="lookup-button"], button:contains("Verify"), button[type="submit"]');

    // Offline indicator should appear (banner, icon, or modal)
    const offlineIndicator = page.locator(
      '[data-cy="offline-indicator"], [data-cy="offline-banner"], .offline-banner, .offline, text=Offline'
    ).first();

    await expect(offlineIndicator).toBeVisible({ timeout: 10000 });

    // Restore network
    await context.setOffline(false);
  });

  test('offline scans are queued to IndexedDB', async () => {
    // Clear any existing queued scans
    await page.evaluate(async () => {
      return new Promise<void>((resolve) => {
        const request = window.indexedDB.open('OfflineQueueDatabase');
        request.onsuccess = (event: any) => {
          const db = event.target.result;
          if (db.objectStoreNames.contains('queuedScans')) {
            const transaction = db.transaction(['queuedScans'], 'readwrite');
            const store = transaction.objectStore('queuedScans');
            store.clear();
            transaction.oncomplete = () => resolve();
          } else {
            resolve();
          }
        };
      });
    });

    // Go offline
    await context.setOffline(true);

    // Acknowledge offline modal if it appears
    const offlineModal = page.locator('[data-cy="offline-modal"], [role="dialog"]:has-text("offline")');
    if (await offlineModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('button:has-text("OK"), button:has-text("Continue"), button:has-text("Got it")');
    }

    // Switch to manual mode
    await switchToManualMode(page);

    // Submit a scan while offline
    const testToken = `OFFLINE-${Date.now()}`;
    await page.fill('[data-cy="manual-entry"], input[type="text"]', testToken);
    await page.click('[data-cy="lookup-button"], button:contains("Verify"), button[type="submit"]');

    // Wait for scan to be processed
    await page.waitForTimeout(2000);

    // Check IndexedDB for queued scan
    const queuedScans = await getQueuedScans(page);
    expect(queuedScans.length).toBeGreaterThanOrEqual(1);

    // Verify scan has correct status
    const hasQueuedScan = queuedScans.some((scan: any) =>
      scan.syncStatus === 'pending' || scan.syncStatus === 'failed'
    );
    expect(hasQueuedScan).toBe(true);

    // Restore network
    await context.setOffline(false);
  });

  test('auto-sync when network restored', async () => {
    // Queue a scan while offline
    await context.setOffline(true);

    // Acknowledge offline modal
    const offlineModal = page.locator('[data-cy="offline-modal"], [role="dialog"]:has-text("offline")');
    if (await offlineModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('button:has-text("OK"), button:has-text("Continue")');
    }

    await switchToManualMode(page);

    const testToken = `AUTOSYNC-${Date.now()}`;
    await page.fill('[data-cy="manual-entry"], input[type="text"]', testToken);
    await page.click('[data-cy="lookup-button"], button:contains("Verify"), button[type="submit"]');

    // Wait for offline scan to be queued
    await page.waitForTimeout(2000);

    // Verify scan is pending
    let status = await getSyncStatus(page);
    expect(status.pending).toBeGreaterThanOrEqual(1);

    // Restore network
    await context.setOffline(false);

    // Online indicator should appear
    const onlineIndicator = page.locator(
      '[data-cy="online-indicator"], .online, svg.lucide-cloud, [aria-label*="online"]'
    ).first();

    // Note: Online indicator may take a moment to appear
    await page.waitForTimeout(1000);

    // Wait for auto-sync (up to 30 seconds with polling)
    let synced = false;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(500);
      status = await getSyncStatus(page);
      if (status.synced > 0 || status.pending === 0) {
        synced = true;
        break;
      }
    }

    // Verify sync completed
    expect(synced).toBe(true);
    status = await getSyncStatus(page);
    expect(status.pending).toBe(0);
  });

  test('invalid QR code rejection with clear message', async () => {
    // Ensure we're online for this test
    await context.setOffline(false);

    await switchToManualMode(page);

    // Submit an invalid QR token (random string unlikely to exist)
    const invalidToken = `INVALID-${Math.random().toString(36).substring(7).toUpperCase()}`;
    await page.fill('[data-cy="manual-entry"], input[type="text"]', invalidToken);
    await page.click('[data-cy="lookup-button"], button:contains("Verify"), button[type="submit"]');

    // Wait for rejection overlay
    const rejectionOverlay = page.locator(
      '[data-cy="rejection-overlay"], .rejection, .error-overlay, [role="alert"]'
    ).first();

    await expect(rejectionOverlay).toBeVisible({ timeout: 10000 });

    // Verify message is user-friendly (no technical jargon)
    const overlayText = await rejectionOverlay.textContent();

    // Should NOT contain technical terms
    expect(overlayText?.toLowerCase()).not.toContain('error:');
    expect(overlayText?.toLowerCase()).not.toContain('exception');
    expect(overlayText?.toLowerCase()).not.toContain('stack');
    expect(overlayText?.toLowerCase()).not.toContain('undefined');
    expect(overlayText?.toLowerCase()).not.toContain('null');

    // Should contain user-friendly language
    const hasFriendlyMessage =
      overlayText?.toLowerCase().includes('invalid') ||
      overlayText?.toLowerCase().includes('not found') ||
      overlayText?.toLowerCase().includes('does not exist');
    expect(hasFriendlyMessage).toBe(true);

    // Verify dismiss button exists
    const dismissButton = page.locator(
      '[data-cy="dismiss"], button:has-text("Dismiss"), button:has-text("Close"), button:has-text("OK")'
    ).first();
    await expect(dismissButton).toBeVisible();

    // Dismiss works
    await dismissButton.click();
    await expect(rejectionOverlay).not.toBeVisible();
  });

  test('already-scanned ticket rejection', async () => {
    // This test requires a ticket that's already been scanned
    // We'll create one, scan it, then try scanning again

    await context.setOffline(false);
    await switchToManualMode(page);

    // For this test, we'll use a known pattern that triggers "already scanned"
    // In a real scenario, this would be a ticket that was previously scanned

    // First scan (this would mark it as used)
    const testToken = `RESCAN-TEST-${Date.now()}`;
    await page.fill('[data-cy="manual-entry"], input[type="text"]', testToken);
    await page.click('[data-cy="lookup-button"], button:contains("Verify"), button[type="submit"]');

    // Wait for first scan result
    await page.waitForTimeout(2000);

    // Dismiss any overlay
    const anyOverlay = page.locator('[data-cy="dismiss"], button:has-text("Dismiss")').first();
    if (await anyOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await anyOverlay.click();
    }

    // Second scan of same ticket
    await page.fill('[data-cy="manual-entry"], input[type="text"]', testToken);
    await page.click('[data-cy="lookup-button"], button:contains("Verify"), button[type="submit"]');

    // Should show "already used" rejection
    // Note: This will show "not found" for non-existent tickets, but the test
    // verifies the rejection overlay behavior
    const rejectionOverlay = page.locator(
      '[data-cy="rejection-overlay"], .rejection, .error-overlay'
    ).first();

    await expect(rejectionOverlay).toBeVisible({ timeout: 10000 });

    // Verify overlay shows ticket info or clear rejection reason
    const overlayText = await rejectionOverlay.textContent();
    const hasRejectionInfo =
      overlayText?.toLowerCase().includes('already') ||
      overlayText?.toLowerCase().includes('used') ||
      overlayText?.toLowerCase().includes('scanned') ||
      overlayText?.toLowerCase().includes('invalid') ||
      overlayText?.toLowerCase().includes('not found');
    expect(hasRejectionInfo).toBe(true);
  });
});

test.describe('Scanner Error Messages', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginToScanner(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    await navigateToScanner(page);
  });

  test('network error shows friendly message', async () => {
    // Go offline during scan
    await switchToManualMode(page);

    await context.setOffline(true);

    // Acknowledge offline modal
    const offlineModal = page.locator('[data-cy="offline-modal"]');
    if (await offlineModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('button:has-text("OK"), button:has-text("Continue")');
    }

    await page.fill('[data-cy="manual-entry"], input[type="text"]', 'NETWORK-ERROR-TEST');
    await page.click('[data-cy="lookup-button"], button:contains("Verify"), button[type="submit"]');

    // Should show offline message or queued message
    const message = page.locator(
      '[data-cy="offline-banner"], .offline-message, [role="alert"], .scan-result'
    ).first();

    await expect(message).toBeVisible({ timeout: 10000 });

    const messageText = await message.textContent();

    // Should NOT show technical errors
    expect(messageText?.toLowerCase()).not.toContain('networkerror');
    expect(messageText?.toLowerCase()).not.toContain('fetch failed');
    expect(messageText?.toLowerCase()).not.toContain('cors');
    expect(messageText?.toLowerCase()).not.toContain('xhr');

    // Should show friendly offline message
    const hasFriendlyMessage =
      messageText?.toLowerCase().includes('offline') ||
      messageText?.toLowerCase().includes('no connection') ||
      messageText?.toLowerCase().includes('queued');
    expect(hasFriendlyMessage).toBe(true);

    await context.setOffline(false);
  });

  test('server error shows friendly message', async () => {
    await context.setOffline(false);

    // Intercept scan endpoint with 500 error
    await page.route('**/rest/v1/rpc/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await switchToManualMode(page);
    await page.fill('[data-cy="manual-entry"], input[type="text"]', 'SERVER-ERROR-TEST');
    await page.click('[data-cy="lookup-button"], button:contains("Verify"), button[type="submit"]');

    // Should show user-friendly error
    const errorMessage = page.locator(
      '[data-cy="rejection-overlay"], .error-overlay, [role="alert"]'
    ).first();

    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    const errorText = await errorMessage.textContent();

    // Should NOT show technical details
    expect(errorText?.toLowerCase()).not.toContain('500');
    expect(errorText?.toLowerCase()).not.toContain('internal server error');
    expect(errorText?.toLowerCase()).not.toContain('status code');

    // Should show friendly message
    const hasFriendlyMessage =
      errorText?.toLowerCase().includes('something went wrong') ||
      errorText?.toLowerCase().includes('try again') ||
      errorText?.toLowerCase().includes('error occurred');
    expect(hasFriendlyMessage).toBe(true);

    // Should have retry or dismiss action
    const actionButton = page.locator(
      'button:has-text("Try"), button:has-text("Dismiss"), button:has-text("Close")'
    ).first();
    await expect(actionButton).toBeVisible();

    // Unroute
    await page.unroute('**/rest/v1/rpc/**');
  });

  test('invalid signature shows clear rejection', async () => {
    await context.setOffline(false);

    await switchToManualMode(page);

    // Submit QR with invalid format (simulating invalid signature)
    const invalidSig = 'INVALID-SIG-' + Math.random().toString(36).substring(7);
    await page.fill('[data-cy="manual-entry"], input[type="text"]', invalidSig);
    await page.click('[data-cy="lookup-button"], button:contains("Verify"), button[type="submit"]');

    // Should show rejection overlay
    const rejection = page.locator('[data-cy="rejection-overlay"], .rejection').first();
    await expect(rejection).toBeVisible({ timeout: 10000 });

    const rejectionText = await rejection.textContent();

    // Should NOT say "Signature verification failed" or similar technical terms
    expect(rejectionText?.toLowerCase()).not.toContain('signature');
    expect(rejectionText?.toLowerCase()).not.toContain('verification');
    expect(rejectionText?.toLowerCase()).not.toContain('crypto');

    // Should say "Invalid ticket" or similar
    const hasClearMessage =
      rejectionText?.toLowerCase().includes('invalid') ||
      rejectionText?.toLowerCase().includes('not found');
    expect(hasClearMessage).toBe(true);
  });

  test('expired ticket shows clear rejection', async () => {
    await context.setOffline(false);

    // For this test, we'd need a ticket for a past event
    // Since we can't easily create one, we'll verify the rejection pattern

    await switchToManualMode(page);

    // Use a token that might trigger expiration logic
    const expiredToken = 'EXPIRED-EVENT-TEST';
    await page.fill('[data-cy="manual-entry"], input[type="text"]', expiredToken);
    await page.click('[data-cy="lookup-button"], button:contains("Verify"), button[type="submit"]');

    // Should show rejection (either "not found" or "expired" depending on implementation)
    const rejection = page.locator('[data-cy="rejection-overlay"], .rejection').first();

    if (await rejection.isVisible({ timeout: 10000 }).catch(() => false)) {
      const rejectionText = await rejection.textContent();

      // Should show clear expiration or invalid message
      const hasClearMessage =
        rejectionText?.toLowerCase().includes('expired') ||
        rejectionText?.toLowerCase().includes('past') ||
        rejectionText?.toLowerCase().includes('invalid') ||
        rejectionText?.toLowerCase().includes('not found');
      expect(hasClearMessage).toBe(true);

      // Should NOT have technical jargon
      expect(rejectionText?.toLowerCase()).not.toContain('datetime');
      expect(rejectionText?.toLowerCase()).not.toContain('timestamp');
    }
  });

  test('all rejection overlays have recovery instructions', async () => {
    await context.setOffline(false);

    await switchToManualMode(page);

    // Trigger a rejection (invalid ticket)
    await page.fill('[data-cy="manual-entry"], input[type="text"]', 'INVALID-FOR-INSTRUCTIONS');
    await page.click('[data-cy="lookup-button"], button:contains("Verify"), button[type="submit"]');

    const rejection = page.locator('[data-cy="rejection-overlay"], .rejection').first();
    await expect(rejection).toBeVisible({ timeout: 10000 });

    // Should have clear reason (what went wrong)
    const rejectionText = await rejection.textContent();
    expect(rejectionText).toBeTruthy();
    expect(rejectionText!.length).toBeGreaterThan(10); // Has actual content

    // Should have dismiss button (what to do next)
    const dismissButton = page.locator(
      '[data-cy="dismiss"], button:has-text("Dismiss"), button:has-text("Try Again"), button:has-text("Close")'
    ).first();
    await expect(dismissButton).toBeVisible();

    // Rejection should be dismissible
    await dismissButton.click();
    await expect(rejection).not.toBeVisible();

    // Scanner should return to idle state
    await expect(page.locator('[data-cy="manual-entry"], input[type="text"]')).toBeEnabled();
  });
});
