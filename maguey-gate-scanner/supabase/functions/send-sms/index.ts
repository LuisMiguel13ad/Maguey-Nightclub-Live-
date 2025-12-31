// Supabase Edge Function: Send SMS
// This function sends SMS messages using Twilio or another SMS service
// Configure your SMS service credentials in Supabase secrets

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface SMSRequest {
  to: string[];
  message: string;
  from?: string;
}

Deno.serve(async (req: Request) => {
  try {
    const { to, message, from }: SMSRequest = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get SMS service configuration from environment
    const smsService = Deno.env.get("SMS_SERVICE") || "twilio";
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER") || from || "+1234567890";

    if (!accountSid || !authToken) {
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Twilio integration
    if (smsService === "twilio") {
      const results = [];

      for (const phoneNumber of to) {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

        const formData = new URLSearchParams();
        formData.append("To", phoneNumber);
        formData.append("From", twilioPhoneNumber);
        formData.append("Body", message);

        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        });

        if (!response.ok) {
          const error = await response.text();
          results.push({ to: phoneNumber, success: false, error });
        } else {
          const data = await response.json();
          results.push({ to: phoneNumber, success: true, sid: data.sid });
        }
      }

      const allSuccessful = results.every((r) => r.success);
      return new Response(
        JSON.stringify({
          success: allSuccessful,
          results,
          message: allSuccessful ? "All SMS sent successfully" : "Some SMS failed",
        }),
        { status: allSuccessful ? 200 : 207, headers: { "Content-Type": "application/json" } }
      );
    }
    // MessageBird integration
    else if (smsService === "messagebird") {
      const apiKey = Deno.env.get("MESSAGEBIRD_API_KEY");
      const messagebirdUrl = "https://rest.messagebird.com/messages";

      const results = [];

      for (const phoneNumber of to) {
        const response = await fetch(messagebirdUrl, {
          method: "POST",
          headers: {
            "Authorization": `AccessKey ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipients: [phoneNumber],
            originator: from || "Maguey",
            body: message,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          results.push({ to: phoneNumber, success: false, error });
        } else {
          const data = await response.json();
          results.push({ to: phoneNumber, success: true, id: data.id });
        }
      }

      const allSuccessful = results.every((r) => r.success);
      return new Response(
        JSON.stringify({
          success: allSuccessful,
          results,
          message: allSuccessful ? "All SMS sent successfully" : "Some SMS failed",
        }),
        { status: allSuccessful ? 200 : 207, headers: { "Content-Type": "application/json" } }
      );
    }
    else {
      return new Response(
        JSON.stringify({ error: `Unsupported SMS service: ${smsService}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("SMS sending error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send SMS" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

