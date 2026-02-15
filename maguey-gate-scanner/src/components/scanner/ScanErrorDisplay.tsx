/**
 * Scan Error Display Component
 * 
 * User-friendly error display for scanner with recovery suggestions and actions.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, MessageSquare, X } from 'lucide-react';
import { ScanError, ScanErrorType, getScanErrorRecovery, isRetryableError, shouldReportToSupport } from '@/lib/errors/scanner-errors';

interface ScanErrorDisplayProps {
  error: ScanError;
  onRetry?: () => void;
  onDismiss?: () => void;
  onReport?: () => void;
}

export function ScanErrorDisplay({ 
  error, 
  onRetry, 
  onDismiss,
  onReport 
}: ScanErrorDisplayProps) {
  const recovery = getScanErrorRecovery(error.scanErrorType);
  const canRetry = isRetryableError(error.scanErrorType);
  const shouldReport = shouldReportToSupport(error.scanErrorType);

  const getErrorIcon = () => {
    switch (error.scanErrorType) {
      case ScanErrorType.CAMERA_ERROR:
        return '📷';
      case ScanErrorType.NETWORK_ERROR:
        return '📡';
      case ScanErrorType.INVALID_QR:
        return '🔍';
      case ScanErrorType.ALREADY_SCANNED:
        return '✅';
      case ScanErrorType.TICKET_NOT_FOUND:
        return '❓';
      default:
        return '⚠️';
    }
  };

  const getErrorColor = () => {
    switch (error.scanErrorType) {
      case ScanErrorType.CAMERA_ERROR:
      case ScanErrorType.NETWORK_ERROR:
        return 'border-red-500 bg-red-50';
      case ScanErrorType.INVALID_QR:
      case ScanErrorType.TICKET_NOT_FOUND:
        return 'border-yellow-500 bg-yellow-50';
      case ScanErrorType.ALREADY_SCANNED:
      case ScanErrorType.WRONG_EVENT:
      case ScanErrorType.EXPIRED_TICKET:
      case ScanErrorType.CANCELLED_TICKET:
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  return (
    <Card className={`border-2 ${getErrorColor()}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl">{getErrorIcon()}</div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Scan Error
              </CardTitle>
              <CardDescription className="mt-1">
                {error.message}
              </CardDescription>
            </div>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error Type Badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {error.scanErrorType.replace(/_/g, ' ').toUpperCase()}
          </Badge>
          {error.ticketId && (
            <Badge variant="secondary" className="text-xs">
              Ticket: {error.ticketId.substring(0, 8)}...
            </Badge>
          )}
          {error.scannerId && (
            <Badge variant="secondary" className="text-xs">
              Scanner: {error.scannerId.substring(0, 8)}...
            </Badge>
          )}
        </div>

        {/* Recovery Suggestion */}
        <div className="p-3 bg-background rounded-lg border">
          <div className="text-sm font-semibold mb-1">What to do:</div>
          <div className="text-sm text-muted-foreground">{recovery}</div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {canRetry && onRetry && (
            <Button onClick={onRetry} variant="default" className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
          {shouldReport && onReport && (
            <Button onClick={onReport} variant="outline" className="flex-1">
              <MessageSquare className="w-4 h-4 mr-2" />
              Report Issue
            </Button>
          )}
        </div>

        {/* Additional Context (Development Only) */}
        {import.meta.env.DEV && error.context && Object.keys(error.context).length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground mb-2">
              Error Details (Dev Only)
            </summary>
            <pre className="whitespace-pre-wrap text-xs bg-background p-2 rounded overflow-auto max-h-32">
              {JSON.stringify(error.context, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Inline error display for smaller contexts
 */
export function ScanErrorInline({ error }: { error: ScanError }) {
  const recovery = getScanErrorRecovery(error.scanErrorType);
  
  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-sm text-red-900">{error.message}</div>
          <div className="text-xs text-red-700 mt-1">{recovery}</div>
        </div>
      </div>
    </div>
  );
}
