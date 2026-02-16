/**
 * VIP Admin Service
 * Service layer for VIP table administration in the scanner app
 * 
 * This re-exports and extends the main VIP admin service from lib/
 */

// Re-export everything from the main VIP admin service
export * from '../lib/vip-tables-admin-service';

// You can add scanner-specific VIP admin utilities here if needed
// Note: vip-tables-admin-service.ts only has named exports, no default export

