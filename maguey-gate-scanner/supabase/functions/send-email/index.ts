// Supabase Edge Function: Send Email
// This function sends emails using a configured email service (SendGrid, Mailgun, etc.)
// Configure your email service credentials in Supabase secrets

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface EmailRequest {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}

Deno.serve(async (req: Request) => {
  try {
    const { to, subject, html, text, from, replyTo, attachments }: EmailRequest = await req.json();

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get email service configuration from environment
    const emailService = Deno.env.get("EMAIL_SERVICE") || "sendgrid"; // sendgrid, mailgun, ses
    const apiKey = Deno.env.get("EMAIL_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    let result;

    // SendGrid integration
    if (emailService === "sendgrid") {
      const sendGridUrl = "https://api.sendgrid.com/v3/mail/send";
      
      const emailData = {
        personalizations: to.map((email) => ({ to: [{ email }] })),
        from: { email: from || Deno.env.get("EMAIL_FROM") || "noreply@maguey.club" },
        subject,
        content: [
          ...(html ? [{ type: "text/html", value: html }] : []),
          ...(text ? [{ type: "text/plain", value: text }] : []),
        ],
        ...(replyTo ? { reply_to: { email: replyTo } } : {}),
        ...(attachments ? {
          attachments: attachments.map((att) => ({
            content: att.content,
            filename: att.filename,
            type: att.contentType || "application/octet-stream",
            disposition: "attachment",
          })),
        } : {}),
      };

      const response = await fetch(sendGridUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SendGrid error: ${error}`);
      }

      result = { success: true, message: "Email sent successfully" };
    }
    // Mailgun integration
    else if (emailService === "mailgun") {
      const domain = Deno.env.get("MAILGUN_DOMAIN");
      const mailgunUrl = `https://api.mailgun.net/v3/${domain}/messages`;

      const formData = new FormData();
      to.forEach((email) => formData.append("to", email));
      formData.append("from", from || `noreply@${domain}`);
      formData.append("subject", subject);
      if (html) formData.append("html", html);
      if (text) formData.append("text", text);
      if (replyTo) formData.append("h:Reply-To", replyTo);

      if (attachments) {
        attachments.forEach((att) => {
          const blob = new Blob([att.content], { type: att.contentType || "application/octet-stream" });
          formData.append("attachment", blob, att.filename);
        });
      }

      const response = await fetch(mailgunUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`api:${apiKey}`)}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Mailgun error: ${error}`);
      }

      result = { success: true, message: "Email sent successfully" };
    }
    // AWS SES integration
    else if (emailService === "ses") {
      // AWS SES integration would go here
      // Requires AWS SDK setup
      result = { success: false, message: "SES integration not yet implemented" };
    }
    else {
      return new Response(
        JSON.stringify({ error: `Unsupported email service: ${emailService}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Email sending error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

