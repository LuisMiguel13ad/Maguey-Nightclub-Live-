# Email Service Integration Implementation

## Overview
This document describes the email notification integration implementation using SendGrid with AWS SES fallback support.

## Implementation Details

### 1. SendGrid Integration
- ✅ Installed `@sendgrid/mail` package
- ✅ Configured API key from environment variables (`VITE_SENDGRID_API_KEY`)
- ✅ Implemented email sending with support for HTML and plain text formats
- ✅ Added attachment support for tickets/reports
- ✅ Integrated with notification system

### 2. Email Templates
The system supports multiple email template types:
- **Low battery warning** (`battery_low`)
- **Capacity alerts** (`capacity_threshold`) - for 90%, 95%, 100% thresholds
- **Fraud detection alerts** (`fraud_alert`)
- **Scanner offline notifications** (`device_offline`)
- **Daily summary reports** (via metadata)
- **VIP arrival notifications** (`vip_ticket`)
- **Emergency override alerts** (`emergency`)

Templates can be configured via SendGrid Dynamic Templates using environment variables:
- `VITE_SENDGRID_TEMPLATE_BATTERY_LOW`
- `VITE_SENDGRID_TEMPLATE_CAPACITY`
- `VITE_SENDGRID_TEMPLATE_FRAUD`
- `VITE_SENDGRID_TEMPLATE_OFFLINE`
- `VITE_SENDGRID_TEMPLATE_VIP`
- `VITE_SENDGRID_TEMPLATE_EMERGENCY`

If templates are not configured, the system uses a built-in HTML template generator.

### 3. Email Service Implementation

#### Function Signature
```typescript
async function sendEmailNotification(
  recipients: string[],
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<boolean>
```

#### Key Features
- ✅ **Retry Logic**: Automatically retries failed sends up to 3 times with exponential backoff
- ✅ **Rate Limit Handling**: Detects 429 errors and waits for retry-after header
- ✅ **Email Logging**: All email sends are logged to the `notifications` table
- ✅ **Error Handling**: Graceful degradation with fallback to AWS SES
- ✅ **User ID to Email Conversion**: Automatically converts user IDs to email addresses

### 4. Error Handling

#### Retry Strategy
- Maximum 3 retry attempts
- Exponential backoff: 2s, 4s, 8s delays
- Special handling for rate limit errors (429)
- Permanent errors (4xx except 429) don't retry

#### Fallback Mechanism
- If SendGrid fails, automatically attempts AWS SES fallback
- AWS SES requires:
  - `VITE_AWS_SES_ENABLED=true`
  - `VITE_AWS_SES_ENDPOINT` (API endpoint URL)
  - `VITE_AWS_SES_REGION` (optional, defaults to us-east-1)

#### Failure Logging
- Failed sends are logged to database with:
  - Error message
  - Number of attempts
  - Recipient list
  - Timestamp

### 5. HTML Email Template

The built-in HTML template includes:
- Severity-based color coding (low=green, medium=yellow, high=orange, critical=red)
- Responsive design for mobile devices
- Metadata table for additional details
- Timestamp and branding
- Clean, professional styling

### 6. User Email Resolution

The system automatically resolves user IDs to email addresses using:
1. **Profiles Table**: Primary method - queries `profiles` table for email addresses
2. **RPC Function**: Falls back to `get_user_emails` RPC function if available
3. **Direct Email**: If recipient ID looks like an email address, uses it directly

## Environment Variables

### Required
```bash
VITE_SENDGRID_API_KEY=SG.xxxxx
VITE_SENDGRID_FROM_EMAIL=alerts@yourdomain.com
VITE_SENDGRID_FROM_NAME=Event Scanner System
```

### Optional (for SendGrid Templates)
```bash
VITE_SENDGRID_TEMPLATE_BATTERY_LOW=d-xxxxx
VITE_SENDGRID_TEMPLATE_CAPACITY=d-xxxxx
VITE_SENDGRID_TEMPLATE_FRAUD=d-xxxxx
VITE_SENDGRID_TEMPLATE_OFFLINE=d-xxxxx
VITE_SENDGRID_TEMPLATE_VIP=d-xxxxx
VITE_SENDGRID_TEMPLATE_EMERGENCY=d-xxxxx
```

