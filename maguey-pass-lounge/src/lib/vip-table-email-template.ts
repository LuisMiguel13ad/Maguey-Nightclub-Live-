/**
 * VIP Table Email Template
 * Creates HTML email with table reservation confirmation and QR codes for all guests
 */

import type { TableReservation, TableGuestPass } from './vip-tables-service';

interface VipTableEmailData {
  reservation: TableReservation;
  guestPasses: Array<TableGuestPass & { qr_code_url: string }>;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress?: string;
  eventImageUrl?: string;
}

/**
 * Generate HTML email template for VIP table reservation
 */
export function generateVipTableEmailHTML(data: VipTableEmailData, frontendUrl?: string): string {
  const FRONTEND_URL = frontendUrl || 'https://your-site.com';
  const {
    reservation,
    guestPasses,
    eventName,
    eventDate,
    eventTime,
    venueName,
    venueAddress,
    eventImageUrl,
  } = data;

  const formattedDate = new Date(eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const tierLabel = {
    premium: 'Premium',
    standard: 'Standard',
    regular: 'Regular',
  }[reservation.vip_table?.tier || 'regular'];

  const tierColor = {
    premium: '#EAB308',
    standard: '#3B82F6',
    regular: '#A855F7',
  }[reservation.vip_table?.tier || 'regular'];

  // Generate QR code sections for all guests
  const qrCodeSections = guestPasses.map((pass, index) => `
    <div style="display: inline-block; width: 200px; margin: 10px; text-align: center; vertical-align: top;">
      <div style="background-color: white; border-radius: 8px; padding: 15px; border: 2px solid #e0e0e0;">
        <img src="${pass.qr_code_url}" alt="Guest ${pass.guest_number} QR Code" style="width: 150px; height: 150px; margin-bottom: 10px;" />
        <div style="font-weight: bold; color: #333; font-size: 14px;">Guest ${pass.guest_number}</div>
        <div style="color: #666; font-size: 11px; font-family: monospace;">${pass.pass_id}</div>
      </div>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VIP Table Reservation - ${eventName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 700px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 0;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%);
      color: white;
      text-align: center;
      padding: 30px;
    }
    .header h1 {
      color: ${tierColor};
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .header .crown {
      font-size: 40px;
      margin-bottom: 10px;
    }
    .success-banner {
      background-color: #10b981;
      color: white;
      padding: 20px;
      text-align: center;
      font-size: 18px;
      font-weight: bold;
    }
    .event-image {
      width: 100%;
      max-height: 250px;
      object-fit: cover;
    }
    .content {
      padding: 30px;
    }
    .reservation-details {
      background: linear-gradient(135deg, ${tierColor}15 0%, ${tierColor}05 100%);
      border-left: 4px solid ${tierColor};
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .reservation-number {
      font-size: 24px;
      font-weight: bold;
      color: ${tierColor};
      font-family: monospace;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    .detail-item {
      padding: 10px;
      background-color: #f8f9fa;
      border-radius: 6px;
    }
    .detail-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .detail-value {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-top: 4px;
    }
    .qr-section {
      text-align: center;
      padding: 30px;
      background-color: #fafafa;
      border-top: 1px solid #e0e0e0;
      border-bottom: 1px solid #e0e0e0;
    }
    .qr-section h2 {
      color: #333;
      margin-bottom: 10px;
    }
    .qr-instruction {
      color: #666;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .qr-codes {
      text-align: center;
    }
    .important-info {
      background-color: #fef3cd;
      border-left: 4px solid #ffc107;
      padding: 20px;
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
      margin: 8px 0;
      color: #856404;
    }
    .no-refund-warning {
      background-color: #fee2e2;
      border-left: 4px solid #ef4444;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 4px;
      color: #991b1b;
      font-weight: 500;
    }
    .footer {
      padding: 30px;
      text-align: center;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #e0e0e0;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: ${tierColor};
      color: white;
      text-decoration: none;
      border-radius: 8px;
      margin: 10px 5px;
      font-weight: 600;
    }
    .tier-badge {
      display: inline-block;
      padding: 6px 16px;
      background-color: ${tierColor}20;
      color: ${tierColor};
      border-radius: 20px;
      font-weight: bold;
      font-size: 14px;
      border: 2px solid ${tierColor};
    }
    .total-amount {
      font-size: 28px;
      font-weight: bold;
      color: #10b981;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="crown">👑</div>
      <h1>VIP TABLE RESERVATION</h1>
      <p style="margin: 0; opacity: 0.9;">Your exclusive table is confirmed</p>
    </div>

    <div class="success-banner">
      ✅ Payment Successful - Your VIP Table is Reserved!
    </div>

    ${eventImageUrl ? `<img src="${eventImageUrl}" alt="${eventName}" class="event-image" />` : ''}

    <div class="content">
      <p>Dear ${reservation.customer_first_name},</p>
      <p>Thank you for your VIP table reservation! Your exclusive table for <strong>${eventName}</strong> is confirmed.</p>

      <div class="reservation-details">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div>
            <div style="font-size: 12px; color: #666;">RESERVATION NUMBER</div>
            <div class="reservation-number">${reservation.reservation_number}</div>
          </div>
          <span class="tier-badge">${tierLabel} Table</span>
        </div>
        
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">Event</div>
            <div class="detail-value">${eventName}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Date</div>
            <div class="detail-value">${formattedDate}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Time</div>
            <div class="detail-value">${eventTime}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Table</div>
            <div class="detail-value">${reservation.vip_table?.table_name || 'VIP Table'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Location</div>
            <div class="detail-value">${reservation.vip_table?.floor_section || 'VIP Section'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Guests</div>
            <div class="detail-value">${reservation.guest_count} people</div>
          </div>
          <div class="detail-item" style="grid-column: span 2;">
            <div class="detail-label">Bottle Service</div>
            <div class="detail-value">${reservation.vip_table?.bottle_service_description || 'Included'}</div>
          </div>
          ${reservation.bottle_choice ? `
          <div class="detail-item" style="grid-column: span 2;">
            <div class="detail-label">Your Bottle Choice</div>
            <div class="detail-value">${reservation.bottle_choice}</div>
          </div>
          ` : ''}
        </div>

        <div style="text-align: right; padding-top: 15px; border-top: 1px solid ${tierColor}30;">
          <div style="font-size: 14px; color: #666;">Total Paid</div>
          <div class="total-amount">$${Number(reservation.total_amount).toFixed(2)}</div>
        </div>
      </div>
    </div>

    <div class="qr-section">
      <h2>🎫 Guest Entry Passes</h2>
      <p class="qr-instruction">
        Each guest needs their own QR code to enter. 
        Share these with your guests or show them from your phone at the door.
      </p>
      <div class="qr-codes">
        ${qrCodeSections}
      </div>
    </div>

    <div class="content">
      <div class="important-info">
        <h3>⚠️ Important Information</h3>
        <ul>
          <li><strong>Arrive 30 minutes early</strong> for table setup and VIP check-in</li>
          <li>Valid <strong>government-issued ID required</strong> for all guests</li>
          <li>Each guest <strong>scans their own QR code</strong> at entry</li>
          <li><strong>Screenshot the QR codes</strong> for offline access</li>
          <li>Your table will be held for 1 hour after doors open</li>
        </ul>
      </div>

      <div class="no-refund-warning">
        ⛔ <strong>No Refunds:</strong> All VIP table reservations are final and non-refundable.
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/vip-confirmation?reservationId=${reservation.id}" class="button">
          View Reservation Online
        </a>
      </div>
    </div>

    <div class="footer">
      <p><strong>Venue:</strong> ${venueName}${venueAddress ? ` • ${venueAddress}` : ''}</p>
      <p><strong>Contact Phone:</strong> ${reservation.customer_phone}</p>
      <p style="margin-top: 20px; font-size: 12px; color: #999;">
        If you have any questions, please contact us at support@maguey.com<br>
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email for VIP table reservation (fallback)
 */
export function generateVipTableEmailText(data: VipTableEmailData, frontendUrl?: string): string {
  const {
    reservation,
    guestPasses,
    eventName,
    eventDate,
    eventTime,
    venueName,
    venueAddress,
  } = data;
  const FRONTEND_URL = frontendUrl || 'https://your-site.com';

  const formattedDate = new Date(eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let text = `VIP TABLE RESERVATION CONFIRMED\n`;
  text += `${'='.repeat(50)}\n\n`;
  text += `Dear ${reservation.customer_first_name},\n\n`;
  text += `Your VIP table for ${eventName} is confirmed!\n\n`;
  
  text += `RESERVATION DETAILS\n`;
  text += `${'-'.repeat(30)}\n`;
  text += `Reservation Number: ${reservation.reservation_number}\n`;
  text += `Event: ${eventName}\n`;
  text += `Date: ${formattedDate}\n`;
  text += `Time: ${eventTime}\n`;
  text += `Table: ${reservation.vip_table?.table_name}\n`;
  text += `Location: ${reservation.vip_table?.floor_section}\n`;
  text += `Guests: ${reservation.guest_count}\n`;
  text += `Bottle Service: ${reservation.vip_table?.bottle_service_description}\n`;
  if (reservation.bottle_choice) {
    text += `Your Bottle Choice: ${reservation.bottle_choice}\n`;
  }
  text += `Total Paid: $${Number(reservation.total_amount).toFixed(2)}\n\n`;

  text += `GUEST ENTRY PASSES\n`;
  text += `${'-'.repeat(30)}\n`;
  guestPasses.forEach((pass) => {
    text += `Guest ${pass.guest_number}: ${pass.pass_id}\n`;
  });
  text += `\n`;

  text += `IMPORTANT INFORMATION\n`;
  text += `${'-'.repeat(30)}\n`;
  text += `• Arrive 30 minutes early for table setup\n`;
  text += `• Valid government-issued ID required for all guests\n`;
  text += `• Each guest scans their own QR code at entry\n`;
  text += `• Your table will be held for 1 hour after doors open\n\n`;

  text += `⛔ NO REFUNDS: All VIP table reservations are final.\n\n`;

  text += `View your reservation online: ${FRONTEND_URL}/vip-confirmation?reservationId=${reservation.id}\n\n`;

  text += `VENUE\n`;
  text += `${'-'.repeat(30)}\n`;
  text += `${venueName}\n`;
  if (venueAddress) text += `${venueAddress}\n`;
  text += `\n`;

  text += `If you have questions, contact us at support@maguey.com\n`;

  return text;
}
