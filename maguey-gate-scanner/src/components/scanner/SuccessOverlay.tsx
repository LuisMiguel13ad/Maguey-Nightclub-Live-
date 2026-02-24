/**
 * SuccessOverlay - Full-screen green success overlay for scan feedback
 *
 * Provides unmistakable visual feedback for gate staff when a ticket is valid.
 * Auto-dismisses after 1.5 seconds per context decision.
 */

import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { playSuccess, playTierSuccess } from '@/lib/audio-feedback-service';

export interface SuccessOverlayProps {
  ticketType: 'ga' | 'vip_reservation' | 'vip_guest';
  guestName?: string;
  vipDetails?: {
    tableName: string;
    tier: string;
    guestCount: number;
    holderName: string;
  };
  groupCheckIn?: { current: number; total: number };
  isReentry?: boolean; // Flag for VIP-linked re-entry
  lastEntryTime?: string; // Time of last entry (for re-entry display)
  onDismiss: () => void;
}

export const SuccessOverlay = ({
  ticketType,
  guestName,
  vipDetails,
  groupCheckIn,
  isReentry = false,
  lastEntryTime,
  onDismiss,
}: SuccessOverlayProps) => {
  // Play audio and auto-dismiss on mount
  useEffect(() => {
    // Play appropriate audio based on ticket type
    if (ticketType === 'vip_reservation' || ticketType === 'vip_guest') {
      playTierSuccess('vip');
    } else {
      playSuccess();
    }

    // Trigger short haptic for success
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Auto-dismiss after 1.5 seconds per context decision
    const timer = setTimeout(onDismiss, 1500);

    // Cleanup to prevent memory leaks
    return () => clearTimeout(timer);
  }, [onDismiss, ticketType]);

  return (
    <div data-cy="scan-result" className="fixed inset-0 z-[100] bg-green-500 flex flex-col items-center justify-center animate-in fade-in duration-200">
      {/* Re-entry banner - gold banner at top for VIP-linked re-entry */}
      {isReentry && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500 text-black py-4 px-6 text-center">
          <p className="text-2xl font-black uppercase tracking-tight">RE-ENTRY GRANTED</p>
          {lastEntryTime && (
            <p className="text-sm opacity-80 mt-1">Last entry: {lastEntryTime}</p>
          )}
        </div>
      )}

      {/* Large checkmark icon with bounce animation */}
      <div className="mb-8 animate-[bounce_0.5s_ease-in-out]">
        <CheckCircle2 className="h-32 w-32 text-white" strokeWidth={1.5} />
      </div>

      {/* GA tickets: Show guest name for hospitality greeting, fallback to just checkmark */}
      {ticketType === 'ga' && !isReentry && (
        <div className="text-center text-white">
          {guestName && (
            <p className="text-2xl font-bold">{guestName}</p>
          )}
        </div>
      )}

      {/* VIP-linked GA tickets (re-entry): Show table info */}
      {ticketType === 'ga' && isReentry && vipDetails && (
        <div className="text-center text-white space-y-2 px-6">
          <h2 className="text-3xl font-black uppercase tracking-tight">VIP GUEST</h2>
          <p className="text-2xl font-bold">{vipDetails.tableName}</p>
        </div>
      )}

      {/* VIP reservations: Full details */}
      {ticketType === 'vip_reservation' && vipDetails && (
        <div className="text-center text-white space-y-4 px-6">
          <h2 className="text-3xl font-black uppercase tracking-tight">VIP</h2>
          <div className="space-y-2">
            <p className="text-2xl font-bold">{vipDetails.tableName}</p>
            <p className="text-lg opacity-90">{vipDetails.tier} Tier</p>
            <p className="text-lg opacity-90">{vipDetails.holderName}</p>
            <p className="text-base opacity-75">
              {vipDetails.guestCount} guest{vipDetails.guestCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* VIP guest passes: Minimal - 'VIP Guest' + table number only */}
      {ticketType === 'vip_guest' && vipDetails && (
        <div className="text-center text-white space-y-2 px-6">
          <h2 className="text-3xl font-black uppercase tracking-tight">VIP GUEST</h2>
          <p className="text-2xl font-bold">{vipDetails.tableName}</p>
        </div>
      )}

      {/* Group check-in count (shown below main content if present) */}
      {groupCheckIn && groupCheckIn.total > 1 && (
        <div className="mt-6 text-white/80 text-lg">
          {groupCheckIn.current} of {groupCheckIn.total} guests checked in
        </div>
      )}
    </div>
  );
};

export default SuccessOverlay;
