import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import sgMail from '@sendgrid/mail';

// Firebase Admin SDK (server-side only - requires Node.js environment)
// Note: This will only work in server-side contexts (API routes, server functions)
// For client-side web push, use Firebase client SDK instead
let firebaseAdmin: typeof import('firebase-admin') | null = null;

// Lazy load firebase-admin to avoid errors in browser environments
async function getFirebaseAdmin() {
  if (firebaseAdmin) return firebaseAdmin;
  
  // Only import in Node.js environments
  if (typeof window === 'undefined' && typeof process !== 'undefined') {
    try {
      firebaseAdmin = await import('firebase-admin');
      return firebaseAdmin;
    } catch (error) {
      console.warn('[Notification] Firebase Admin SDK not available (browser environment):', error);
      return null;
    }
  }
  
  return null;
}

// Types for notification system (may not exist in generated types yet)
type NotificationRule = {
  id: string;
  recipients?: string[];
  channels?: string[];
  template_title?: string;
  template_message?: string;
  conditions?: any;
  [key: string]: any;
};

type Notification = {
  id: string;
  rule_id?: string;
  trigger_event_id?: string;
  severity: string;
  title: string;
  message: string;
  channels_used?: string[];
  recipients?: string[];
  metadata?: Record<string, any>;
  status: string;
  sent_at?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  created_at?: string;
  [key: string]: any;
};

type UserPreferences = {
  user_id: string;
  email_enabled?: boolean;
  sms_enabled?: boolean;
  push_enabled?: boolean;
  browser_enabled?: boolean;
  min_severity?: string;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  preferences?: Record<string, any>;
  [key: string]: any;
};

export type TriggerType = 
  | 'entry_rate_drop'
  | 'capacity_threshold'
  | 'battery_low'
  | 'device_offline'
  | 'wait_time_unusual'
  | 'fraud_alert'
  | 'revenue_milestone'
  | 'vip_ticket'
  | 'emergency';

export type NotificationChannel = 
  | 'email'
  | 'sms'
  | 'push'
  | 'webhook'
  | 'slack'
  | 'discord'
  | 'browser';

export type NotificationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface NotificationTrigger {
  type: TriggerType;
  eventId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationContext {
  title: string;
  message: string;
  severity: NotificationSeverity;
  metadata?: Record<string, any>;
}

/**
 * Check if notification should be throttled
 */
async function shouldThrottle(ruleId: string): Promise<boolean> {
  try {
    const { data, error } = await (supabase.rpc as any)('should_throttle_notification', {
      rule_id_param: ruleId,
    });

    if (error) {
      console.error('Error checking throttle:', error);
      return false; // Allow notification on error
    }

    return data === true;
  } catch (error) {
    console.warn('Throttle check function not available:', error);
    return false; // Allow notification if function doesn't exist
  }
}

/**
 * Record that a notification was sent (for throttling)
 */
async function recordThrottle(ruleId: string): Promise<void> {
  try {
    await (supabase.rpc as any)('record_notification_throttle', {
      rule_id_param: ruleId,
    });
  } catch (error) {
    console.warn('Throttle record function not available:', error);
  }
}

/**
 * Get user notification preferences
 */
async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const { data, error } = await (supabase.from as any)('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error fetching user preferences:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.warn('User preferences table not available:', error);
    return null;
  }
}

/**
 * Check if current time is in quiet hours
 */
function isInQuietHours(
  quietStart: string | null,
  quietEnd: string | null
): boolean {
  if (!quietStart || !quietEnd) return false;

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight

  const startParts = quietStart.split(':');
  const endParts = quietEnd.split(':');
  const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
  const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

  // Handle quiet hours that span midnight
  if (startMinutes <= endMinutes) {
    return currentTime >= startMinutes && currentTime < endMinutes;
  } else {
    return currentTime >= startMinutes || currentTime < endMinutes;
  }
}

/**
 * Filter channels based on user preferences
 */
function filterChannelsByPreferences(
  channels: NotificationChannel[],
  preferences: UserPreferences | null,
  severity: NotificationSeverity
): NotificationChannel[] {
  if (!preferences) {
    // Default: allow email, push, browser
    return channels.filter(c => ['email', 'push', 'browser'].includes(c));
  }

  // Check minimum severity
  const severityLevels: Record<NotificationSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  const userMinLevel = severityLevels[preferences.min_severity as NotificationSeverity] || 2;
  const notificationLevel = severityLevels[severity] || 2;

  if (notificationLevel < userMinLevel) {
    return []; // User doesn't want notifications of this severity
  }

  // Check quiet hours
  if (isInQuietHours(preferences.quiet_hours_start, preferences.quiet_hours_end)) {
    // Only allow critical notifications during quiet hours
    if (severity !== 'critical') {
      return [];
    }
  }

  // Filter channels based on user preferences
  return channels.filter(channel => {
    switch (channel) {
      case 'email':
        return preferences.email_enabled;
      case 'sms':
        return preferences.sms_enabled;
      case 'push':
        return preferences.push_enabled;
      case 'browser':
        return preferences.browser_enabled;
      case 'webhook':
      case 'slack':
      case 'discord':
        // These are configured in preferences.jsonb
        return preferences.preferences && 
               (preferences.preferences as any)[`${channel}_webhook`];
      default:
        return false;
    }
  });
}

