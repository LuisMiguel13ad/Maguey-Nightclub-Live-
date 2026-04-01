import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

// ============================================
// Reminder Window Configuration
// ============================================

interface ReminderWindow {
  type: "24h" | "2h";
  emailType: "event_reminder_24h" | "event_reminder_2h";
  minMs: number;
  maxMs: number;
  subjectFn: (eventName: string, venueName: string) => string;
}

const REMINDER_WINDOWS: ReminderWindow[] = [
  {
    type: "24h",
    emailType: "event_reminder_24h",
    minMs: 23 * 60 * 60 * 1000,      // 23 hours
    maxMs: 25 * 60 * 60 * 1000,      // 25 hours
    subjectFn: (eventName) => `Tomorrow: ${eventName} — Your ticket is ready`,
  },
  {
    type: "2h",
    emailType: "event_reminder_2h",
    minMs: 1.75 * 60 * 60 * 1000,   // 1h 45m
    maxMs: 2.25 * 60 * 60 * 1000,   // 2h 15m
    subjectFn: (eventName, venueName) =>
      `Tonight at ${venueName || "Maguey"}: ${eventName} starts soon!`,
  },
];

// ============================================
// HTML Email Template
// ============================================

function buildReminderEmailHtml(params: {
  buyerName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress: string;
  reminderType: "24h" | "2h";
}): string {
  const { buyerName, eventName, eventDate, eventTime, venueName, venueAddress, reminderType } =
    params;

  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "America/New_York",
      })
    : "";

  const formattedTime = eventTime
    ? new Date(`2000-01-01T${eventTime}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const headerText =
    reminderType === "24h"
      ? "Your event is tomorrow!"
      : "Your event starts in about 2 hours!";

  const bodyText =
    reminderType === "24h"
      ? `Don't forget — your ticket to <strong>${eventName}</strong> is for tomorrow. Have your QR code ready at the door.`
      : `Get ready — <strong>${eventName}</strong> starts in about 2 hours. Have your QR code ready at the door.`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111;border-radius:12px;border:1px solid #222;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;letter-spacing:2px;">MAGUEY</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Nightclub &amp; Lounge</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <p style="margin:0 0 6px;color:#a78bfa;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">${headerText}</p>
              <h2 style="margin:0 0 28px;color:#fff;font-size:22px;font-weight:700;">${eventName}</h2>

              <!-- Event Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:8px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 20px;">
                    <p style="margin:0;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Date</p>
                    <p style="margin:4px 0 0;color:#fff;font-size:14px;font-weight:600;">${formattedDate}</p>
                  </td>
                </tr>
                ${formattedTime ? `
                <tr>
                  <td style="padding:14px 20px;border-top:1px solid #252525;">
                    <p style="margin:0;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Doors Open</p>
                    <p style="margin:4px 0 0;color:#fff;font-size:14px;font-weight:600;">${formattedTime}</p>
                  </td>
                </tr>` : ""}
                <tr>
                  <td style="padding:14px 20px;border-top:1px solid #252525;">
                    <p style="margin:0;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Venue</p>
                    <p style="margin:4px 0 0;color:#fff;font-size:14px;font-weight:600;">${venueName || "Maguey Nightclub"}</p>
                    ${venueAddress ? `<p style="margin:3px 0 0;color:#9ca3af;font-size:13px;">${venueAddress}</p>` : ""}
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;color:#d1d5db;font-size:14px;">Hi ${buyerName || "there"},</p>
              <p style="margin:0 0 32px;color:#d1d5db;font-size:14px;line-height:1.6;">${bodyText}</p>

              <div style="text-align:center;">
                <a href="https://tickets.magueynightclub.com/account"
                   style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
                  View Your Ticket
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #1f1f1f;text-align:center;">
              <p style="margin:0 0 6px;color:#6b7280;font-size:12px;">Maguey Nightclub • 3320 Old Capitol Trl, Wilmington, DE</p>
              <p style="margin:0;color:#6b7280;font-size:11px;">
                You received this because you purchased a ticket. &nbsp;
                <a href="https://tickets.magueynightclub.com/account" style="color:#7c3aed;text-decoration:underline;">Manage notifications</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const results = {
    enqueued: 0,
    skipped: 0,
    errors: [] as string[],
    timestamp: now.toISOString(),
  };

  // -------------------------------------------------------
  // Fetch opted-out emails once (users who explicitly disabled reminders)
  // Default is opted-in; only exclude those with reminder_emails_enabled = false
  // -------------------------------------------------------
  const optedOutEmails = new Set<string>();
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (!error && users) {
      for (const u of users) {
        if (u.user_metadata?.reminder_emails_enabled === false && u.email) {
          optedOutEmails.add(u.email.toLowerCase());
        }
      }
    }
  } catch (e) {
    // Non-fatal: proceed without opt-out filtering rather than blocking all reminders
    console.warn("Could not fetch opted-out users, sending to all:", e);
  }

  // -------------------------------------------------------
  // Process each reminder window (24h, then 2h)
  // -------------------------------------------------------
  for (const window of REMINDER_WINDOWS) {
    const windowStart = new Date(now.getTime() + window.minMs);
    const windowEnd = new Date(now.getTime() + window.maxMs);

    console.log(
      `Processing ${window.type} window: ${windowStart.toISOString()} – ${windowEnd.toISOString()}`
    );

    // -------------------------------------------------------
    // Step 1: Find events whose combined date+time falls in the window.
    // We filter on date alone first for efficiency, then refine by combined
    // datetime in JS (handles events without a start_time gracefully).
    // NOTE: Adjust column names (date, start_time) if your schema differs.
    // -------------------------------------------------------
    const windowStartDate = windowStart.toISOString().split("T")[0];
    const windowEndDate = windowEnd.toISOString().split("T")[0];

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, name, event_date, event_time, venue_name, city")
      .gte("event_date", windowStartDate)
      .lte("event_date", windowEndDate);

    if (eventsError) {
      console.error(`Error fetching events for ${window.type}:`, eventsError);
      results.errors.push(`${window.type} events query: ${eventsError.message}`);
      continue;
    }

    // Refine: filter to events whose combined datetime (event_date + event_time) is in the window
    const eligibleEvents = (events || []).filter((event) => {
      const dateStr = event.event_time
        ? `${event.event_date}T${event.event_time}`
        : `${event.event_date}T00:00:00`;
      const eventDatetime = new Date(dateStr);
      return eventDatetime >= windowStart && eventDatetime <= windowEnd;
    });

    if (eligibleEvents.length === 0) {
      console.log(`No events in ${window.type} window`);
      continue;
    }

    const eventIds = eligibleEvents.map((e) => e.id);

    // Build lookup map for event details (venue info is directly on the events row)
    const eventMap = new Map(eligibleEvents.map((e) => [e.id, e]));

    // -------------------------------------------------------
    // Step 2: Fetch valid tickets for these events
    // -------------------------------------------------------
    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("id, event_id, order_id")
      .in("event_id", eventIds)
      .not("status", "in", "(cancelled,transferred,refunded,voided)");

    if (ticketsError) {
      console.error(`Error fetching tickets for ${window.type}:`, ticketsError);
      results.errors.push(`${window.type} tickets query: ${ticketsError.message}`);
      continue;
    }

    if (!tickets?.length) {
      console.log(`No valid tickets for ${window.type} window`);
      continue;
    }

    const ticketIds = tickets.map((t) => t.id);
    const orderIds = [...new Set(tickets.map((t) => t.order_id).filter(Boolean))];

    // -------------------------------------------------------
    // Step 3: Fetch already-sent reminders for this window (deduplication)
    // -------------------------------------------------------
    const { data: alreadySent } = await supabase
      .from("event_reminder_log")
      .select("ticket_id")
      .eq("reminder_type", window.type)
      .in("ticket_id", ticketIds);

    const alreadySentIds = new Set((alreadySent || []).map((r) => r.ticket_id));

    // -------------------------------------------------------
    // Step 4: Fetch buyer info from orders
    // -------------------------------------------------------
    const { data: orders } = await supabase
      .from("orders")
      .select("id, purchaser_email, customer_email, purchaser_name, customer_first_name, customer_last_name")
      .in("id", orderIds);

    const orderMap = new Map((orders || []).map((o: Record<string, string | null>) => [o.id, o]));

    // -------------------------------------------------------
    // Step 5: Enqueue reminders
    // -------------------------------------------------------
    for (const ticket of tickets) {
      // Skip if already reminded
      if (alreadySentIds.has(ticket.id)) {
        results.skipped++;
        continue;
      }

      const order = orderMap.get(ticket.order_id) as Record<string, string | null> | undefined;
      const buyerEmailRaw =
        (order?.purchaser_email || order?.customer_email || "").trim();
      if (!buyerEmailRaw) {
        console.warn(`No buyer email for ticket ${ticket.id}, skipping`);
        results.skipped++;
        continue;
      }

      const buyerEmail = buyerEmailRaw.toLowerCase();

      // Opt-out check
      if (optedOutEmails.has(buyerEmail)) {
        await supabase
          .from("event_reminder_log")
          .upsert(
            { ticket_id: ticket.id, event_id: ticket.event_id, reminder_type: window.type, status: "skipped" },
            { onConflict: "ticket_id,reminder_type", ignoreDuplicates: true }
          );
        results.skipped++;
        continue;
      }

      const event = eventMap.get(ticket.event_id) as Record<string, string | null> | undefined;
      const eventName = event?.name || "Your Event";
      const venueName = event?.venue_name || "Maguey Nightclub";
      const venueAddress = event?.city
        ? `Wilmington, ${event.city}`
        : "3320 Old Capitol Trl, Wilmington, DE";

      const buyerName =
        order?.purchaser_name ||
        [order?.customer_first_name, order?.customer_last_name].filter(Boolean).join(" ") ||
        "";

      const subject = window.subjectFn(eventName, venueName);
      const htmlBody = buildReminderEmailHtml({
        buyerName,
        eventName,
        eventDate: event?.event_date || "",
        eventTime: event?.event_time || "",
        venueName,
        venueAddress,
        reminderType: window.type,
      });

      // Insert reminder log FIRST (unique constraint prevents race conditions)
      const { error: logError } = await supabase.from("event_reminder_log").insert({
        ticket_id: ticket.id,
        event_id: ticket.event_id,
        reminder_type: window.type,
        status: "sent",
      });

      if (logError) {
        // code 23505 = unique_violation (already sent in a concurrent run)
        if (logError.code === "23505") {
          results.skipped++;
          continue;
        }
        console.error(`Failed to log reminder for ticket ${ticket.id}:`, logError);
        results.errors.push(`log ${ticket.id}: ${logError.message}`);
        continue;
      }

      // Enqueue the email (processed by process-email-queue cron)
      const { error: enqueueError } = await supabase.from("email_queue").insert({
        email_type: window.emailType,
        recipient_email: buyerEmailRaw,
        subject,
        html_body: htmlBody,
        related_id: ticket.id,
        status: "pending",
        attempt_count: 0,
        max_attempts: 3,
        next_retry_at: new Date().toISOString(),
        error_context: {},
      });

      if (enqueueError) {
        console.error(`Failed to enqueue reminder for ticket ${ticket.id}:`, enqueueError);
        // Roll back the log entry so the next cron run retries
        await supabase
          .from("event_reminder_log")
          .update({ status: "failed" })
          .eq("ticket_id", ticket.id)
          .eq("reminder_type", window.type);
        results.errors.push(`enqueue ${ticket.id}: ${enqueueError.message}`);
      } else {
        results.enqueued++;
        console.log(
          `Queued ${window.type} reminder for ticket ${ticket.id} → ${buyerEmailRaw}`
        );
      }
    }
  }

  console.log("Reminder run complete:", results);

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});
