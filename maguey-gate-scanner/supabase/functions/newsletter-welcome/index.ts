// Supabase Edge Function: Newsletter Welcome Email
// Sends welcome email to new newsletter subscribers using Resend

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM_ADDRESS") || "Maguey Nightclub <noreply@magueynightclub.com>";

interface WelcomeEmailRequest {
  email: string;
}

const welcomeEmailHtml = (email: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Maguey</title>
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
                Delaware's Premier Nightclub
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%); border-radius: 16px; padding: 40px 30px; border: 1px solid rgba(57, 181, 74, 0.2);">
              <h2 style="margin: 0 0 20px 0; font-size: 28px; color: #ffffff; text-align: center;">
                You're on the list!
              </h2>
              <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 1.6; color: #cccccc; text-align: center;">
                Welcome to the Maguey VIP newsletter. Get ready for exclusive access to:
              </p>

              <!-- Benefits List -->
              <table role="presentation" style="width: 100%; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span style="color: #39B54A; font-size: 18px; margin-right: 12px;">✦</span>
                    <span style="color: #ffffff; font-size: 15px;">Early event announcements & presale access</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span style="color: #39B54A; font-size: 18px; margin-right: 12px;">✦</span>
                    <span style="color: #ffffff; font-size: 15px;">VIP table deals & exclusive promotions</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span style="color: #39B54A; font-size: 18px; margin-right: 12px;">✦</span>
                    <span style="color: #ffffff; font-size: 15px;">Guest list invites for special nights</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <span style="color: #39B54A; font-size: 18px; margin-right: 12px;">✦</span>
                    <span style="color: #ffffff; font-size: 15px;">Behind-the-scenes content & artist announcements</span>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="https://magueynightclub.com" style="display: inline-block; padding: 16px 40px; background-color: #39B54A; color: #000000; text-decoration: none; font-weight: bold; font-size: 14px; letter-spacing: 2px; border-radius: 8px; text-transform: uppercase;">
                      EXPLORE EVENTS
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Social Links -->
          <tr>
            <td align="center" style="padding: 30px 0;">
              <p style="margin: 0 0 15px 0; font-size: 13px; color: #666666; text-transform: uppercase; letter-spacing: 1px;">
                Follow the vibe
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
                Maguey Nightclub • Wilmington, Delaware
              </p>
              <p style="margin: 0; font-size: 11px; color: #444444;">
                You received this email because you signed up at magueynightclub.com.<br>
                <a href="https://magueynightclub.com/unsubscribe?email=${encodeURIComponent(email)}" style="color: #666666;">Unsubscribe</a>
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
    const { email }: WelcomeEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    // Send welcome email via Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email],
        subject: "Welcome to Maguey - You're on the list!",
        html: welcomeEmailHtml(email),
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  } catch (error: any) {
    console.error("Newsletter welcome email error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send welcome email" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
});