/**
 * Send browser notification
 */
async function sendBrowserNotification(
  title: string,
  message: string,
  severity: NotificationSeverity
): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  // Request permission if not granted
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const icon = '/logo.png';
  const badge = '/logo.png';

  const notification = new Notification(title, {
    body: message,
    icon,
    badge,
    tag: `notification-${Date.now()}`,
    requireInteraction: severity === 'critical',
  });

  // Auto-close after 5 seconds (unless critical)
  if (severity !== 'critical') {
    setTimeout(() => notification.close(), 5000);
  }

  return true;
}

/**
 * Get user email addresses from user IDs
 * Note: In client-side code, we need to use a Supabase RPC function or profiles table
 * since we can't directly access auth.users
 */
async function getUserEmails(userIds: string[]): Promise<string[]> {
  const emails: string[] = [];
  
  // Try to get emails from profiles table first
  try {
    const { data: profiles, error } = await (supabase.from as any)('profiles')
      .select('id, email')
      .in('id', userIds);
    
    if (!error && profiles && Array.isArray(profiles)) {
      const profileMap = new Map(profiles.map((p: any) => [p.id, p.email]));
      for (const userId of userIds) {
        const email = profileMap.get(userId);
        if (email) {
          emails.push(email);
        }
      }
    }
  } catch (error) {
    console.warn('[Notification] Could not get emails from profiles table:', error);
  }
  
  // If we still don't have all emails, try RPC function if available
  if (emails.length < userIds.length) {
    const foundEmails = new Set(emails);
    const missingIds = userIds.filter(id => !foundEmails.has(id));
    try {
      const result = await (supabase.rpc as any)('get_user_emails', {
        user_ids: missingIds
      });
      
      const { data: userEmails, error: rpcError } = result || { data: null, error: null };
      
      if (!rpcError && userEmails && Array.isArray(userEmails)) {
        userEmails.forEach((email: string) => {
          if (email && !emails.includes(email)) {
            emails.push(email);
          }
        });
      }
    } catch (error) {
      console.warn('[Notification] RPC function not available or failed:', error);
    }
  }
  
  // Final fallback: if recipientId looks like an email, use it directly
  // This handles cases where recipients might already be email addresses
  for (const userId of userIds) {
    if (userId.includes('@') && !emails.includes(userId)) {
      emails.push(userId);
    }
  }
  
  return emails;
}

/**
 * Get SendGrid template ID based on notification type
 */
function getTemplateId(notificationType?: string): string | undefined {
  const templateMap: Record<string, string> = {
    battery_low: import.meta.env.VITE_SENDGRID_TEMPLATE_BATTERY_LOW,
    capacity_threshold: import.meta.env.VITE_SENDGRID_TEMPLATE_CAPACITY,
    fraud_alert: import.meta.env.VITE_SENDGRID_TEMPLATE_FRAUD,
    device_offline: import.meta.env.VITE_SENDGRID_TEMPLATE_OFFLINE,
    vip_ticket: import.meta.env.VITE_SENDGRID_TEMPLATE_VIP,
    emergency: import.meta.env.VITE_SENDGRID_TEMPLATE_EMERGENCY,
  };
  
  return notificationType ? templateMap[notificationType] : undefined;
}

/**
 * Generate HTML email template
 */
