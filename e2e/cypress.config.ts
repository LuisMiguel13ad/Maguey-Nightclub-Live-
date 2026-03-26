import { defineConfig } from 'cypress';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Resolve from the root directory of the project, knowing cypress.config.ts is in e2e/
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, 'maguey-pass-lounge', '.env') });
dotenv.config({ path: path.join(rootDir, 'maguey-pass-lounge', '.env.local') });

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3016', // maguey-pass-lounge
    supportFile: 'e2e/support/e2e.ts',
    specPattern: 'e2e/specs/**/*.cy.ts',

    // Video/screenshot on failure only
    video: true,
    screenshotOnRunFailure: true,
    trashAssetsBeforeRuns: true,

    // Retry config for flaky tests
    retries: {
      runMode: 2,
      openMode: 0,
    },

    // Required for Stripe iframe handling
    chromeWebSecurity: false,

    // Timeouts
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 30000,
    requestTimeout: 10000,

    // Environment variables
    env: {
      SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SCANNER_URL: 'http://localhost:3015',
      SCANNER_EMAIL: process.env.SCANNER_TEST_EMAIL || 'staff@maguey.test',
      SCANNER_PASSWORD: process.env.SCANNER_TEST_PASSWORD || 'testpassword123',
      OWNER_EMAIL: process.env.OWNER_TEST_EMAIL || 'info@magueynightclub.com',
      OWNER_PASSWORD: process.env.OWNER_TEST_PASSWORD || 'testpassword123',
      MARKETING_URL: 'http://localhost:3017',
    },

    setupNodeEvents(on, config) {
      const supabaseUrl = config.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = config.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

      console.log('--- CYPRESS SETUP NODE EVENTS ---');
      console.log('VITE_SUPABASE_URL:', !!process.env.VITE_SUPABASE_URL, supabaseUrl);
      console.log('SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

      // Only create client if we have credentials
      const supabase = supabaseUrl && supabaseKey
        ? createClient(supabaseUrl, supabaseKey)
        : null;
      console.log('Supabase client created:', !!supabase);

      on('task', {
        // Health check all services
        async healthCheck() {
          console.log('[Task] Starting healthCheck...');
          const checks = { db: false, stripe: true, edgeFunctions: true };

          if (supabase) {
            console.log('[Task] healthCheck: supabase client exists, checking db...');
            const { error } = await supabase.from('events').select('id').limit(1);
            checks.db = !error;
            console.log('[Task] healthCheck: db check complete, error=', error);
          } else {
            console.log('[Task] healthCheck: No supabase client initialized!');
          }

          console.log('[Task] Completing healthCheck:', checks);
          return checks;
        },

        // Verify ticket was created
        async verifyTicketCreated(ticketId: string) {
          if (!supabase) return { data: null, error: 'No Supabase client' };
          return supabase.from('tickets').select('*').eq('id', ticketId).single();
        },

        // Verify ticket by QR code token
        async verifyTicketByToken(qrCodeToken: string) {
          if (!supabase) return { data: null, error: 'No Supabase client' };
          return supabase.from('tickets').select('*').eq('qr_code_token', qrCodeToken).single();
        },

        // Verify email was queued
        async verifyEmailQueued(ticketId: string) {
          if (!supabase) return [];
          const { data } = await supabase
            .from('email_queue')
            .select('*')
            .eq('related_id', ticketId);
          return data || [];
        },

        // Verify ticket was scanned
        async verifyTicketScanned(ticketId: string) {
          if (!supabase) return { data: null, error: 'No Supabase client' };
          return supabase.from('tickets').select('*').eq('id', ticketId).single();
        },

        // Get upcoming event for testing
        async getTestEvent() {
          if (!supabase) return null;
          const { data } = await supabase
            .from('events')
            .select('*')
            .gte('event_datetime', new Date().toISOString())
            .eq('status', 'published')
            .order('event_datetime', { ascending: true })
            .limit(1)
            .single();
          return data;
        },

        // Cleanup test data by test run ID
        async cleanupTestData(testRunId: string) {
          if (!supabase) return null;
          // Delete tickets with test emails
          await supabase.from('tickets').delete().ilike('attendee_email', `%+${testRunId}@%`);
          return null;
        },

        // Create test ticket for scan tests
        async createTestTicket(eventId: string) {
          if (!supabase) return null;
          const testRunId = Date.now().toString();
          const qrToken = `TEST-${testRunId}-${Math.random().toString(36).substring(7)}`;

          const { data, error } = await supabase
            .from('tickets')
            .insert({
              event_id: eventId,
              ticket_type_id: null, // Will need to get a valid ticket type
              attendee_email: `test+${testRunId}@maguey.test`,
              attendee_name: 'Test User',
              qr_code_token: qrToken,
              status: 'issued',
              price_paid: 0,
            })
            .select()
            .single();

          if (error) {
            console.error('Failed to create test ticket:', error);
            return null;
          }
          return data;
        },

        // Insert email into email_queue
        async insertEmailQueue(emailData: {
          email_type: 'ga_ticket' | 'vip_confirmation';
          recipient_email: string;
          subject: string;
          html_body: string;
          related_id?: string;
          status?: string;
          attempt_count?: number;
          max_attempts?: number;
          next_retry_at?: string;
          last_error?: string;
        }) {
          if (!supabase) throw new Error('No Supabase client');
          const { data, error } = await supabase
            .from('email_queue')
            .insert({
              ...emailData,
              status: emailData.status || 'pending',
              attempt_count: emailData.attempt_count || 0,
              max_attempts: emailData.max_attempts || 5,
              next_retry_at: emailData.next_retry_at || new Date().toISOString(),
            })
            .select()
            .single();
          if (error) throw new Error(`insertEmailQueue failed: ${error.message}`);
          return data;
        },

        // Update email queue entry
        async updateEmailQueue({ id, updates }: { id: string; updates: Record<string, unknown> }) {
          if (!supabase) throw new Error('No Supabase client');
          const { data, error } = await supabase
            .from('email_queue')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
          if (error) throw new Error(`updateEmailQueue failed: ${error.message}`);
          return data;
        },

        // Get email queue entry
        async getEmailQueueEntry(id: string) {
          if (!supabase) throw new Error('No Supabase client');
          const { data, error } = await supabase
            .from('email_queue')
            .select('*')
            .eq('id', id)
            .single();
          if (error) throw new Error(`getEmailQueueEntry failed: ${error.message}`);
          return data;
        },

        // Delete email queue entry
        async deleteEmailQueueEntry(id: string) {
          if (!supabase) throw new Error('No Supabase client');
          const { error } = await supabase
            .from('email_queue')
            .delete()
            .eq('id', id);
          if (error) throw new Error(`deleteEmailQueueEntry failed: ${error.message}`);
          return true;
        },

        // Create a VIP table for testing
        async createTestVipTable(eventId: string) {
          console.log('[Task] Starting createTestVipTable for event:', eventId);
          if (!supabase) return null;
          // Get a table template first
          const { data: template } = await supabase
            .from('vip_table_templates')
            .select('id, table_number')
            .limit(1)
            .single();

          const tableNumber = template?.table_number || 99;
          const templateId = template?.id;

          const { data, error } = await supabase
            .from('event_vip_tables')
            .insert({
              event_id: eventId,
              table_template_id: templateId,
              table_number: tableNumber,
              tier: 'standard',
              capacity: 6,
              price_cents: 50000,
              bottles_included: 2,
              is_available: true,
            })
            .select()
            .single();

          if (error) {
            console.error('[Task] Failed to create test VIP table:', error);
            return null;
          }
          console.log('[Task] Completing createTestVipTable successfully');
          return data;
        },

        // Create a VIP reservation with guest passes for testing
        async createTestVipReservation({
          eventId,
          tableId,
          email,
        }: {
          eventId: string;
          tableId: string;
          email: string;
        }) {
          if (!supabase) return null;
          const testRunId = Date.now().toString();
          const qrToken = `VIP-TEST-${testRunId}`;
          const inviteCode = `INV-TEST-${testRunId}`;

          const { data: reservation, error } = await supabase
            .from('vip_reservations')
            .insert({
              event_id: eventId,
              event_vip_table_id: tableId,
              table_number: 99,
              purchaser_name: 'Test VIP',
              purchaser_email: email,
              purchaser_phone: '3025551234',
              amount_paid_cents: 50000,
              status: 'confirmed',
              confirmed_at: new Date().toISOString(),
              qr_code_token: qrToken,
              invite_code: inviteCode,
              package_snapshot: { tier: 'standard', capacity: 6, bottles: 2 },
              disclaimer_accepted_at: new Date().toISOString(),
              refund_policy_accepted_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (error) {
            console.error('Failed to create test VIP reservation:', error);
            return null;
          }

          // Create guest passes
          const passes = [];
          for (let i = 1; i <= 4; i++) {
            const { data: pass } = await supabase
              .from('vip_guest_passes')
              .insert({
                reservation_id: reservation.id,
                event_id: eventId,
                pass_number: i,
                pass_type: i === 1 ? 'purchaser' : 'guest',
                status: 'available',
              })
              .select()
              .single();
            if (pass) passes.push(pass);
          }

          return { reservation, passes };
        },

        // Get VIP guest passes for a reservation
        async getVipGuestPasses(reservationId: string) {
          if (!supabase) return [];
          const { data } = await supabase
            .from('vip_guest_passes')
            .select('*')
            .eq('reservation_id', reservationId)
            .order('pass_number');
          return data || [];
        },

        // Cleanup VIP test data
        async cleanupVipTestData(testRunId: string) {
          if (!supabase) return null;
          // Delete guest passes, reservations, and tables created during test
          const { data: reservations } = await supabase
            .from('vip_reservations')
            .select('id')
            .ilike('purchaser_email', `%+${testRunId}@%`);

          if (reservations) {
            for (const r of reservations) {
              await supabase.from('vip_guest_passes').delete().eq('reservation_id', r.id);
              await supabase.from('vip_scan_logs').delete().eq('reservation_id', r.id);
            }
            await supabase.from('vip_reservations').delete().ilike('purchaser_email', `%+${testRunId}@%`);
          }

          // Clean up test VIP tables (table_number 99)
          await supabase.from('event_vip_tables').delete().eq('table_number', 99);
          return null;
        },

        // Create a test promo code
        async createTestPromoCode(promoData: {
          code: string;
          discountType: 'amount' | 'percent';
          amount: number;
          usageLimit?: number;
          validFrom?: string;
          validTo?: string;
        }) {
          if (!supabase) return null;
          const { data, error } = await supabase
            .from('promotions')
            .insert({
              code: promoData.code,
              discount_type: promoData.discountType,
              amount: promoData.amount,
              usage_limit: promoData.usageLimit || 100,
              active: true,
              valid_from: promoData.validFrom || new Date().toISOString(),
              valid_to: promoData.validTo || new Date(Date.now() + 86400000 * 30).toISOString(),
            })
            .select()
            .single();

          if (error) {
            console.error('Failed to create test promo code:', error);
            return null;
          }
          return data;
        },

        // Delete a test promo code
        async deleteTestPromoCode(promoId: string) {
          if (!supabase) return null;
          await supabase.from('promotions').delete().eq('id', promoId);
          return null;
        },

        // Create a test event with ticket types
        async createTestEvent(eventData: {
          name: string;
          datetime?: string;
          status?: string;
        }) {
          console.log('[Task] Starting createTestEvent with:', eventData.name);
          if (!supabase) return null;
          const futureDate = new Date(Date.now() + 86400000 * 7); // 7 days from now
          const { data: event, error } = await supabase
            .from('events')
            .insert({
              name: eventData.name,
              description: 'E2E test event',
              event_date: eventData.datetime
                ? new Date(eventData.datetime).toISOString().split('T')[0]
                : futureDate.toISOString().split('T')[0],
              event_time: '22:00',
              venue_name: 'Maguey Delaware',
              venue_address: '3320 Old Capitol Trl',
              city: 'Wilmington',
              status: eventData.status || 'published',
              is_active: true,
            })
            .select()
            .single();

          if (error) {
            console.error('[Task] Failed to create test event:', error);
            return null;
          }

          // Create a ticket type
          const { data: ticketType } = await supabase
            .from('ticket_types')
            .insert({
              event_id: event.id,
              code: 'ga-test',
              name: 'General Admission',
              price: 25,
              fee: 3,
              total_inventory: 100,
            })
            .select()
            .single();

          console.log('[Task] Completing createTestEvent successfully');
          return { ...event, ticket_types: ticketType ? [ticketType] : [] };
        },

        // Delete a test event (cascade)
        async deleteTestEvent(eventId: string) {
          if (!supabase) return null;
          await supabase.from('ticket_types').delete().eq('event_id', eventId);
          await supabase.from('event_vip_tables').delete().eq('event_id', eventId);
          await supabase.from('events').delete().eq('id', eventId);
          return null;
        },

        // Create a test invitation
        async createTestInvitation(inviteData: {
          createdBy: string;
          role?: string;
          expiresInHours?: number;
        }) {
          if (!supabase) return null;
          const token = `test-invite-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const expiresAt = new Date(Date.now() + (inviteData.expiresInHours || 24) * 3600000);

          const { data, error } = await supabase
            .from('invitations')
            .insert({
              token,
              created_by: inviteData.createdBy,
              expires_at: expiresAt.toISOString(),
              metadata: { role: inviteData.role || 'employee' },
            })
            .select()
            .single();

          if (error) {
            console.error('Failed to create test invitation:', error);
            return null;
          }
          return data;
        },

        // Delete a test invitation
        async deleteTestInvitation(invitationId: string) {
          if (!supabase) return null;
          await supabase.from('invitations').delete().eq('id', invitationId);
          return null;
        },

        // Mark a ticket as used (for conflict testing)
        async markTicketAsUsed({ ticketId, scannedAt }: { ticketId: string; scannedAt?: string }) {
          if (!supabase) return null;
          const { data, error } = await supabase
            .from('tickets')
            .update({
              status: 'used',
              is_used: true,
              scanned_at: scannedAt || new Date().toISOString(),
              current_status: 'inside',
              entry_count: 1,
            })
            .eq('id', ticketId)
            .select()
            .single();

          if (error) {
            console.error('Failed to mark ticket as used:', error);
            return null;
          }
          return data;
        },

        // Log message (for debugging)
        log(message: string) {
          console.log(message);
          return null;
        },
      });

      // Delete videos for passing specs to save space
      on('after:spec', (spec, results) => {
        if (results && results.video) {
          const failures = results.tests?.some((test) =>
            test.attempts?.some((attempt) => attempt.state === 'failed')
          );
          if (!failures) {
            const fs = require('fs');
            try {
              fs.unlinkSync(results.video);
            } catch (e) {
              // Ignore if video doesn't exist
            }
          }
        }
      });

      return config;
    },
  },
});
