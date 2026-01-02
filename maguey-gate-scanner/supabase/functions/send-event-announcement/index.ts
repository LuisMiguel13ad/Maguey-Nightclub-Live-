// Supabase Edge Function: Send Event Announcement to Newsletter Subscribers
// Sends announcement emails to all active subscribers when owner clicks "Notify Subscribers"

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM_ADDRESS") || "Maguey Nightclub <noreply@magueynightclub.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface EventAnnouncementRequest {
  eventId: string;
  customMessage?: string;
}

interface Event {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  event_time: string;
  venue_name: string | null;
  city: string | null;
  image_url: string | null;
}

const formatEventDate = (dateStr: string, timeStr: string): string => {
  const date = new Date(`${dateStr}T${timeStr}`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatEventTime = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(":");
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const generateAnnouncementEmail = (event: Event, customMessage?: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Event at Maguey</title>
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <h1 style="margin: 0; font-size: 36px; font-weight: bold; color: #39B54A; letter-spacing: 4px;">
                MAGUEY
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #666666; letter-spacing: 2px; text-transform: uppercase;">
                New Event Announcement
              </p>
            </td>
          </tr>

          <!-- Event Image -->
          ${event.image_url ? `
          <tr>
            <td style="padding-bottom: 20px;">
              <img src="${event.image_url}" alt="${event.name}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 16px;" />
            </td>
          </tr>
          ` : ''}

          <!-- Main Content -->
          <tr>
            <td style="background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%); border-radius: 16px; padding: 40px 30px; border: 1px solid rgba(57, 181, 74, 0.2);">

              <!-- Event Name -->
              <h2 style="margin: 0 0 20px 0; font-size: 32px; color: #ffffff; text-align: center;">
                ${event.name}
              </h2>

              <!-- Event Details -->
              <table role="presentation" style="width: 100%; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 30px; vertical-align: top;">
                          <span style="color: #39B54A; font-size: 20px;">📅</span>
                        </td>
                        <td>
                          <span style="color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Date</span><br>
                          <span style="color: #ffffff; font-size: 16px;">${formatEventDate(event.event_date, event.event_time)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 30px; vertical-align: top;">
                          <span style="color: #39B54A; font-size: 20px;">🕐</span>
                        </td>
                        <td>
                          <span style="color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Doors Open</span><br>
                          <span style="color: #ffffff; font-size: 16px;">${formatEventTime(event.event_time)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px 0;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="width: 30px; vertical-align: top;">
                          <span style="color: #39B54A; font-size: 20px;">📍</span>
                        </td>
                        <td>
                          <span style="color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Location</span><br>
                          <span style="color: #ffffff; font-size: 16px;">${event.venue_name || 'Maguey Delaware'}${event.city ? `, ${event.city}` : ''}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${customMessage ? `
              <!-- Custom Message -->
              <div style="background: rgba(57, 181, 74, 0.1); border-left: 3px solid #39B54A; padding: 15px 20px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #cccccc; font-size: 15px; line-height: 1.6;">
                  ${customMessage}
                </p>
              </div>
              ` : ''}

              ${event.description ? `
              <!-- Description -->
              <p style="margin: 0 0 30px 0; color: #aaaaaa; font-size: 14px; line-height: 1.6; text-align: center;">
                ${event.description.replace(/<[^>]*>/g, '').substring(0, 200)}${event.description.length > 200 ? '...' : ''}
              </p>
              ` : ''}

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="https://tickets.magueynightclub.com" style="display: inline-block; padding: 18px 50px; background-color: #39B54A; color: #000000; text-decoration: none; font-weight: bold; font-size: 14px; letter-spacing: 2px; border-radius: 8px; text-transform: uppercase;">
                      GET TICKETS
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; text-align: center; color: #666666; font-size: 12px;">
                Limited capacity. Don't miss out!
              </p>
            </td>
          </tr>

          <!-- Social Links -->
          <tr>
            <td align="center" style="padding: 30px 0;">
              <p style="margin: 0 0 15px 0; font-size: 13px; color: #666666; text-transform: uppercase; letter-spacing: 1px;">
                Follow us
              </p>
              <a href="https://instagram.com/magueynightclub" style="color: #39B54A; text-decoration: none; font-size: 14px; margin: 0 10px;">Instagram</a>
              <span style="color: #333333;">|</span>
              <a href="https://facebook.com/magueynightclub" style="color: #39B54A; text-decoration: none; font-size: 14px; margin: 0 10px;">Facebook</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 20px; border-top: 1px solid #222222;">
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #666666;">
                Maguey Nightclub • 3320 Old Capitol Trl, Wilmington, DE
              </p>
              <p style="margin: 0; font-size: 11px; color: #444444;">
                You're receiving this because you subscribed to Maguey updates.<br>
                <a href="https://magueynightclub.com/unsubscribe" style="color: #666666;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const { eventId, customMessage }: EventAnnouncementRequest = await req.json();

    if (!eventId) {
      return new Response(
        JSON.stringify({ error: "Event ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    // Create Supabase client with service role for admin access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, description, event_date, event_time, venue_name, city, image_url")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    // Fetch all active newsletter subscribers
    const { data: subscribers, error: subError } = await supabase
      .from("newsletter_subscribers")
      .select("email")
      .eq("is_active", true);

    if (subError) {
      console.error("Error fetching subscribers:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscribers" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active subscribers to notify",
          sentCount: 0
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    // Generate email content
    const emailHtml = generateAnnouncementEmail(event as Event, customMessage);
    const emailSubject = `New Event: ${event.name} at Maguey!`;

    // Send emails in batches (Resend supports up to 100 recipients per request)
    const batchSize = 50;
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      const emails = batch.map(s => s.email);

      try {
        // Send to each recipient individually for better deliverability
        for (const email of emails) {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: EMAIL_FROM,
              to: [email],
              subject: emailSubject,
              html: emailHtml,
            }),
          });

          if (response.ok) {
            sentCount++;
          } else {
            failedCount++;
            const errorText = await response.text();
            errors.push(`${email}: ${errorText}`);
          }
        }
      } catch (batchError: any) {
        console.error("Batch send error:", batchError);
        failedCount += batch.length;
        errors.push(batchError.message);
      }
    }

    // Update event to mark newsletter as sent
    await supabase
      .from("events")
      .update({
        newsletter_sent_at: new Date().toISOString(),
        newsletter_sent_count: sentCount
      })
      .eq("id", eventId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Announcement sent to ${sentCount} subscribers`,
        sentCount,
        failedCount,
        totalSubscribers: subscribers.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined // Return first 5 errors for debugging
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      }
    );

  } catch (error: any) {
    console.error("Event announcement error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send announcement" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      }
    );
  }
});