function generateEmailHTML(
  title: string,
  message: string,
  metadata?: Record<string, any>
): string {
  const severity = metadata?.severity || 'medium';
  const severityColors: Record<string, string> = {
    low: '#36a64f',
    medium: '#ffaa00',
    high: '#ff8800',
    critical: '#ff0000',
  };
  
  const color = severityColors[severity] || '#666';
  const timestamp = new Date().toLocaleString();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-left: 4px solid ${color}; padding-left: 20px; margin-bottom: 30px;">
    <h1 style="color: ${color}; margin-top: 0;">${title}</h1>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 0; white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
    </div>
    ${metadata && Object.keys(metadata).length > 0 ? `
    <div style="margin-top: 20px;">
      <h3 style="font-size: 14px; color: #666; margin-bottom: 10px;">Additional Details:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${Object.entries(metadata)
          .filter(([key]) => !['severity', 'type'].includes(key))
          .map(([key, value]) => `
        <tr>
          <td style="padding: 5px 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">${key}:</td>
          <td style="padding: 5px 10px; border-bottom: 1px solid #eee;">${String(value)}</td>
        </tr>
        `).join('')}
      </table>
    </div>
    ` : ''}
    <p style="color: #999; font-size: 12px; margin-top: 30px;">
      Sent at ${timestamp}<br>
      Maguey Gate Scanner System
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send email via AWS SES (fallback)
 */
async function sendEmailViaSES(
  recipients: string[],
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    const sesEndpoint = import.meta.env.VITE_AWS_SES_ENDPOINT;
    const sesRegion = import.meta.env.VITE_AWS_SES_REGION || 'us-east-1';
    
    if (!sesEndpoint) {
      console.warn('[Notification] AWS SES endpoint not configured');
      return false;
    }
    
    // AWS SES API call via fetch
    const response = await fetch(sesEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients,
        subject: title,
        text: message,
        html: generateEmailHTML(title, message, metadata),
        from: import.meta.env.VITE_SENDGRID_FROM_EMAIL,
        fromName: import.meta.env.VITE_SENDGRID_FROM_NAME,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`AWS SES API error: ${response.statusText}`);
    }
    
    console.log('[Notification] Email sent via AWS SES', { 
      recipients: recipients.length,
      title 
    });
    
    return true;
  } catch (error: any) {
    console.error('[Notification] AWS SES send failed:', error);
    return false;
  }
}

/**
 * Send email notification with retry logic
 */
async function sendEmailNotification(
  recipients: string[],
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const apiKey = import.meta.env.VITE_SENDGRID_API_KEY;
      
      if (!apiKey) {
        console.warn('[Notification] SendGrid API key not configured');
        
        // Try fallback to AWS SES
        if (import.meta.env.VITE_AWS_SES_ENABLED === 'true') {
          return await sendEmailViaSES(recipients, title, message, metadata);
        }
        
        return false;
      }
      
      sgMail.setApiKey(apiKey);
      
      // Build email template based on notification type
      const templateId = getTemplateId(metadata?.type);
      
      const fromEmail = import.meta.env.VITE_SENDGRID_FROM_EMAIL || 'alerts@maguey.com';
      const fromName = import.meta.env.VITE_SENDGRID_FROM_NAME || 'Event Scanner System';
      
      const msg: any = {
        to: recipients,
        from: {
          email: fromEmail,
          name: fromName,
        },
        subject: title,
        text: message,
        html: generateEmailHTML(title, message, metadata),
      };
      
      // Add template if configured
      if (templateId) {
        msg.templateId = templateId;
        msg.dynamicTemplateData = {
          title,
          message,
          ...metadata,
        };
      }
      
      // Handle attachments if provided
      if (metadata?.attachments && Array.isArray(metadata.attachments)) {
        msg.attachments = metadata.attachments.map((att: any) => ({
          content: att.content,
          filename: att.filename,
          type: att.type,
          disposition: att.disposition || 'attachment',
        }));
      }
      
      // Send emails
      await sgMail.sendMultiple(msg);
      
      console.log('[Notification] Email sent successfully', { 
        recipients: recipients.length,
        title,
        attempt,
      });
      
      // Log email send to database
      try {
        await (supabase.from as any)('notifications')
          .insert({
            title: `Email: ${title}`,
            message: `Sent to ${recipients.length} recipient(s)`,
            severity: metadata?.severity || 'medium',
            channels_used: ['email'],
            recipients: recipients,
            metadata: {
              email_recipients: recipients,
              email_subject: title,
              ...metadata,
            },
            status: 'sent',
            sent_at: new Date().toISOString(),
          });
      } catch (logError) {
        console.warn('[Notification] Failed to log email to database:', logError);
      }
      
      return true;
    } catch (error: any) {
      lastError = error;
      console.error(`[Notification] Email send failed (attempt ${attempt}/${maxRetries}):`, error);
      
      // If it's a rate limit error, wait before retrying
      if (error.response?.status === 429 && attempt < maxRetries) {
        const retryAfter = error.response.headers['retry-after'] || Math.pow(2, attempt);
        console.log(`[Notification] Rate limited, waiting ${retryAfter} seconds before retry`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      // If it's a permanent error (4xx except 429), don't retry
      if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
        break;
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed, try fallback provider
  if (import.meta.env.VITE_AWS_SES_ENABLED === 'true') {
    console.log('[Notification] Attempting fallback to AWS SES');
    const fallbackSuccess = await sendEmailViaSES(recipients, title, message, metadata);
    if (fallbackSuccess) {
      return true;
    }
  }
  
  // Log failure to database for admin alerts
  try {
    await (supabase.from as any)('notifications')
      .insert({
        title: `Email Failed: ${title}`,
        message: `Failed to send email to ${recipients.length} recipient(s) after ${maxRetries} attempts`,
        severity: 'high',
        channels_used: ['email'],
        recipients: recipients,
        metadata: {
          email_recipients: recipients,
          email_subject: title,
          error: lastError?.message,
          attempts: maxRetries,
          ...metadata,
        },
        status: 'failed',
        sent_at: new Date().toISOString(),
      });
  } catch (logError) {
    console.warn('[Notification] Failed to log email failure to database:', logError);
  }
  
  return false;
}

/**
 * Truncate message for SMS (160 character limit with buffer)
 */
function truncateForSMS(message: string, maxLength: number = 155): string {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength - 3) + '...';
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone: string): string | null {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Validate length (minimum 10 digits for US, max 15 for international)
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }
  
  // If already starts with country code (1 for US), add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If 10 digits, assume US number and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // For international numbers (12-15 digits), add + prefix
  if (digits.length >= 12) {
    return `+${digits}`;
  }
  
  return null;
}

