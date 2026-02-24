/**
 * RejectionOverlay - Full-screen red rejection overlay for scan feedback
 *
 * Provides unmistakable visual feedback for gate staff when a ticket is invalid.
 * Requires manual dismissal (no auto-dismiss) so staff must acknowledge rejection.
 */

import { useEffect } from 'react';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { playError } from '@/lib/audio-feedback-service';

export type RejectionReason =
  | 'already_used'
  | 'wrong_event'
  | 'invalid'
  | 'expired'
  | 'tampered'
  | 'not_found'
  | 'offline_unknown'
  | 'reentry';

export interface RejectionOverlayProps {
  reason: RejectionReason;
  details: {
    previousScan?: { staff: string; gate: string; time: string };
    wrongEventDate?: string;
    message?: string;
  };
  onDismiss: () => void;
}

/**
 * Get title and subtitle based on rejection reason
 */
const getErrorContent = (
  reason: RejectionReason,
  details: RejectionOverlayProps['details']
): { title: string; subtitle: string } => {
  switch (reason) {
    case 'already_used':
      if (details.previousScan) {
        return {
          title: 'ALREADY SCANNED',
          subtitle: `Scanned by ${details.previousScan.staff} at ${details.previousScan.gate}, ${details.previousScan.time}`,
        };
      }
      return {
        title: 'ALREADY SCANNED',
        subtitle: details.message || 'This ticket has already been used',
      };

    case 'wrong_event':
      return {
        title: 'WRONG EVENT',
        subtitle: details.wrongEventDate
          ? `This ticket is for ${details.wrongEventDate}`
          : details.message || 'This ticket is for a different event',
      };

    case 'expired':
      return {
        title: 'EXPIRED',
        subtitle: details.message || 'This ticket has expired',
      };

    case 'tampered':
      return {
        title: 'INVALID',
        subtitle: details.message || 'This ticket could not be verified',
      };

    case 'not_found':
      return {
        title: 'NOT FOUND',
        subtitle: details.message || 'Ticket does not exist',
      };

    case 'offline_unknown':
      return {
        title: 'NOT IN CACHE',
        subtitle: details.message || 'Connect to internet to verify this ticket',
      };

    case 'invalid':
    default:
      return {
        title: 'INVALID',
        subtitle: details.message || 'This ticket is not valid',
      };
  }
};

export const RejectionOverlay = ({
  reason,
  details,
  onDismiss,
}: RejectionOverlayProps) => {
  const { title, subtitle } = getErrorContent(reason, details);

  // Play error audio and haptic on mount
  useEffect(() => {
    // Play error audio feedback
    playError();

    // Trigger longer haptic pattern for rejection
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    // NO auto-dismiss - staff needs to acknowledge rejection
  }, []);

  return (
    <div data-cy="rejection-overlay" className="fixed inset-0 z-[100] bg-red-600 flex flex-col items-center justify-center animate-in fade-in duration-200">
      {/* Large X icon */}
      <div className="mb-8">
        <XCircle className="h-32 w-32 text-white" strokeWidth={1.5} />
      </div>

      {/* Error title and subtitle */}
      <div className="text-center text-white space-y-4 px-6 mb-12">
        <h2 className="text-4xl font-black uppercase tracking-tight">{title}</h2>
        <p className="text-lg opacity-90 max-w-sm mx-auto">{subtitle}</p>
      </div>

      {/* Manual dismiss button - staff must acknowledge */}
      <Button
        onClick={onDismiss}
        data-cy="dismiss"
        className="bg-white/20 hover:bg-white/30 text-white text-lg font-bold px-8 py-6 h-auto rounded-2xl border border-white/30"
      >
        Scan Next
      </Button>
    </div>
  );
};

export default RejectionOverlay;
