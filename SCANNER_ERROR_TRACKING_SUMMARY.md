# Scanner Error Tracking Implementation Summary

## Overview

Scanner-specific error tracking implemented for `maguey-gate-scanner` with specialized error types, user-friendly error display, and webhook error tracking.

---

## Files Created/Updated

### Core Error Tracking (6 files)
1. `src/lib/errors/error-types.ts` - Error types with scanner service name
2. `src/lib/errors/error-tracker.ts` - ErrorTracker with serviceName='maguey-gate-scanner'
3. `src/lib/errors/error-storage.ts` - Supabase storage for errors
4. `src/lib/errors/global-handlers.ts` - Global error handlers
5. `src/lib/errors/error-boundary.tsx` - React Error Boundary
6. `src/lib/errors/index.ts` - Module exports and setup

### Scanner-Specific (1 file)
7. `src/lib/errors/scanner-errors.ts` - Scanner-specific error types and utilities
   - `ScanErrorType` enum (8 types)
   - `ScanError` class
   - `getScanErrorRecovery()` - User-friendly recovery suggestions
   - `isRetryableError()` - Check if error can be retried
   - `shouldReportToSupport()` - Check if error should be reported

### UI Components (1 file)
8. `src/components/ScanErrorDisplay.tsx` - User-friendly error display component
   - `ScanErrorDisplay` - Full error card with recovery suggestions
   - `ScanErrorInline` - Compact inline error display

### Integration Updates (2 files)
9. Updated `src/lib/scanner-service.ts` - Error tracking in scan operations
10. Updated `src/main.tsx` - Error tracking initialization
11. Updated `supabase/functions/ticket-webhook/index.ts` - Webhook error tracking

**Total: 11 files created/updated**

---

## Scanner-Specific Error Types

### ScanErrorType Enum

| Type | Description | Severity | Category |
|------|-------------|----------|----------|
| `INVALID_QR` | QR code signature invalid or malformed | MEDIUM | VALIDATION |
| `TICKET_NOT_FOUND` | Ticket not found in database | MEDIUM | VALIDATION |
| `ALREADY_SCANNED` | Ticket already scanned (single entry mode) | LOW | VALIDATION |
| `WRONG_EVENT` | Ticket is for a different event | LOW | VALIDATION |
| `EXPIRED_TICKET` | Ticket has expired | LOW | VALIDATION |
| `CANCELLED_TICKET` | Ticket has been cancelled | LOW | VALIDATION |
| `CAMERA_ERROR` | Camera access/permission error | HIGH | NETWORK |
| `NETWORK_ERROR` | Network connection failure | HIGH | NETWORK |

### ScanError Class

```typescript
class ScanError extends AppError {
  readonly scanErrorType: ScanErrorType;
  readonly ticketId?: string;
  readonly scannerId?: string;
  
  constructor(
    type: ScanErrorType,
    message: string,
    options?: {
      ticketId?: string;
      scannerId?: string;
      eventId?: string;
      context?: ErrorContext;
      cause?: Error;
    }
  )
}
```

**Features:**
- Automatic severity/category mapping based on error type
- Includes scanner context (ticketId, scannerId, eventId)
- Integrates with error tracking system
- Supports trace correlation

---

## Error Recovery Suggestions

Each `ScanErrorType` has a user-friendly recovery message:

- **INVALID_QR**: "Please ensure the QR code is fully visible and not damaged. Try cleaning the camera lens and scanning again."
- **TICKET_NOT_FOUND**: "This ticket was not found in the system. Please verify the ticket is valid and try again, or contact support."
- **ALREADY_SCANNED**: "This ticket has already been scanned. If this is a re-entry, ensure re-entry mode is enabled."
- **WRONG_EVENT**: "This ticket is for a different event. Please verify you are scanning at the correct venue."
- **EXPIRED_TICKET**: "This ticket has expired. Please contact support if you believe this is an error."
- **CANCELLED_TICKET**: "This ticket has been cancelled. Please contact support for assistance."
- **CAMERA_ERROR**: "Camera access is required for scanning. Please grant camera permissions and try again."
- **NETWORK_ERROR**: "Network connection is required. Please check your internet connection and try again."

---

## Integration Points

### scanner-service.ts

#### Error Tracking Added To:

1. **QR Signature Validation** (`validateQRSignature`)
   - Tracks invalid QR signatures
   - Includes QR token context (redacted)

2. **Ticket Lookup** (`scanTicket`)
   - Missing ticket ID → `ScanError(INVALID_QR)`
   - Database errors → `DatabaseError`
   - Ticket not found → `ScanError(TICKET_NOT_FOUND)`

3. **Already Scanned** (`scanTicket`)
   - Tracks duplicate scan attempts
   - Includes scanned timestamp
   - Links to trace context

4. **Status Update** (`scanTicket`)
   - Database update failures → `DatabaseError`
   - Includes ticket and scanner context

5. **Fraud Detection** (`scanTicket`)
   - Non-blocking error tracking
   - Includes fraud detection context

6. **General Error Handling** (`scanTicket`)
   - Catches all unhandled errors
   - Converts to `ScanError` if needed
   - Includes full trace context

#### Context Included:
- `ticketId` - Ticket being scanned
- `scannerId` - Scanner/user performing scan
- `eventId` - Event associated with ticket
- `scanMethod` - QR, NFC, or manual
- `traceId` - Distributed trace ID for correlation
- `reEntryMode` - Re-entry mode setting

---

## ScanErrorDisplay Component