/**
 * Check if phone number is opted out
 */
async function isPhoneOptedOut(phoneNumber: string): Promise<boolean> {
  try {
    const { data, error } = await (supabase.rpc as any)('is_phone_opted_out', {
      phone_number_param: phoneNumber,
    });
    
    if (error) {
      console.warn('[Notification] Error checking opt-out status:', error);
      return false; // Allow sending on error
    }
    
    return data === true;
  } catch (error) {
    console.warn('[Notification] Error checking opt-out status:', error);
    return false;
  }
}

/**
 * Track SMS cost in database
 */
async function trackSMSCost(
  messageSid: string,
  phoneNumber: string,
  messageBody: string,
  cost: number,
  status: string = 'sent',
  errorCode?: string,
  errorMessage?: string,
  ruleId?: string,
  notificationId?: string,
  userId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const { error } = await (supabase.from as any)('sms_usage_log').insert({
      message_sid: messageSid,
      phone_number: phoneNumber,
      message_body: messageBody,
      cost: cost,
      status: status,
      error_code: errorCode,
      error_message: errorMessage,
      rule_id: ruleId,
      notification_id: notificationId,
      user_id: userId,
      metadata: metadata,
      delivered_at: status === 'delivered' ? new Date().toISOString() : null,
    });
    
    if (error) {
      console.error('[Notification] Failed to track SMS cost:', error);
      return;
    }
    
    // Update monthly budget
    try {
      await (supabase.rpc as any)('update_monthly_sms_budget', {
        cost_amount: cost,
      });
    } catch (budgetError) {
      console.warn('[Notification] Failed to update monthly budget:', budgetError);
    }
    
    // Check if budget threshold exceeded
    try {
      const monthlyBudget = parseFloat(
        import.meta.env.VITE_TWILIO_MONTHLY_BUDGET || '100'
      );
      const { data: currentSpend } = await (supabase.rpc as any)('get_current_month_sms_spend');
      
      if (currentSpend && typeof currentSpend === 'number' && currentSpend >= monthlyBudget * 0.8) {
        // Alert at 80% of budget
        const { data: budgetRecord } = await (supabase.from as any)('sms_monthly_budget')
          .select('alert_sent')
          .eq('month_year', new Date().toISOString().substring(0, 7))
          .single();
        
        if (!budgetRecord?.alert_sent) {
          // Send alert notification (but don't use SMS to avoid loop)
          console.warn('[Notification] SMS budget approaching limit:', {
            currentSpend,
            budget: monthlyBudget,
            percentage: (currentSpend / monthlyBudget) * 100,
          });
          
          // Mark alert as sent
          await (supabase.from as any)('sms_monthly_budget')
            .update({ alert_sent: true })
            .eq('month_year', new Date().toISOString().substring(0, 7));
        }
      }
    } catch (budgetCheckError) {
      console.warn('[Notification] Failed to check budget:', budgetCheckError);
    }
  } catch (error) {
    console.error('[Notification] Failed to track SMS cost:', error);
  }
}

/**
 * Get user phone numbers from user IDs
 */
async function getUserPhoneNumbers(userIds: string[]): Promise<string[]> {
  const phoneNumbers: string[] = [];
  
  // Try to get phone numbers from profiles table first
  try {
    const { data: profiles, error } = await (supabase.from as any)('profiles')
      .select('id, phone')
      .in('id', userIds);
    
    if (!error && profiles && Array.isArray(profiles)) {
      const profileMap = new Map(profiles.map((p: any) => [p.id, p.phone]));
      for (const userId of userIds) {
        const phone = profileMap.get(userId);
        if (phone) {
          phoneNumbers.push(phone);
        }
      }
    }
  } catch (error) {
    console.warn('[Notification] Could not get phone numbers from profiles table:', error);
  }
  
  // Try to get phone numbers from user_notification_preferences
  if (phoneNumbers.length < userIds.length) {
    const foundPhones = new Set(phoneNumbers);
    const missingIds = userIds.filter(id => !foundPhones.has(id));
    
    try {
      const { data: preferences, error: prefError } = await (supabase.from as any)('user_notification_preferences')
        .select('user_id, preferences')
        .in('user_id', missingIds);
      
      if (!prefError && preferences && Array.isArray(preferences)) {
        preferences.forEach((pref: any) => {
          const phone = pref.preferences?.phone_number;
          if (phone && !phoneNumbers.includes(phone)) {
            phoneNumbers.push(phone);
          }
        });
      }
    } catch (error) {
      console.warn('[Notification] Could not get phone numbers from preferences:', error);
    }
  }
  
  // Final fallback: if recipientId looks like a phone number, use it directly
  for (const userId of userIds) {
    // Check if it's already a phone number (contains digits and possibly +)
    if (/^[\d\s\-\+\(\)]+$/.test(userId) && userId.replace(/\D/g, '').length >= 10) {
      if (!phoneNumbers.includes(userId)) {
        phoneNumbers.push(userId);
      }
    }
  }
  
  return phoneNumbers;
}