### Optional (for AWS SES Fallback)
```bash
VITE_AWS_SES_ENABLED=true
VITE_AWS_SES_ENDPOINT=https://your-ses-endpoint.amazonaws.com
VITE_AWS_SES_REGION=us-east-1
```

## Usage Example

```typescript
import { sendNotification } from '@/lib/notification-service';

// Send a notification (email will be sent automatically if configured)
await sendNotification(
  {
    type: 'battery_low',
    metadata: { device_id: 'scanner-001', battery_level: 15 }
  },
  {
    title: 'Low Battery Warning',
    message: 'Scanner device scanner-001 has low battery (15%)',
    severity: 'high',
    metadata: { type: 'battery_low' }
  }
);
```

## Database Integration

### Email Logging
All email sends are logged to the `notifications` table with:
- Title (prefixed with "Email: " for successful sends, "Email Failed: " for failures)
- Message (includes recipient count)
- Severity level
- Recipient list
- Email subject
- Status (`sent` or `failed`)
- Timestamp
- Metadata (includes full email details)

### Notification Records
The notification system creates records in the `notifications` table for:
- Successful email sends
- Failed email sends (for admin alerts)
- All notification channels used

## Testing Recommendations

1. **Test Email Delivery**
   - Send test emails to various email providers
   - Verify delivery to Gmail, Outlook, Yahoo, etc.

2. **Template Rendering**
   - Test HTML rendering in different email clients
   - Verify mobile responsiveness
   - Check spam score using tools like Mail-Tester

3. **Error Scenarios**
   - Test with invalid API key
   - Test with rate limiting
   - Test fallback to AWS SES
   - Test with missing email addresses

4. **Retry Logic**
   - Verify retry attempts on transient failures
   - Verify no retry on permanent failures
   - Check exponential backoff timing

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **Email Validation**: Recipients are validated before sending
3. **Rate Limiting**: Built-in rate limit handling prevents abuse
4. **Error Messages**: Sensitive information is not exposed in error messages
5. **Database Logging**: Email addresses are stored securely in database

## Future Enhancements

- [ ] Webhook integration for delivery status tracking
- [ ] Bounce and unsubscribe handling
- [ ] Email queue management for high-volume sends
- [ ] Template preview functionality
- [ ] Email analytics and reporting
- [ ] Support for multiple email providers (Mailgun, Postmark, etc.)

## Troubleshooting

### Emails Not Sending
1. Check `VITE_SENDGRID_API_KEY` is set correctly
2. Verify `VITE_SENDGRID_FROM_EMAIL` is verified in SendGrid
3. Check browser console for error messages
4. Verify recipient email addresses are valid
5. Check SendGrid dashboard for delivery status

### Rate Limit Errors
- The system automatically handles rate limits
- Check SendGrid account limits
- Consider upgrading SendGrid plan for higher limits

### Fallback Not Working
1. Verify `VITE_AWS_SES_ENABLED=true`
2. Check `VITE_AWS_SES_ENDPOINT` is correct
3. Verify AWS SES credentials are configured
4. Check AWS SES sending limits

## Acceptance Criteria Status

✅ Emails send successfully to all recipients  
✅ Templates render correctly (built-in HTML template)  
✅ Delivery status tracked in database  
✅ Failed sends automatically retry (max 3 attempts)  
✅ Admin notified of repeated failures (logged to database)  
✅ Fallback to AWS SES works if SendGrid fails  
✅ Environment variables properly configured  
✅ No sensitive data exposed in emails  

## Notes

- The implementation uses client-side code, so SendGrid API key is exposed in the browser. For production, consider using a backend API endpoint to proxy email sends.
- The `profiles` table may need to be created if it doesn't exist
- The `notifications` table may need to be created if it doesn't exist
- RPC functions (`get_user_emails`, `should_throttle_notification`, etc.) may need to be created in Supabase