### Features

1. **Visual Error Display**
   - Color-coded by error type
   - Icon for each error type
   - Error message and type badge

2. **Recovery Suggestions**
   - User-friendly recovery message
   - Actionable guidance

3. **Action Buttons**
   - **Retry** - For retryable errors (network, camera, invalid QR)
   - **Report Issue** - For errors that should be reported (camera, network, ticket not found)

4. **Context Information**
   - Ticket ID (truncated)
   - Scanner ID (truncated)
   - Error details (development only)

### Usage

```typescript
import { ScanErrorDisplay } from '@/components/ScanErrorDisplay';
import { ScanError, ScanErrorType } from '@/lib/errors';

function ScannerComponent() {
  const [error, setError] = useState<ScanError | null>(null);

  if (error) {
    return (
      <ScanErrorDisplay
        error={error}
        onRetry={() => handleRetry()}
        onDismiss={() => setError(null)}
        onReport={() => handleReport(error)}
      />
    );
  }

  // ... scanner UI
}
```

---

## Webhook Error Tracking

### Error Types Tracked

1. **Signature Verification Failures**
   - `INVALID_SIGNATURE` - Signature mismatch
   - `TIMESTAMP_EXPIRED` - Request too old
   - `TIMESTAMP_FUTURE` - Request in future
   - `REPLAY_DETECTED` - Duplicate signature
   - `MISSING_HEADERS` - Required headers missing

2. **Processing Errors**
   - Database insert failures
   - Duplicate ticket_id errors
   - Validation errors

3. **Unhandled Errors**
   - Catch-all for unexpected errors
   - Includes full error context

### Context Included:
- `requestId` - Webhook request ID
- `traceId` - Distributed trace ID
- `clientIp` - Client IP address
- `errorCode` - Database/validation error code
- `ticketCount` - Number of tickets in request
- `orderId` - Associated order ID

---

## Error Flow for Scanner

```
Scan Attempt
    ↓
QR Validation
    ├─ Invalid → ScanError(INVALID_QR) → Tracked
    └─ Valid → Continue
    ↓
Ticket Lookup
    ├─ Not Found → ScanError(TICKET_NOT_FOUND) → Tracked
    ├─ DB Error → DatabaseError → Tracked
    └─ Found → Continue
    ↓
Status Check
    ├─ Already Scanned → ScanError(ALREADY_SCANNED) → Tracked
    └─ Valid → Continue
    ↓
Status Update
    ├─ DB Error → DatabaseError → Tracked
    └─ Success → Continue
    ↓
Scan Logging
    ├─ Error → Tracked (non-blocking)
    └─ Success → Scan Complete
    ↓
Error Display
    ├─ Show ScanErrorDisplay
    ├─ Recovery suggestion
    └─ Retry/Report actions
```

---

## Build Status

### maguey-gate-scanner
- ✅ Build: **SUCCESS**
- ✅ TypeScript: **No errors**
- ✅ All files created and integrated

---

## Usage Examples

### Creating Scan Errors

```typescript
import { ScanError, ScanErrorType } from '@/lib/errors/scanner-errors';
import { errorTracker } from '@/lib/errors';

// Invalid QR code
const error = new ScanError(
  ScanErrorType.INVALID_QR,
  'QR code signature validation failed',
  {
    scannerId: 'scanner-123',
    context: {
      qrToken: 'abc123...',
      traceId: getCurrentTraceContext()?.traceId,
    },
  }
);

errorTracker.captureError(error);
```

### Displaying Errors

```typescript
import { ScanErrorDisplay } from '@/components/ScanErrorDisplay';

function ScannerPage() {
  const [scanError, setScanError] = useState<ScanError | null>(null);

  const handleScan = async (qrCode: string) => {
    try {
      const result = await scanTicket(qrCode);
      if (!result.success) {
        // Error is already tracked in scanTicket
        setScanError(result.error as ScanError);
      }
    } catch (error) {
      // Handle unexpected errors
    }
  };

  return (
    <div>
      {scanError && (
        <ScanErrorDisplay
          error={scanError}
          onRetry={() => handleScan(qrCode)}
          onDismiss={() => setScanError(null)}
          onReport={() => reportToSupport(scanError)}
        />
      )}
      {/* Scanner UI */}
    </div>
  );
}
```

---

## Integration with Existing Systems

### Tracing Integration
- All errors include `traceId` from distributed tracing
- Errors can be correlated with scan operations
- Links to TraceViewer from ErrorDashboard

### Logging Integration
- Errors are logged via existing logger
- Error tracking adds structured context
- Non-blocking (doesn't fail scans if tracking fails)

### Event Publishing
- Scan errors don't block event publishing
- Errors tracked separately from events
- Both include trace context for correlation

---

## Next Steps

1. **Use ScanErrorDisplay**: Integrate into scanner UI components
2. **Monitor Errors**: View scanner errors in ErrorDashboard at `/admin/errors`
3. **Configure Alerts**: Set up alerts for scanner-specific errors
4. **Test Error Scenarios**: Test all scan error types to verify tracking

---

## Summary

✅ **Scanner-specific error tracking** implemented
✅ **8 scan error types** with recovery suggestions
✅ **User-friendly error display** component
✅ **Webhook error tracking** for security events
✅ **Full integration** with scanner-service.ts
✅ **Trace correlation** for debugging
✅ **Build successful**

The scanner error tracking system is complete and ready to use. All scan errors are automatically tracked with full context, and users see helpful recovery suggestions when errors occur.