/**
 * Handle SMS opt-out (for webhook callback)
 */
export async function handleSMSOptOut(
  phoneNumber: string,
  keyword: string = 'STOP',
  userId?: string
): Promise<boolean> {
  try {
    const formattedNumber = formatPhoneNumber(phoneNumber);
    if (!formattedNumber) {
      console.warn('[Notification] Invalid phone number for opt-out:', phoneNumber);
      return false;
    }
    
    const { error } = await (supabase.from as any)('sms_opt_out')
      .insert({
        phone_number: formattedNumber,
        opt_out_keyword: keyword.toUpperCase(),
        user_id: userId,
      })
      .select()
      .single();
    
    if (error) {
      // If already opted out, that's fine
      if (error.code === '23505') { // Unique constraint violation
        console.log('[Notification] Phone number already opted out:', formattedNumber);
        return true;
      }
      console.error('[Notification] Failed to record opt-out:', error);
      return false;
    }
    
    console.log('[Notification] Phone number opted out:', formattedNumber, keyword);
    return true;
  } catch (error) {
    console.error('[Notification] Error handling opt-out:', error);
    return false;
  }
}

/**
 * Send SMS notification via Twilio
 */
export async function sendSMSNotification(
  recipients: string[],
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    // Dynamic import for Twilio (client-side compatible)
    const twilio = await import('twilio');
    const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
    const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
    const fromNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER;
    
    if (!accountSid || !authToken || !fromNumber) {
      console.warn('[Notification] Twilio credentials not configured');
      return false;
    }
    
    const client = twilio.default(accountSid, authToken);
    
    // Truncate message to SMS limit (160 chars with buffer)
    const smsMessage = truncateForSMS(`${title}: ${message}`);
    
    // Get phone numbers from user IDs if needed
    let phoneNumbers: string[] = [];
    
    // Check if recipients are already phone numbers or user IDs
    const recipientPhones: string[] = [];
    const recipientUserIds: string[] = [];
    
    for (const recipient of recipients) {
      // Check if it looks like a phone number
      if (/^[\d\s\-\+\(\)]+$/.test(recipient) && recipient.replace(/\D/g, '').length >= 10) {
        recipientPhones.push(recipient);
      } else {
        recipientUserIds.push(recipient);
      }
    }
    
    // Get phone numbers for user IDs
    if (recipientUserIds.length > 0) {
      const userPhones = await getUserPhoneNumbers(recipientUserIds);
      phoneNumbers.push(...userPhones);
    }
    
    // Add direct phone numbers
    phoneNumbers.push(...recipientPhones);
    
    if (phoneNumbers.length === 0) {
      console.warn('[Notification] No valid phone numbers found for SMS recipients');
      return false;
    }
    
    // Send to all recipients
    const sendPromises = phoneNumbers.map(async (phoneNumber) => {
      // Validate and format phone number
      const formattedNumber = formatPhoneNumber(phoneNumber);
      
      if (!formattedNumber) {
        console.warn('[Notification] Invalid phone number:', phoneNumber);
        return { success: false, phoneNumber, error: 'Invalid format' };
      }
      
      // Check opt-out status
      const optedOut = await isPhoneOptedOut(formattedNumber);
      if (optedOut) {
        console.log('[Notification] Phone number opted out, skipping:', formattedNumber);
        return { success: false, phoneNumber: formattedNumber, error: 'Opted out' };
      }
      
      try {
        const result = await client.messages.create({
          body: smsMessage,
          from: fromNumber,
          to: formattedNumber,
        });
        
        console.log('[Notification] SMS sent:', {
          to: formattedNumber,
          sid: result.sid,
          status: result.status,
        });
        
        // Track cost (average cost: $0.0075 per SMS in US)
        const estimatedCost = 0.0075;
        await trackSMSCost(
          result.sid,
          formattedNumber,
          smsMessage,
          estimatedCost,
          result.status as string,
          undefined,
          undefined,
          metadata?.rule_id,
          metadata?.notification_id,
          metadata?.user_id,
          metadata
        );
        
        return { success: true, phoneNumber: formattedNumber, sid: result.sid };
      } catch (error: any) {
        console.error('[Notification] SMS send failed:', error);
        
        // Track failed attempt
        await trackSMSCost(
          `failed_${Date.now()}`,
          formattedNumber,
          smsMessage,
          0,
          'failed',
          error.code,
          error.message,
          metadata?.rule_id,
          metadata?.notification_id,
          metadata?.user_id,
          metadata
        );
        
        return { success: false, phoneNumber: formattedNumber, error: error.message };
      }
    });
    
    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    
    // Log SMS send to database
    try {
      await (supabase.from as any)('notifications')
        .insert({
          title: `SMS: ${title}`,
          message: `Sent to ${successCount}/${phoneNumbers.length} recipient(s)`,
          severity: metadata?.severity || 'medium',
          channels_used: ['sms'],
          recipients: recipients,
          metadata: {
            sms_recipients: phoneNumbers,
            sms_message: smsMessage,
            sms_results: results,
            ...metadata,
          },
          status: successCount > 0 ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
        });
    } catch (logError) {
      console.warn('[Notification] Failed to log SMS to database:', logError);
    }
    
    return successCount > 0;
  } catch (error: any) {
    console.error('[Notification] SMS service error:', error);
    return false;
  }
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(
  webhookUrl: string,
  title: string,
  message: string,
  severity: NotificationSeverity,
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        message,
        severity,
        timestamp: new Date().toISOString(),
        ...metadata,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Webhook notification failed:', error);
    return false;
  }
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(
  webhookUrl: string,
  title: string,
  message: string,
  severity: NotificationSeverity,
  metadata?: Record<string, any>
): Promise<boolean> {
  const colorMap: Record<NotificationSeverity, string> = {
    low: '#36a64f',
    medium: '#ffaa00',
    high: '#ff8800',
    critical: '#ff0000',
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: title,
        attachments: [
          {
            color: colorMap[severity],
            text: message,
            fields: metadata ? Object.entries(metadata).map(([key, value]) => ({
              title: key,
              value: String(value),
              short: true,
            })) : [],
            footer: 'Maguey Gate Scanner',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Slack notification failed:', error);
    return false;
  }
}

/**
 * Send Discord notification
 */
async function sendDiscordNotification(
  webhookUrl: string,
  title: string,
  message: string,
  severity: NotificationSeverity,
  metadata?: Record<string, any>
): Promise<boolean> {
  const colorMap: Record<NotificationSeverity, number> = {
    low: 0x36a64f,
    medium: 0xffaa00,
    high: 0xff8800,
    critical: 0xff0000,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [
          {
            title,
            description: message,
            color: colorMap[severity],
            fields: metadata ? Object.entries(metadata).map(([key, value]) => ({
              name: key,
              value: String(value),
              inline: true,
            })) : [],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Maguey Gate Scanner',
            },
          },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Discord notification failed:', error);
    return false;
  }
}

/**
 * Initialize Firebase Admin SDK (call once at app startup)
 * Note: This requires server-side environment (Node.js)
 */
export async function initializeFirebaseAdmin(): Promise<boolean> {
  try {
    const admin = await getFirebaseAdmin();
    if (!admin) {
      console.warn('[Notification] Firebase Admin SDK not available (browser environment)');
      return false;
    }

    // Check if already initialized
    if (admin.apps.length > 0) {
      return true;
    }

    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    const privateKey = import.meta.env.VITE_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = import.meta.env.VITE_FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      console.warn('[Notification] Firebase credentials not configured');
      return false;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey,
        clientEmail,
      }),
    });

    console.log('[Notification] Firebase Admin SDK initialized');
    return true;
  } catch (error: any) {
    console.error('[Notification] Firebase Admin initialization failed:', error);
    return false;
  }
}

