import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export interface SMSOptions {
  to: string | string[];
  message: string;
  from?: string;
}

/**
 * Send SMS using Supabase Edge Function or configured SMS service (Twilio, etc.)
 */
export const sendSMS = async (options: SMSOptions): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn("SMS service not configured - Supabase not available");
    return false;
  }

  try {
    // Use Supabase Edge Function for SMS sending
    // This assumes you have an SMS edge function set up (e.g., using Twilio)
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: {
        to: Array.isArray(options.to) ? options.to : [options.to],
        message: options.message,
        from: options.from || 'Maguey',
      },
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error sending SMS:", error);
    return false;
  }
};

/**
 * Send capacity alert SMS
 */
export const sendCapacityAlertSMS = async (
  phoneNumber: string,
  eventName: string,
  currentCount: number,
  capacity: number,
  percentage: number
): Promise<boolean> => {
  const message = `Maguey Alert: ${eventName} is ${percentage.toFixed(0)}% full (${currentCount}/${capacity}). ${capacity - currentCount} tickets remaining.`;
  return sendSMS({
    to: phoneNumber,
    message,
  });
};

/**
 * Send ticket purchase confirmation SMS
 */
export const sendTicketConfirmationSMS = async (
  phoneNumber: string,
  eventName: string,
  ticketCount: number,
  ticketIds: string[]
): Promise<boolean> => {
  const message = `Maguey: Your ${ticketCount} ticket(s) for ${eventName} have been confirmed. Ticket IDs: ${ticketIds.slice(0, 3).join(', ')}${ticketIds.length > 3 ? '...' : ''}. Check your email for QR codes.`;
  return sendSMS({
    to: phoneNumber,
    message,
  });
};

/**
 * Send shift reminder SMS
 */
export const sendShiftReminderSMS = async (
  phoneNumber: string,
  eventName: string,
  shiftStart: string
): Promise<boolean> => {
  const message = `Maguey Reminder: Your shift for ${eventName} starts at ${new Date(shiftStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit'})}. Please arrive 15 minutes early.`;
  return sendSMS({
    to: phoneNumber,
    message,
  });
};

/**
 * Send low capacity warning SMS
 */
export const sendLowCapacityWarningSMS = async (
  phoneNumber: string,
  eventName: string,
  remainingTickets: number
): Promise<boolean> => {
  const message = `Maguey Alert: ${eventName} has only ${remainingTickets} ticket(s) remaining. Consider promoting or preparing for sellout.`;
  return sendSMS({
    to: phoneNumber,
    message,
  });
};

/**
 * Check if SMS notifications are enabled for a user
 */
export const isSMSEnabled = async (userId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  try {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("sms_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data?.sms_enabled || false;
  } catch (error) {
    console.error("Error checking SMS preferences:", error);
    return false;
  }
};

/**
 * Get user phone number from profile
 */
export const getUserPhoneNumber = async (userId: string): Promise<string | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("phone_number")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data?.phone_number || null;
  } catch (error) {
    console.error("Error getting user phone number:", error);
    return null;
  }
};

