import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CORS Headers
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// Exponential Backoff Calculator
// ============================================

/**
 * Calculate next retry time using exponential backoff with jitter
 *
 * Base delay: 1 minute
 * Max delay: 30 minutes
 * Schedule: 1min -> 2min -> 4min -> 8min -> 16min (capped at 30min)
 * Jitter: +/- 10% to prevent thundering herd
 */
function calculateNextRetryTime(attemptCount: number): Date {
  const baseDelayMs = 60 * 1000;  // 1 minute
  const maxDelayMs = 30 * 60 * 1000;  // 30 minutes

  // Exponential growth capped at max
  const exponentialDelay = Math.min(
    baseDelayMs * Math.pow(2, attemptCount),
    maxDelayMs
  );

  // Add jitter: +/- 10% to prevent thundering herd
  const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);

  return new Date(Date.now() + exponentialDelay + jitter);
}

// ============================================
// Email Queue Processor
// ============================================

interface EmailQueueEntry {
  id: string;
  email_type: 'ga_ticket' | 'vip_confirmation';
  recipient_email: string;
  subject: string;
  html_body: string;
  related_id: string | null;
  resend_email_id: string | null;
  status: 'pending' | 'processing' | 'sent' | 'delivered' | 'failed';
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string;
  last_error: string | null;
  error_context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("EMAIL_FROM_ADDRESS") || "tickets@magueynightclub.com";
  const now = new Date().toISOString();

  // Check for required API key
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Fetch pending emails ready for retry
  // Batch size of 10 to avoid Resend rate limits
  const { data: pendingEmails, error: fetchError } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_retry_at', now)
    .order('created_at', { ascending: true })
    .limit(10);

  if (fetchError) {
    console.error("Error fetching pending emails:", fetchError);
    return new Response(
      JSON.stringify({ error: fetchError.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // No pending emails
  if (!pendingEmails?.length) {
    return new Response(
      JSON.stringify({ processed: 0, failed: 0, message: "No pending emails" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log(`Processing ${pendingEmails.length} pending emails`);

  let processed = 0;
  let failed = 0;

  for (const email of pendingEmails as EmailQueueEntry[]) {
    // Mark as processing (optimistic locking prevents double-processing)
    const { error: lockError, count: lockCount } = await supabase
      .from('email_queue')
      .update({
        status: 'processing',
        updated_at: now
      })
      .eq('id', email.id)
      .eq('status', 'pending');  // Only lock if still pending

    // If lock failed (count=0 or error), another instance is processing this email
    if (lockError || lockCount === 0) {
      console.warn(`Could not lock email ${email.id}, skipping (likely being processed by another instance)`);
      continue;
    }

    try {
      // Send via Resend API
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email.recipient_email],
          subject: email.subject,
          html: email.html_body,
        }),
      });

      if (response.ok) {
        const { id: resendEmailId } = await response.json();

        // Mark as sent, store Resend ID for webhook correlation
        await supabase
          .from('email_queue')
          .update({
            status: 'sent',
            resend_email_id: resendEmailId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        console.log(`Email ${email.id} sent successfully, Resend ID: ${resendEmailId}`);
        processed++;
      } else {
        // API error - extract error message
        const errorText = await response.text();
        throw new Error(`Resend API error ${response.status}: ${errorText}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const newAttemptCount = email.attempt_count + 1;

      console.error(
        `Email ${email.id} failed (attempt ${newAttemptCount}/${email.max_attempts}):`,
        errorMessage
      );

      if (newAttemptCount >= email.max_attempts) {
        // Max attempts exhausted - mark as permanently failed
        await supabase
          .from('email_queue')
          .update({
            status: 'failed',
            attempt_count: newAttemptCount,
            last_error: errorMessage,
            error_context: {
              final_failure: true,
              timestamp: new Date().toISOString(),
              total_attempts: newAttemptCount
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        console.error(`Email ${email.id} permanently failed after ${newAttemptCount} attempts`);
        failed++;

        // TODO: Phase 2+ can add owner notification for permanently failed emails
      } else {
        // Schedule retry with exponential backoff
        const nextRetry = calculateNextRetryTime(newAttemptCount);

        await supabase
          .from('email_queue')
          .update({
            status: 'pending',
            attempt_count: newAttemptCount,
            next_retry_at: nextRetry.toISOString(),
            last_error: errorMessage,
            error_context: {
              last_attempt: new Date().toISOString(),
              attempt_number: newAttemptCount
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        console.log(`Email ${email.id} scheduled for retry at ${nextRetry.toISOString()}`);
      }
    }
  }

  const result = {
    processed,
    failed,
    total: pendingEmails.length,
    timestamp: new Date().toISOString(),
  };

  console.log(`Queue processing complete:`, result);

  return new Response(
    JSON.stringify(result),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