/**
 * Send push notification to multiple users via Firebase Cloud Messaging
 */
export async function sendPushNotification(
  userIds: string[],
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    // Initialize Firebase Admin if not already done
    await initializeFirebaseAdmin();
    
    const admin = await getFirebaseAdmin();
    if (!admin) {
      console.warn('[Notification] Firebase Admin SDK not available, skipping push notification');
      return false;
    }

    // Get device tokens for users
    const { data: deviceTokens, error } = await (supabase.from as any)('user_device_tokens')
      .select('token, platform')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (error || !deviceTokens || deviceTokens.length === 0) {
      console.warn('[Notification] No device tokens found for users:', userIds);
      return false;
    }

    // Build notification payload
    const notification = {
      title,
      body: message,
      imageUrl: metadata?.imageUrl,
    };

    // Build data payload
    const data: Record<string, string> = {
      notificationId: metadata?.notificationId || '',
      type: metadata?.type || 'general',
      timestamp: new Date().toISOString(),
      ...Object.fromEntries(
        Object.entries(metadata?.data || {}).map(([k, v]) => [k, String(v)])
      ),
    };

    // Prepare messages for each device
    const messages = deviceTokens.map((device: { token: string; platform: string }) => ({
      notification,
      data,
      token: device.token,
      android: {
        priority: metadata?.priority === 'high' ? 'high' : 'normal',
        notification: {
          sound: 'default',
          priority: metadata?.priority === 'high' ? 'high' : 'default',
          channelId: metadata?.type || 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body: message,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
      webpush: {
        notification: {
          title,
          body: message,
          icon: '/logo.png',
          badge: '/badge.png',
          vibrate: [200, 100, 200],
          requireInteraction: metadata?.priority === 'high',
          actions: [
            { action: 'view', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        },
      },
    }));

    // Send notifications in batches (FCM limit: 500 per request)
    const batchSize = 500;
    let successCount = 0;
    const invalidTokens: string[] = [];

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      try {
        const messaging = admin.messaging();
        const response = await messaging.sendEach(batch);

        successCount += response.successCount;

        // Handle failures
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;

            // Remove invalid tokens
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(deviceTokens[i + idx].token);
            }

            console.error('[Notification] Push send failed:', {
              token: deviceTokens[i + idx].token,
              error: resp.error?.message,
            });
          }
        });
      } catch (error: any) {
        console.error('[Notification] Batch send failed:', error);
      }
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      await (supabase.from as any)('user_device_tokens')
        .update({ is_active: false })
        .in('token', invalidTokens);

      console.log('[Notification] Removed invalid tokens:', invalidTokens.length);
    }

    console.log('[Notification] Push notifications sent:', {
      total: messages.length,
      success: successCount,
      failed: messages.length - successCount,
    });

    return successCount > 0;
  } catch (error: any) {
    console.error('[Notification] Push notification error:', error);
    return false;
  }
}

