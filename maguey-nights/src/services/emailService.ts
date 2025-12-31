// Email service for sending confirmations and tickets
// This would typically connect to a service like SendGrid, Mailgun, or AWS SES

interface EmailData {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
    type: string;
  }>;
}

interface OrderConfirmationData {
  orderId: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
  };
  event: {
    artist: string;
    date: string;
    time: string;
    venue: string;
    address: string;
  };
  tickets: {[key: string]: number};
  tables: {[key: string]: number};
  subtotal: number;
  tax: number;
  total: number;
  ticketPdfUrl?: string;
}

export class EmailService {
  private apiKey: string;
  private fromEmail: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_EMAIL_API_KEY || '';
    this.fromEmail = import.meta.env.VITE_FROM_EMAIL || 'noreply@magueynightclub.com';
  }

  async sendOrderConfirmation(data: OrderConfirmationData): Promise<boolean> {
    try {
      const emailData: EmailData = {
        to: data.customer.email,
        subject: `Your Maguey Nightclub Tickets - Order ${data.orderId}`,
        html: this.generateConfirmationEmail(data),
        attachments: data.ticketPdfUrl ? [{
          filename: `tickets-${data.orderId}.pdf`,
          content: await this.convertUrlToBase64(data.ticketPdfUrl),
          type: 'application/pdf'
        }] : undefined
      };

      return await this.sendEmail(emailData);
    } catch (error) {
      console.error('Error sending confirmation email:', error);
      return false;
    }
  }

  async sendTicketReminder(data: OrderConfirmationData): Promise<boolean> {
    try {
      const emailData: EmailData = {
        to: data.customer.email,
        subject: `Reminder: Your Maguey Nightclub Event Tomorrow - ${data.event.artist}`,
        html: this.generateReminderEmail(data)
      };

      return await this.sendEmail(emailData);
    } catch (error) {
      console.error('Error sending reminder email:', error);
      return false;
    }
  }

  async sendTicketUpdate(data: OrderConfirmationData, updateType: 'cancelled' | 'rescheduled'): Promise<boolean> {
    try {
      const emailData: EmailData = {
        to: data.customer.email,
        subject: `Update: Your Maguey Nightclub Event - ${data.event.artist}`,
        html: this.generateUpdateEmail(data, updateType)
      };

      return await this.sendEmail(emailData);
    } catch (error) {
      console.error('Error sending update email:', error);
      return false;
    }
  }

  private generateConfirmationEmail(data: OrderConfirmationData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Maguey Nightclub Tickets</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: #000; color: #fff; }
          .header { background: #39B54A; padding: 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 30px; }
          .event-details { background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .order-summary { background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .ticket-info { background: #39B54A; color: #000; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .footer { background: #1a1a1a; padding: 20px; text-align: center; font-size: 12px; color: #999; }
          .btn { display: inline-block; background: #39B54A; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
          .qr-code { text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MAGUEY NIGHTCLUB</h1>
            <p>Delaware's Premier Latin Nightlife</p>
          </div>
          
          <div class="content">
            <h2>Thank you for your purchase!</h2>
            <p>Hi ${data.customer.firstName},</p>
            <p>Your tickets for <strong>${data.event.artist}</strong> have been confirmed. We can't wait to see you at Maguey!</p>
            
            <div class="event-details">
              <h3>Event Details</h3>
              <p><strong>Event:</strong> ${data.event.artist}</p>
              <p><strong>Date:</strong> ${data.event.date}</p>
              <p><strong>Time:</strong> ${data.event.time}</p>
              <p><strong>Venue:</strong> ${data.event.venue}</p>
              <p><strong>Address:</strong> ${data.event.address}</p>
            </div>
            
            <div class="order-summary">
              <h3>Order Summary</h3>
              <p><strong>Order ID:</strong> ${data.orderId}</p>
              <p><strong>Customer:</strong> ${data.customer.firstName} ${data.customer.lastName}</p>
              <p><strong>Email:</strong> ${data.customer.email}</p>
              <p><strong>Subtotal:</strong> $${data.subtotal.toFixed(2)}</p>
              <p><strong>Tax:</strong> $${data.tax.toFixed(2)}</p>
              <p><strong>Total:</strong> $${data.total.toFixed(2)}</p>
            </div>
            
            <div class="ticket-info">
              <h3>🎫 Your Tickets</h3>
              <p>Your tickets are attached to this email as a PDF. Please print them or have them ready on your phone for entry.</p>
              <p><strong>Important:</strong> Bring a valid government-issued ID (21+ only)</p>
            </div>
            
            <div class="qr-code">
              <p>Your tickets contain a QR code for easy entry</p>
            </div>
            
            <h3>What to Expect</h3>
            <ul>
              <li>Doors open at 9:00 PM</li>
              <li>Valid ID required for entry (21+)</li>
              <li>Dress code: Upscale casual to formal</li>
              <li>Parking available on-site</li>
              <li>Bottle service and VIP tables available</li>
            </ul>
            
            <h3>Questions?</h3>
            <p>If you have any questions about your order, please contact us:</p>
            <p>📧 info@magueynightclub.com</p>
            <p>📞 (302) 555-0123</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://magueynightclub.com/events" class="btn">View More Events</a>
            </div>
          </div>
          
          <div class="footer">
            <p>Maguey Nightclub • 123 Main Street, Wilmington, DE 19801</p>
            <p>© 2024 Maguey Nightclub. All rights reserved.</p>
            <p>This email was sent to ${data.customer.email}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateReminderEmail(data: OrderConfirmationData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Reminder - Maguey Nightclub</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: #000; color: #fff; }
          .header { background: #39B54A; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .event-details { background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .reminder-box { background: #ff6b35; color: #000; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MAGUEY NIGHTCLUB</h1>
            <p>Event Reminder</p>
          </div>
          
          <div class="content">
            <div class="reminder-box">
              <h2>🎉 Tomorrow's the Big Night!</h2>
              <p>Don't forget about your event at Maguey Nightclub!</p>
            </div>
            
            <div class="event-details">
              <h3>${data.event.artist}</h3>
              <p><strong>Date:</strong> ${data.event.date}</p>
              <p><strong>Time:</strong> ${data.event.time}</p>
              <p><strong>Venue:</strong> ${data.event.venue}</p>
            </div>
            
            <h3>Last-Minute Reminders:</h3>
            <ul>
              <li>Bring your printed tickets or have them ready on your phone</li>
              <li>Valid government-issued ID required (21+)</li>
              <li>Dress to impress - upscale casual to formal</li>
              <li>Arrive early for the best experience</li>
            </ul>
            
            <p>We can't wait to see you tomorrow night!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateUpdateEmail(data: OrderConfirmationData, updateType: 'cancelled' | 'rescheduled'): string {
    const isCancelled = updateType === 'cancelled';
    const subject = isCancelled ? 'Event Cancelled' : 'Event Rescheduled';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject} - Maguey Nightclub</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: #000; color: #fff; }
          .header { background: ${isCancelled ? '#ef4444' : '#ff6b35'}; padding: 20px; text-align: center; }
          .content { padding: 30px; }
          .update-box { background: ${isCancelled ? '#ef4444' : '#ff6b35'}; color: #000; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MAGUEY NIGHTCLUB</h1>
            <p>${subject}</p>
          </div>
          
          <div class="content">
            <div class="update-box">
              <h2>${isCancelled ? '❌ Event Cancelled' : '📅 Event Rescheduled'}</h2>
              <p>We have an important update about your event.</p>
            </div>
            
            <div class="event-details">
              <h3>${data.event.artist}</h3>
              <p><strong>Original Date:</strong> ${data.event.date}</p>
              <p><strong>Time:</strong> ${data.event.time}</p>
            </div>
            
            ${isCancelled ? `
              <h3>Refund Information</h3>
              <p>Your order has been automatically refunded. The refund will appear on your original payment method within 5-7 business days.</p>
              <p>Order ID: ${data.orderId}</p>
              <p>Refund Amount: $${data.total.toFixed(2)}</p>
            ` : `
              <h3>New Event Details</h3>
              <p>Your event has been rescheduled. Please check our website for the new date and time.</p>
              <p>Your existing tickets will be valid for the new date.</p>
            `}
            
            <h3>Questions?</h3>
            <p>If you have any questions, please contact us:</p>
            <p>📧 info@magueynightclub.com</p>
            <p>📞 (302) 555-0123</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private async convertUrlToBase64(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting URL to base64:', error);
      return '';
    }
  }

  private async sendEmail(_emailData: EmailData): Promise<boolean> {
    try {
      // This would typically make an API call to your email service
      // For now, we'll simulate a successful send
      // In a real implementation, you would:
      // 1. Make an API call to SendGrid, Mailgun, or AWS SES
      // 2. Handle authentication with your API key
      // 3. Process the response and handle errors
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
