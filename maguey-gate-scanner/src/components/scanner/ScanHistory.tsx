/**
 * ScanHistory - Expandable scan history list for gate scanner
 *
 * Shows last 5-10 scans with color-coded status.
 * Rows expand on tap to show full ticket details.
 */

import { CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ScanHistoryEntry {
  id: string;
  timestamp: Date;
  status: 'success' | 'failure';
  ticketType: 'GA' | 'VIP' | 'VIP Guest';
  guestName?: string;
  eventName?: string;
  errorReason?: string;
  expanded?: boolean;
}

interface ScanHistoryProps {
  entries: ScanHistoryEntry[];
  maxVisible?: number; // Default 5
  onToggleExpand: (id: string) => void;
}

/**
 * Format timestamp for display
 */
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export function ScanHistory({
  entries,
  maxVisible = 5,
  onToggleExpand,
}: ScanHistoryProps) {
  const visibleEntries = entries.slice(0, maxVisible);

  if (visibleEntries.length === 0) {
    return null;
  }

  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-2xl overflow-hidden">
      <div className="px-4 py-2 border-b border-white/10">
        <h3 className="text-xs uppercase font-bold text-white/50 tracking-wider">
          Recent Scans
        </h3>
      </div>

      <div className="divide-y divide-white/5">
        {visibleEntries.map((entry, index) => (
          <div
            key={entry.id}
            className={cn(
              'transition-all duration-200',
              index === 0 && 'animate-in slide-in-from-bottom-2 duration-300'
            )}
          >
            {/* Collapsed Row - Minimal Info */}
            <button
              onClick={() => onToggleExpand(entry.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 transition-all',
                entry.status === 'success' ? 'bg-green-500/20' : 'bg-red-500/20',
                'hover:brightness-110 active:brightness-90'
              )}
            >
              {entry.status === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              )}

              <span className="text-sm text-white/70">
                {formatTime(entry.timestamp)}
              </span>

              <span className="text-sm font-medium text-white">
                {entry.ticketType}
              </span>

              {/* Show guest name preview if available */}
              {entry.guestName && (
                <span className="text-sm text-white/50 truncate flex-1 text-left">
                  {entry.guestName}
                </span>
              )}

              <ChevronDown
                className={cn(
                  'ml-auto h-4 w-4 text-white/50 transition-transform duration-200 flex-shrink-0',
                  entry.expanded && 'rotate-180'
                )}
              />
            </button>

            {/* Expanded Row - Full Details */}
            {entry.expanded && (
              <div
                className={cn(
                  'px-4 py-3 space-y-1 text-sm animate-in slide-in-from-top-2 duration-200',
                  entry.status === 'success' ? 'bg-green-500/10' : 'bg-red-500/10'
                )}
              >
                {entry.guestName && (
                  <p className="text-white/80">
                    <span className="text-white/50">Guest:</span> {entry.guestName}
                  </p>
                )}

                {entry.eventName && (
                  <p className="text-white/60">
                    <span className="text-white/50">Event:</span> {entry.eventName}
                  </p>
                )}

                {entry.errorReason && (
                  <p className="text-red-400">
                    <span className="text-red-400/70">Reason:</span>{' '}
                    {entry.errorReason}
                  </p>
                )}

                {/* If no extra details, show timestamp details */}
                {!entry.guestName && !entry.eventName && !entry.errorReason && (
                  <p className="text-white/50">
                    Scanned at {entry.timestamp.toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Show count if there are more entries than visible */}
      {entries.length > maxVisible && (
        <div className="px-4 py-2 text-center text-xs text-white/40 border-t border-white/5">
          Showing {maxVisible} of {entries.length} scans
        </div>
      )}
    </div>
  );
}

export default ScanHistory;
