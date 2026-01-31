/**
 * VIP Table Guest Result Component
 * Displays VIP table guest info when scanning a table guest pass
 */

import { CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Crown,
  Users,
  Wine,
  MapPin,
  Phone,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TableGuestPass, TableReservation } from '@/lib/vip-tables-admin-service';

interface VipTableGuestResultProps {
  result: {
    status: 'valid' | 'used' | 'invalid';
    pass?: TableGuestPass;
    reservation?: TableReservation;
    message: string;
    reentry?: boolean;
    lastEntryTime?: string;
  };
  onReset: () => void;
}

export const VipTableGuestResult = ({ result, onReset }: VipTableGuestResultProps) => {
  const isValid = result.status === 'valid';
  const isUsed = result.status === 'used';
  const isReentry = result.reentry === true;
  const { pass, reservation } = result;

  const tierColor = {
    premium: '#EAB308',
    standard: '#3B82F6',
    regular: '#A855F7',
  }[reservation?.vip_table?.tier || 'regular'];

  const tierLabel = {
    premium: 'PREMIUM',
    standard: 'STANDARD',
    regular: 'REGULAR',
  }[reservation?.vip_table?.tier || 'regular'];

  const wrapperClass = isValid
    ? 'bg-gradient-to-b from-emerald-900 via-emerald-900/70 to-emerald-950 border-emerald-500/40 text-emerald-50'
    : isUsed
    ? 'bg-gradient-to-b from-amber-950 via-amber-900/80 to-amber-950 border-amber-500/40 text-amber-50'
    : 'bg-gradient-to-b from-[#2b0303] via-red-950 to-black border-red-500/40 text-red-50';

  const headerGlow = isValid
    ? 'shadow-[0_0_35px_rgba(16,185,129,0.45)]'
    : isUsed
    ? 'shadow-[0_0_35px_rgba(251,191,36,0.4)]'
    : 'shadow-[0_0_35px_rgba(248,113,113,0.45)]';

  return (
    <div
      className={cn(
        'rounded-3xl border-2 shadow-2xl transition-all duration-300 overflow-hidden',
        wrapperClass
      )}
    >
      {/* VIP TABLE GUEST Banner */}
      <div
        className="w-full py-4 sm:py-6 text-center font-bold text-xl sm:text-3xl uppercase tracking-wider"
        style={{
          backgroundColor: `${tierColor}20`,
          borderTop: `4px solid ${tierColor}`,
          borderBottom: `4px solid ${tierColor}`,
          color: tierColor,
        }}
      >
        <div className="flex items-center justify-center gap-3">
          <Crown className="h-6 w-6 sm:h-8 sm:w-8" />
          <span>VIP TABLE GUEST</span>
          <Crown className="h-6 w-6 sm:h-8 sm:w-8" />
        </div>
        {reservation?.vip_table && (
          <div className="text-lg mt-2" style={{ color: tierColor }}>
            {tierLabel} - {reservation.vip_table.table_name}
          </div>
        )}
      </div>

      {/* Re-entry Banner */}
      {isReentry && result.lastEntryTime && (
        <div
          className="w-full py-4 text-center font-bold text-lg sm:text-2xl uppercase tracking-wide"
          style={{
            backgroundColor: 'rgba(234, 179, 8, 0.2)',
            borderBottom: '3px solid #EAB308',
            color: '#EAB308',
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6" />
            <span>RE-ENTRY GRANTED</span>
            <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="text-sm sm:text-base mt-1 text-emerald-100">
            Last entry: {new Date(result.lastEntryTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      )}

      <CardHeader
        className={cn(
          'text-center py-8 sm:py-10 border-b border-white/10 transition-all duration-300',
          isValid
            ? 'bg-emerald-500/15'
            : isUsed
            ? 'bg-amber-500/15'
            : 'bg-red-600/20',
          headerGlow
        )}
      >
        <div className="flex justify-center mb-4 sm:mb-6">
          {isValid ? (
            <div className="p-4 sm:p-6 bg-success rounded-full shadow-glow-success">
              <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-success-foreground" />
            </div>
          ) : isUsed ? (
            <div className="p-4 sm:p-6 bg-accent rounded-full shadow-glow-gold">
              <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-accent-foreground" />
            </div>
          ) : (
            <div className="p-4 sm:p-6 bg-destructive rounded-full">
              <XCircle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive-foreground" />
            </div>
          )}
        </div>
        <h2
          className={`text-2xl sm:text-4xl font-bold mb-2 sm:mb-4 ${
            isValid
              ? 'text-success'
              : isUsed
              ? 'text-accent'
              : 'text-destructive'
          }`}
        >
          {isValid && isReentry
            ? 'VIP RE-ENTRY GRANTED'
            : isValid
            ? 'VIP ENTRY GRANTED'
            : isUsed
            ? 'ALREADY CHECKED IN'
            : 'INVALID PASS'}
        </h2>
        <p className="text-base sm:text-xl text-foreground/80 px-2">{result.message}</p>
      </CardHeader>

      {reservation && (
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Table Info */}
          <div
            className="p-4 rounded-lg border-2"
            style={{
              borderColor: tierColor,
              backgroundColor: `${tierColor}10`,
            }}
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Table</p>
                <p className="font-bold text-lg" style={{ color: tierColor }}>
                  {reservation.vip_table?.table_name}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Location</p>
                <p className="font-semibold flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {reservation.vip_table?.floor_section}
                </p>
              </div>
            </div>
          </div>

          {/* Reservation Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Reservation</p>
              <p className="font-mono font-bold text-primary">{reservation.reservation_number}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Guest</p>
              <p className="font-semibold">
                {pass?.guest_number} of {reservation.guest_count}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Reserved By</p>
              <p className="font-semibold">
                {reservation.customer_first_name} {reservation.customer_last_name}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Contact</p>
              <p className="font-semibold flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {reservation.customer_phone}
              </p>
            </div>
          </div>

          {/* Check-in Status */}
          <div className="pt-4 border-t border-primary/10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Party Check-in Status</span>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="font-bold text-lg">
                  {reservation.checked_in_guests}/{reservation.guest_count}
                </span>
                <span className="text-muted-foreground">checked in</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-2 w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${(reservation.checked_in_guests / reservation.guest_count) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Bottle Service */}
          {reservation.vip_table?.bottle_service_description && (
            <div className="pt-4 border-t border-primary/10">
              <div className="flex items-start gap-2">
                <Wine className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Bottle Service</p>
                  <p className="font-semibold">{reservation.vip_table.bottle_service_description}</p>
                  {reservation.bottle_choice && (
                    <Badge className="mt-1" variant="outline">
                      {reservation.bottle_choice}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Event Info */}
          {reservation.event && (
            <div className="pt-4 border-t border-primary/10">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{reservation.event.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {reservation.event.venue_name}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Special Requests */}
          {reservation.special_requests && (
            <div className="pt-4 border-t border-primary/10">
              <p className="text-sm text-muted-foreground mb-1">Special Requests</p>
              <p className="text-sm bg-muted/50 p-2 rounded">{reservation.special_requests}</p>
            </div>
          )}

          <Button
            onClick={onReset}
            className="w-full mt-4 sm:mt-6 bg-gradient-purple hover:shadow-glow-purple transition-all text-sm sm:text-base"
            size="lg"
          >
            Scan Next Pass
          </Button>
        </CardContent>
      )}

      {!reservation && (
        <CardContent className="p-6">
          <Button
            onClick={onReset}
            className="w-full bg-gradient-purple hover:shadow-glow-purple transition-all"
            size="lg"
          >
            Try Again
          </Button>
        </CardContent>
      )}
    </div>
  );
};

export default VipTableGuestResult;
