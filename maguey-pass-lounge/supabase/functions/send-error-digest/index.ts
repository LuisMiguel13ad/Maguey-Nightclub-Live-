/**
 * Error Digest Email Sender
 *
 * Sends aggregated error notifications to the owner.
 * Called by pg_cron every 15 minutes via pg_net.
 *
 * Plan: 06-05 (Email Alert Digest System)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger, getRequestId } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AlertDigestEntry {
  id: string;
  error_type: string;
  error_hash: string;
  first_occurrence: string;
  last_occurrence: string;
  occurrence_count: number;
  sample_error: {
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = getRequestId(req);
  const logger = createLogger(requestId);

  try {
    logger.info("Starting error digest processing");

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch unnotified errors
    const { data: alerts, error: fetchError } = await supabase
      .from("alert_digest")
      .select("*")
      .is("notified_at", null)
      .order("occurrence_count", { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch alerts: ${fetchError.message}`);
    }

    if (!alerts || alerts.length === 0) {
      logger.info("No unnotified errors, skipping digest");
      return new Response(
        JSON.stringify({ message: "No errors to report", requestId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info("Found unnotified errors", { count: alerts.length });

    // Get owner email
    const ownerEmail = Deno.env.get("OWNER_EMAIL");
    if (!ownerEmail) {
      logger.warn("OWNER_EMAIL not configured, skipping digest");
      return new Response(
        JSON.stringify({ error: "OWNER_EMAIL not configured", requestId }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build email content
    const totalErrors = alerts.reduce(
      (sum: number, a: AlertDigestEntry) => sum + a.occurrence_count,
      0
    );

    const emailHtml = buildDigestEmail(
      alerts as AlertDigestEntry[],
      totalErrors
    );

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      logger.warn("RESEND_API_KEY not configured, skipping digest");
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured", requestId }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const fromEmail =
      Deno.env.get("EMAIL_FROM_ADDRESS") || "alerts@magueynightclub.com";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [ownerEmail],
        subject: `[Alert] ${totalErrors} error${totalErrors > 1 ? "s" : ""} in the last 15 minutes`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Resend API error: ${errorText}`);
    }

    logger.info("Digest email sent", { to: ownerEmail, errorCount: alerts.length });

    // Mark alerts as notified
    const alertIds = alerts.map((a: AlertDigestEntry) => a.id);
    const { error: updateError } = await supabase
      .from("alert_digest")
      .update({ notified_at: new Date().toISOString() })
      .in("id", alertIds);

    if (updateError) {
      logger.warn("Failed to mark alerts as notified", {
        error: updateError.message,
      });
    }

    return new Response(
      JSON.stringify({
        message: "Digest sent",
        requestId,
        alertCount: alerts.length,
        totalErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error("Error sending digest", { error: (error as Error).message });
    return new Response(
      JSON.stringify({ error: (error as Error).message, requestId }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function buildDigestEmail(
  alerts: AlertDigestEntry[],
  totalErrors: number
): string {
  const now = new Date().toISOString();

  const alertRows = alerts
    .map(
      (alert) => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 12px; font-weight: bold; color: #c0392b;">${escapeHtml(alert.error_type)}</td>
      <td style="padding: 12px;">${alert.occurrence_count}x</td>
      <td style="padding: 12px; font-size: 12px; color: #666;">${escapeHtml(alert.sample_error.message || "No message")}</td>
      <td style="padding: 12px; font-size: 12px; color: #888;">${new Date(alert.last_occurrence).toLocaleTimeString()}</td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Error Digest</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #c0392b; margin-bottom: 5px;">Error Digest</h1>
      <p style="color: #666; margin-top: 0;">Generated at ${now}</p>

      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 15px; margin: 20px 0;">
        <strong>${totalErrors} total error${totalErrors > 1 ? "s" : ""}</strong> across ${alerts.length} unique issue${alerts.length > 1 ? "s" : ""}
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 12px; text-align: left;">Type</th>
            <th style="padding: 12px; text-align: left;">Count</th>
            <th style="padding: 12px; text-align: left;">Sample Message</th>
            <th style="padding: 12px; text-align: left;">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          ${alertRows}
        </tbody>
      </table>

      <p style="margin-top: 30px; font-size: 12px; color: #888;">
        This is an automated alert from Maguey Nightclub systems.<br>
        Check the Supabase dashboard for full error details.
      </p>
    </body>
    </html>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
