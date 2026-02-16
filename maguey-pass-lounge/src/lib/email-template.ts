/**
 * Email Template for Digital Tickets
 * Creates HTML email with ticket information and QR codes
 */

import type { TicketData } from './ticket-generator';

/**
 * Generate HTML email template for tickets
 */
export function generateTicketEmailHTML(
  tickets: TicketData[],
  customerName: string,
  orderId: string,
  frontendUrl?: string
): string {
  const FRONTEND_URL = frontendUrl || 'https://your-site.com';
  const eventName = tickets[0]?.eventName || 'Event';
  const eventDate = tickets[0]?.eventDate || '';
  const eventTime = tickets[0]?.eventTime || '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Tickets - ${eventName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    }
    .header h1 {
      color: #6366f1;
      margin: 0;
      font-size: 24px;
    }
    .success-message {
      background-color: #10b981;
      color: white;
      padding: 15px;
      border-radius: 6px;
      text-align: center;
      margin-bottom: 30px;
    }
    .ticket {
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 0;
      margin-bottom: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      overflow: hidden;
    }
    .ticket-image {
      width: 100%;
      max-width: 100%;
      height: 200px;
      object-fit: cover;
      display: block;
    }
    .ticket-header {
      text-align: center;
      margin-bottom: 20px;
      padding: 20px 20px 0 20px;
    }
    .ticket-header h2 {
      margin: 0;
      font-size: 22px;
      color: white;
    }
    .ticket-info {
      background-color: rgba(255, 255, 255, 0.95);
      color: #333;
      padding: 20px;
      border-radius: 6px;
      margin: 0 20px 20px 20px;
    }
    .ticket-info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .ticket-info-row:last-child {
      border-bottom: none;
    }
    .ticket-info-label {
      font-weight: 600;
      color: #666;
    }
    .ticket-info-value {
      color: #333;
    }
    .qr-code {
      text-align: center;
      background-color: white;
      padding: 20px;
      border-radius: 6px;
      margin: 0 20px 20px 20px;
    }
    .qr-code img {
      max-width: 250px;
      height: auto;
      border: 4px solid #333;
      border-radius: 4px;
    }
    .qr-code-label {
      margin-top: 10px;
      font-size: 12px;
      color: #666;
      font-weight: 600;
    }
    .ticket-id {
      text-align: center;
      margin: 0 20px 20px 20px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #6366f1;
      font-weight: 600;
      background-color: #f0f0f0;
      padding: 8px;
      border-radius: 4px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .important-info {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .important-info h3 {
      margin-top: 0;
      color: #856404;
    }
    .important-info ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .important-info li {
      margin: 5px 0;
      color: #856404;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #6366f1;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 10px 5px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎫 MAGUEY</h1>
    </div>

    <div class="success-message">
      ✅ Payment Successful! Your tickets are confirmed.
    </div>

    <p>Hi ${customerName},</p>
    <p>Thank you for your purchase! Your digital tickets for <strong>${eventName}</strong> are ready.</p>

    ${tickets.map((ticket, index) => `
      <div class="ticket">
        ${ticket.eventImage ? `
          <img src="${ticket.eventImage}" alt="${ticket.eventName}" class="ticket-image" />
        ` : ''}
        <div class="ticket-header">
          <h2>${ticket.eventName}</h2>
          <p style="margin: 5px 0; opacity: 0.9;">${new Date(ticket.eventDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })} • ${ticket.eventTime}</p>
        </div>

        <div class="ticket-info">
          <div class="ticket-info-row">
            <span class="ticket-info-label">Ticket Type:</span>
            <span class="ticket-info-value">${ticket.ticketType}</span>
          </div>
          <div class="ticket-info-row">
            <span class="ticket-info-label">Ticket Holder:</span>
            <span class="ticket-info-value">${ticket.ticketHolderName}</span>
          </div>
          <div class="ticket-info-row">
            <span class="ticket-info-label">Venue:</span>
            <span class="ticket-info-value">${ticket.venue}</span>
          </div>
          <div class="ticket-info-row">
            <span class="ticket-info-label">Address:</span>
            <span class="ticket-info-value">${ticket.venueAddress}</span>
          </div>
          <div class="ticket-info-row">
            <span class="ticket-info-label">Price:</span>
            <span class="ticket-info-value">$${ticket.price.toFixed(2)}</span>
          </div>
        </div>

        <div class="qr-code">
          <img src="${ticket.qrCodeUrl}" alt="QR Code for ${ticket.ticketId}" />
          <div class="qr-code-label">Present this QR code at the entrance</div>
        </div>

        <div class="ticket-id">
          Ticket ID: ${ticket.ticketId}
        </div>
      </div>
    `).join('')}

    <div class="important-info">
      <h3>⚠️ Important Information</h3>
      <ul>
        <li>Valid government-issued ID required at entrance</li>
        <li>Arrive 30 minutes before event time</li>
        <li>Screenshot or download this email for offline access</li>
        <li>Do not share your QR code with anyone</li>
        <li>Tickets are non-transferable and non-refundable</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${FRONTEND_URL || 'https://your-site.com'}/account" class="button">
        View My Tickets
      </a>
    </div>

    <div class="footer">
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p>If you have any questions, please contact us at support@maguey.com</p>
      <p style="margin-top: 20px; font-size: 12px; color: #999;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email for tickets (fallback)
 */
export function generateTicketEmailText(
  tickets: TicketData[],
  customerName: string,
  orderId: string,
  frontendUrl?: string
): string {
  const eventName = tickets[0]?.eventName || 'Event';
  
  let text = `Thank you for your purchase, ${customerName}!\n\n`;
  text += `Your tickets for ${eventName} are confirmed.\n\n`;
  text += `Order ID: ${orderId}\n\n`;
  text += `TICKETS:\n`;
  text += `${'='.repeat(50)}\n\n`;
  
  tickets.forEach((ticket, index) => {
    text += `Ticket ${index + 1}:\n`;
    text += `  Event: ${ticket.eventName}\n`;
    text += `  Event ID: ${ticket.eventId}\n`;
    text += `  Date: ${ticket.eventDate} at ${ticket.eventTime}\n`;
    text += `  Venue: ${ticket.venue}\n`;
    text += `  Address: ${ticket.venueAddress}\n`;
    text += `  Ticket Type: ${ticket.ticketType}\n`;
    text += `  Ticket Holder: ${ticket.ticketHolderName}\n`;
    text += `  Ticket ID: ${ticket.ticketId}\n`;
    text += `  QR Code: ${ticket.qrCodeUrl}\n`;
    text += `  Price: $${ticket.price.toFixed(2)}\n\n`;
  });
  
  text += `\nIMPORTANT INFORMATION:\n`;
  text += `- Valid government-issued ID required at entrance\n`;
  text += `- Arrive 30 minutes before event time\n`;
  text += `- Screenshot this email for offline access\n`;
  text += `- Do not share your QR code with anyone\n`;
  text += `- Tickets are non-transferable and non-refundable\n\n`;
  
  const FRONTEND_URL = frontendUrl || 'https://your-site.com';
  text += `View your tickets online: ${FRONTEND_URL}/account\n`;
  text += `\nIf you have any questions, please contact us at support@maguey.com\n`;
  
  return text;
}

