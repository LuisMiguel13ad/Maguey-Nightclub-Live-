/**
 * Orders Service — Re-export barrel
 *
 * This file preserves backward compatibility for existing imports.
 * All logic has been split into domain modules under ./orders/
 *
 * Modules:
 *   types.ts          — Shared type definitions
 *   availability.ts   — Ticket availability checking
 *   order-creation.ts — Order + ticket creation, saga orchestration
 *   ticket-insertion.ts — Ticket generation and insertion
 *   email-refunds.ts  — Email resend, refund requests
 *   queries.ts        — Order/ticket listing and pagination
 *   reporting.ts      — Dashboard stats and reports
 *   user-tickets.ts   — Customer-facing ticket queries
 */
export * from './orders';
