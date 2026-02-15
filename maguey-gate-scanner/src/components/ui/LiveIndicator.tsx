/**
 * LiveIndicator Component
 *
 * Displays real-time connection status with pulsing animation when live
 * and optional last update timestamp.
 */

import { formatDistanceToNow } from 'date-fns';

interface LiveIndicatorProps {
  isLive: boolean;
  lastUpdate?: Date;
  showLastUpdate?: boolean;
}

export function LiveIndicator({
  isLive,
  lastUpdate,
  showLastUpdate = false
}: LiveIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Status dot with pulsing animation */}
      <div className="relative flex items-center justify-center">
        {isLive ? (
          <>
            {/* Pulsing outer ring */}
            <span className="absolute h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
            {/* Solid inner dot */}
            <span className="relative h-2 w-2 rounded-full bg-green-500" />
          </>
        ) : (
          /* Static gray dot when disconnected */
          <span className="h-2 w-2 rounded-full bg-gray-400" />
        )}
      </div>

      {/* Status text */}
      <span className="text-xs text-muted-foreground">
        {isLive ? 'Live' : 'Reconnecting...'}
      </span>

      {/* Optional last update time */}
      {showLastUpdate && lastUpdate && isLive && (
        <span className="text-xs text-muted-foreground/70">
          · Updated {formatDistanceToNow(lastUpdate, { addSuffix: false })} ago
        </span>
      )}
    </div>
  );
}
