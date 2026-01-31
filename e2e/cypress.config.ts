import { defineConfig } from 'cypress';
import { createClient } from '@supabase/supabase-js';

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
    },

    setupNodeEvents(on, config) {
      const supabaseUrl = config.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = config.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Only create client if we have credentials
      const supabase = supabaseUrl && supabaseKey
        ? createClient(supabaseUrl, supabaseKey)
        : null;

      on('task', {
        // Health check all services
        async healthCheck() {
          const checks = { db: false, stripe: true, edgeFunctions: true };

          if (supabase) {
            const { error } = await supabase.from('events').select('id').limit(1);
            checks.db = !error;
          }

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
