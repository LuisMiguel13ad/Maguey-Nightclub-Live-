/**
 * VipSuccessOverlay - Full-screen success overlay for VIP guest pass scans
 *
 * Follows the SuccessOverlay pattern (full-screen green, auto-dismiss) but
 * shows rich VIP information: table, tier, guest number, party progress.
 * Auto-dismisses after 2s (slightly longer than GA's 1.5s for richer info).
 */

import { useEffect } from 'react';
import { CheckCircle2, Crown } from 'lucide-react';
import { playTierSuccess, hapticVIP } from '@/lib/audio-feedback-service';
import type { VipReservation } from '@/lib/vip-tables-admin-service';

export interface VipSuccessOverlayProps {
  pass: {
    id: string;
    guest_number: number;
    guest_name: string | null;
    status: string;
  };
  reservation: VipReservation;
  isReentry: boolean;
  lastEntryTime?: string;
  checkedInGuests: number;
  totalGuests: number;
  onDismiss: () => void;
}

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  premium: { bg: 'bg-yellow-500', text: 'text-yellow-500' },
  front_row: { bg: 'bg-yellow-500', text: 'text-yellow-500' },
  standard: { bg: 'bg-blue-500', text: 'text-blue-500' },
  regular: { bg: 'bg-purple-500', text: 'text-purple-500' },
};

export const VipSuccessOverlay = ({
  pass,
  reservation,
  isReentry,
  lastEntryTime,
  checkedInGuests,
  totalGuests,
  onDismiss,
}: VipSuccessOverlayProps) => {
  const tier = reservation.event_vip_table?.tier || 'standard';
  const tierColor = TIER_COLORS[tier] || TIER_COLORS.standard;
  const tableName = reservation.event_vip_table?.table_name || `Table ${reservation.table_number}`;
  const floorSection = reservation.event_vip_table?.floor_section;

  useEffect(() => {
    playTierSuccess('vip');

    hapticVIP();

    const timer = setTimeout(onDismiss, 2000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const progressPercent = totalGuests > 0 ? Math.round((checkedInGuests / totalGuests) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[100] bg-green-500 flex flex-col items-center justify-center animate-in fade-in duration-200">
      {/* Re-entry banner */}
      {isReentry && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500 text-black py-4 px-6 text-center">
          <p className="text-2xl font-black uppercase tracking-tight">RE-ENTRY GRANTED</p>
          {lastEntryTime && (
            <p className="text-sm opacity-80 mt-1">Last entry: {lastEntryTime}</p>
          )}
        </div>
      )}

      {/* Tier badge */}
      <div className={`${tierColor.bg} text-black px-6 py-2 rounded-full mb-6 flex items-center gap-2`}>
        <Crown className="h-5 w-5" />
        <span className="text-sm font-black uppercase tracking-wider">
          VIP TABLE GUEST
        </span>
      </div>

      {/* Checkmark */}
      <div className="mb-6 animate-[bounce_0.5s_ease-in-out]">
        <CheckCircle2 className="h-24 w-24 text-white" strokeWidth={1.5} />
      </div>

      {/* Table info */}
      <div className="text-center text-white space-y-3 px-6">
        <h2 className="text-3xl font-black uppercase tracking-tight">{tableName}</h2>
        {floorSection && (
          <p className="text-lg opacity-80">{floorSection}</p>
        )}
      </div>

      {/* Guest info */}
      <div className="mt-6 text-center text-white">
        {pass.guest_name ? (
          <p className="text-xl font-bold">{pass.guest_name}</p>
        ) : (
          <p className="text-xl font-bold">Guest {pass.guest_number}</p>
        )}
        {totalGuests > 0 && (
          <p className="text-base opacity-80 mt-1">
            Guest {pass.guest_number} of {totalGuests}
          </p>
        )}
      </div>

      {/* Party check-in progress */}
      {totalGuests > 1 && (
        <div className="mt-6 w-64 px-6">
          <div className="flex justify-between text-sm text-white/80 mb-1">
            <span>Party check-in</span>
            <span>{checkedInGuests} / {totalGuests}</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Manual dismiss button */}
      <button
        onClick={onDismiss}
        className="mt-8 px-8 py-3 bg-white/20 rounded-full text-white font-bold text-sm uppercase tracking-wider hover:bg-white/30 transition-colors"
      >
        Scan Next
      </button>
    </div>
  );
};

export default VipSuccessOverlay;
