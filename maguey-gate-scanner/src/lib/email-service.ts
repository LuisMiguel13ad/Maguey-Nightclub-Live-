import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export interface EmailOptions {
  to: string | string[];
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

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using Supabase Edge Function or configured email service
 */
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn("Email service not configured - Supabase not available");
    return false;
  }

  try {
    // Use Supabase Edge Function for email sending
    // This assumes you have an email edge function set up
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        from: options.from || 'noreply@maguey.club',
        replyTo: options.replyTo,
        attachments: options.attachments,
      },
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email: string, resetLink: string): Promise<boolean> => {
  return sendEmail({
    to: email,
    subject: "Reset Your Password - Maguey Scanner",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4CAF50;">Reset Your Password</h1>
            <p>You requested to reset your password for your Maguey Scanner account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
              Reset Password
            </a>
            <p>If you didn't request this, please ignore this email.</p>
            <p>This link will expire in 1 hour.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">
              Maguey Scanner - Event Management System
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Reset Your Password\n\nClick this link to reset your password: ${resetLink}\n\nIf you didn't request this, please ignore this email.\n\nThis link will expire in 1 hour.`,
  });
};

/**
 * Send welcome email to new staff member
 */
export const sendWelcomeEmail = async (email: string, name: string, loginLink: string): Promise<boolean> => {
  return sendEmail({
    to: email,
    subject: "Welcome to Maguey Scanner",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4CAF50;">Welcome to Maguey Scanner!</h1>
            <p>Hi ${name},</p>
            <p>Your account has been created. You can now access the scanner system.</p>
            <a href="${loginLink}" style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
              Log In
            </a>
            <p>If you have any questions, please contact your manager.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">
              Maguey Scanner - Event Management System
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Welcome to Maguey Scanner!\n\nHi ${name},\n\nYour account has been created. Log in at: ${loginLink}\n\nIf you have any questions, please contact your manager.`,
  });
};

/**
 * Send event notification email
 */
export const sendEventNotificationEmail = async (
  email: string,
  eventName: string,
  eventDate: string,
  message: string
): Promise<boolean> => {
  return sendEmail({
    to: email,
    subject: `Event Update: ${eventName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4CAF50;">Event Update</h1>
            <h2>${eventName}</h2>
            <p><strong>Date:</strong> ${eventDate}</p>
            <p>${message}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">
              Maguey Scanner - Event Management System
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Event Update: ${eventName}\n\nDate: ${eventDate}\n\n${message}`,
  });
};

/**
 * Save email template to database
 */
export const saveEmailTemplate = async (template: EmailTemplate): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from("email_templates")
      .upsert({
        name: template.name,
        subject: template.subject,
        html: template.html,
        text: template.text,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'name',
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error saving email template:", error);
    return false;
  }
};

/**
 * Get email template by name
 */
export const getEmailTemplate = async (name: string): Promise<EmailTemplate | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("name", name)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error getting email template:", error);
    return null;
  }
};