/**
 * Register device token for push notifications
 */
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'web' | 'ios' | 'android'
): Promise<boolean> {
  try {
    const { error } = await (supabase.from as any)('user_device_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'token',
        }
      );

    if (error) throw error;

    console.log('[Notification] Device token registered:', { userId, platform });
    return true;
  } catch (error: any) {
    console.error('[Notification] Token registration failed:', error);
    return false;
  }
}

/**
 * Send notification through specified channels
 */
async function sendNotificationChannels(
  channels: NotificationChannel[],
  recipients: string[],
  title: string,
  message: string,
  severity: NotificationSeverity,
  metadata?: Record<string, any>
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  for (const channel of channels) {
    let channelSuccess = true;

    switch (channel) {
      case 'browser':
        // Browser notifications are sent to all recipients who have the app open
        channelSuccess = await sendBrowserNotification(title, message, severity);
        break;

      case 'email':
        // Convert user IDs to email addresses and send
        const emailAddresses = await getUserEmails(recipients);
        if (emailAddresses.length > 0) {
          channelSuccess = await sendEmailNotification(emailAddresses, title, message, {
            ...metadata,
            severity,
            type: metadata?.type,
          });
        } else {
          console.warn('[Notification] No email addresses found for recipients:', recipients);
          channelSuccess = false;
        }
        break;

      case 'sms':
        // Send SMS to all recipients at once
        channelSuccess = await sendSMSNotification(recipients, title, message, {
          ...metadata,
          severity,
          type: metadata?.type,
        });
        break;

      case 'push':
        // Send push notifications to all recipients at once
        channelSuccess = await sendPushNotification(recipients, title, message, {
          ...metadata,
          severity,
          type: metadata?.type,
        });
        break;

      case 'webhook':
        // Get webhook URL from first recipient's preferences
        if (recipients.length > 0) {
          const prefs = await getUserPreferences(recipients[0]);
          const webhookUrl = prefs?.preferences && (prefs.preferences as any).webhook_url;
          if (webhookUrl) {
            channelSuccess = await sendWebhookNotification(webhookUrl, title, message, severity, metadata);
          }
        }
        break;

      case 'slack':
        // Get Slack webhook from first recipient's preferences
        if (recipients.length > 0) {
          const prefs = await getUserPreferences(recipients[0]);
          const webhookUrl = prefs?.preferences && (prefs.preferences as any).slack_webhook;
          if (webhookUrl) {
            channelSuccess = await sendSlackNotification(webhookUrl, title, message, severity, metadata);
          }
        }
        break;

      case 'discord':
        // Get Discord webhook from first recipient's preferences
        if (recipients.length > 0) {
          const prefs = await getUserPreferences(recipients[0]);
          const webhookUrl = prefs?.preferences && (prefs.preferences as any).discord_webhook;
          if (webhookUrl) {
            channelSuccess = await sendDiscordNotification(webhookUrl, title, message, severity, metadata);
          }
        }
        break;
    }

    results[channel] = channelSuccess;
  }

  return results;
}

/**
 * Create and send a notification
 */
