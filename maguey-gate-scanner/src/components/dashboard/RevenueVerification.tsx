/**
 * RevenueVerification Component
 *
 * Displays revenue verification status with transparent discrepancy display.
 * When DB and Stripe figures mismatch, shows both values for transparency.
 */

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  verifyRevenue,
  clearVerificationCache,
  type RevenueVerificationResult,
} from '@/lib/revenue-verification-service';
import { cn } from '@/lib/utils';

// ========================================
// Types
// ========================================

interface RevenueVerificationProps {
  eventId?: string;
  startDate: Date;
  endDate: Date;
  className?: string;
  onDiscrepancyClick?: () => void;
}

type VerificationStatus = 'loading' | 'verified' | 'discrepancy' | 'error';

// ========================================
// Currency Formatter
// ========================================

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

// ========================================
// Component
// ========================================

export function RevenueVerification({
  eventId,
  startDate,
  endDate,
  className,
  onDiscrepancyClick,
}: RevenueVerificationProps) {
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [result, setResult] = useState<RevenueVerificationResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchVerification = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      clearVerificationCache();
    }

    setStatus('loading');
    setIsRefreshing(forceRefresh);

    try {
      const verification = await verifyRevenue({
        eventId,
        startDate,
        endDate,
      });

      if (!verification) {
        setStatus('error');
        setResult(null);
      } else if (verification.hasDiscrepancy) {
        setStatus('discrepancy');
        setResult(verification);
      } else {
        setStatus('verified');
        setResult(verification);
      }
    } catch (err) {
      console.error('Revenue verification failed:', err);
      setStatus('error');
      setResult(null);
    } finally {
      setIsRefreshing(false);
    }
  }, [eventId, startDate, endDate]);

  // Fetch on mount and when props change
  useEffect(() => {
    fetchVerification();
  }, [fetchVerification]);

  const handleRefresh = () => {
    fetchVerification(true);
  };

  // ========================================
  // Loading State
  // ========================================
  if (status === 'loading' && !isRefreshing) {
    return (
      <div className={cn('flex items-center gap-2 py-2', className)}>
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
    );
  }

  // ========================================
  // Error State
  // ========================================
  if (status === 'error') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/5',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-xs text-red-300">Unable to verify</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="h-6 px-2 text-xs text-red-300 hover:text-red-200"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            'Retry'
          )}
        </Button>
      </div>
    );
  }

  // ========================================
  // Verified State (No Discrepancy)
  // ========================================
  if (status === 'verified' && result) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-green-500/30 bg-green-500/5',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span className="text-xs text-green-300">Revenue verified</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-300">
            Stripe
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="h-6 w-6 p-0 text-green-300 hover:text-green-200"
          disabled={isRefreshing}
        >
          <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
        </Button>
      </div>
    );
  }

  // ========================================
  // Discrepancy State - Per user decision: show BOTH figures
  // ========================================
  if (status === 'discrepancy' && result) {
    return (
      <div
        className={cn(
          'rounded-lg border border-amber-500/40 bg-amber-500/10 overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-amber-500/5 border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-300">
              Revenue Discrepancy Detected
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-6 w-6 p-0 text-amber-300 hover:text-amber-200"
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
            </Button>
            {onDiscrepancyClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDiscrepancyClick}
                className="h-6 px-2 text-xs text-amber-300 hover:text-amber-200"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                History
              </Button>
            )}
          </div>
        </div>

        {/* Comparison Display - Both figures shown for transparency */}
        <div className="px-3 py-3 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            {/* Database Revenue */}
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Database
              </p>
              <p className="text-sm font-semibold text-slate-200">
                {currencyFormatter.format(result.dbRevenue)}
              </p>
            </div>

            {/* Stripe Revenue */}
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Stripe
              </p>
              <p className="text-sm font-semibold text-slate-200">
                {currencyFormatter.format(result.stripeRevenue)}
              </p>
            </div>
          </div>

          {/* Difference */}
          <div className="pt-2 border-t border-amber-500/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                Difference
              </span>
              <span className="text-xs font-medium text-amber-300">
                {currencyFormatter.format(result.discrepancyAmount)}{' '}
                <span className="text-amber-400/70">
                  ({result.discrepancyPercent.toFixed(1)}%)
                </span>
              </span>
            </div>
          </div>

          {/* Breakdown (if available) */}
          {result.breakdown && (
            <div className="pt-2 border-t border-slate-700/50">
              <p className="text-[10px] text-slate-500 mb-1">DB Breakdown:</p>
              <div className="flex gap-3 text-[10px] text-slate-400">
                <span>Tickets: {currencyFormatter.format(result.breakdown.ticketRevenue)}</span>
                <span>VIP: {currencyFormatter.format(result.breakdown.vipRevenue)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
