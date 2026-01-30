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
  onDismiss: () => void;
}

export const SuccessOverlay = ({
  ticketType,
  guestName,
  vipDetails,
  groupCheckIn,
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
    <div className="fixed inset-0 z-[100] bg-green-500 flex flex-col items-center justify-center animate-in fade-in duration-200">
      {/* Large checkmark icon with bounce animation */}
      <div className="mb-8 animate-[bounce_0.5s_ease-in-out]">
        <CheckCircle2 className="h-32 w-32 text-white" strokeWidth={1.5} />
      </div>

      {/* GA tickets: Minimal display - just checkmark (already shown above) */}
      {ticketType === 'ga' && (
        <div className="text-center">
          {/* Intentionally minimal - checkmark is enough for GA throughput */}
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