export async function sendNotification(
  trigger: NotificationTrigger,
  context: NotificationContext
): Promise<string | null> {
  try {
    // Get active rules for this trigger type
    const { data: rules, error: rulesError } = await (supabase.rpc as any)(
      'get_active_notification_rules',
      { trigger_type_param: trigger.type }
    );

    if (rulesError) {
      console.error('Error fetching notification rules:', rulesError);
      return null;
    }

    if (!rules || rules.length === 0) {
      return null; // No rules configured for this trigger
    }

    // Process each matching rule
    const notificationIds: string[] = [];

    for (const rule of (rules as NotificationRule[])) {
      // Check throttling
      const throttled = await shouldThrottle(rule.id);
      if (throttled) {
        console.log(`Notification throttled for rule ${rule.id}`);
        continue;
      }

      // Check if rule conditions match
      // TODO: Implement condition matching logic based on rule.conditions
      // For now, we'll send if the rule exists

      // Get recipients and filter channels based on their preferences
      const recipients: string[] = rule.recipients || [];
      const allChannels: NotificationChannel[] = (rule.channels || []) as NotificationChannel[];

      // Process each recipient
      const finalRecipients: string[] = [];
      const finalChannels: NotificationChannel[] = [];

      for (const recipientId of recipients) {
        const preferences = await getUserPreferences(recipientId);
        const allowedChannels = filterChannelsByPreferences(
          allChannels,
          preferences,
          context.severity
        );

        if (allowedChannels.length > 0) {
          finalRecipients.push(recipientId);
          // Collect unique channels
          allowedChannels.forEach(ch => {
            if (!finalChannels.includes(ch)) {
              finalChannels.push(ch);
            }
          });
        }
      }

      if (finalRecipients.length === 0 || finalChannels.length === 0) {
        continue; // No recipients or channels after filtering
      }

      // Use template if available, otherwise use context
      const title = rule.template_title 
        ? replaceTemplateVariables(rule.template_title, context, trigger)
        : context.title;
      
      const message = rule.template_message
        ? replaceTemplateVariables(rule.template_message, context, trigger)
        : context.message;

      // Send notifications
      const deliveryStatus = await sendNotificationChannels(
        finalChannels,
        finalRecipients,
        title,
        message,
        context.severity,
        { ...context.metadata, ...trigger.metadata }
      );

      // Record throttle
      await recordThrottle(rule.id);

      // Create notification record
      const { data: notification, error: notifError } = await (supabase.from as any)('notifications')
        .insert({
          rule_id: rule.id,
          trigger_event_id: trigger.eventId,
          severity: context.severity,
          title,
          message,
          channels_used: finalChannels,
          recipients: finalRecipients,
          metadata: { ...context.metadata, ...trigger.metadata },
          status: 'sent',
          sent_at: new Date().toISOString(),
          delivery_status: deliveryStatus,
        })
        .select()
        .single();

      if (notifError) {
        console.error('Error creating notification record:', notifError);
      } else if (notification) {
        notificationIds.push(notification.id);
      }
    }

    return notificationIds.length > 0 ? notificationIds[0] : null;
  } catch (error) {
    console.error('Error sending notification:', error);
    return null;
  }
}

/**
 * Replace template variables in notification templates
 */
function replaceTemplateVariables(
  template: string,
  context: NotificationContext,
  trigger: NotificationTrigger
): string {
  let result = template;

  // Replace context variables
  result = result.replace(/\{\{title\}\}/g, context.title);
  result = result.replace(/\{\{message\}\}/g, context.message);
  result = result.replace(/\{\{severity\}\}/g, context.severity);

  // Replace metadata variables
  if (context.metadata) {
    Object.entries(context.metadata).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    });
  }

  // Replace trigger metadata variables
  if (trigger.metadata) {
    Object.entries(trigger.metadata).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    });
  }

  return result;
}

/**
 * Acknowledge a notification
 */
export async function acknowledgeNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await (supabase.from as any)('notifications')
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
        status: 'acknowledged',
      })
      .eq('id', notificationId);

    return !error;
  } catch (error) {
    console.warn('Notifications table not available:', error);
    return false;
  }
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Notification[]> {
  try {
    const { data, error } = await (supabase.from as any)('notifications')
      .select('*')
      .contains('recipients', [userId])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return (data || []) as Notification[];
  } catch (error) {
    console.warn('Notifications table not available:', error);
    return [];
  }
}

/**
 * Get unacknowledged notifications count for a user
 */
export async function getUnacknowledgedCount(userId: string): Promise<number> {
  try {
    const { count, error } = await (supabase.from as any)('notifications')
      .select('*', { count: 'exact', head: true })
      .contains('recipients', [userId])
      .neq('status', 'acknowledged');

    if (error) {
      console.error('Error fetching unacknowledged count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.warn('Notifications table not available:', error);
    return 0;
  }
}

