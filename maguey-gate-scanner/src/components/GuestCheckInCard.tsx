/**
 * Guest Check-In Card Component
 * 
 * Individual guest card with check-in action - optimized for speed.
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GuestSearchResult } from '@/lib/guest-list-service';
import { CheckCircle2, UserPlus, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface GuestCheckInCardProps {
  guest: GuestSearchResult;
  onCheckIn: (actualPlusOnes: number) => void;
  isCheckingIn?: boolean;
}

export function GuestCheckInCard({
  guest,
  onCheckIn,
  isCheckingIn = false,
}: GuestCheckInCardProps) {
  const [actualPlusOnes, setActualPlusOnes] = useState(guest.plusOnes);

  const isCheckedIn = guest.status === 'checked_in';

  // List type colors
  const getListTypeColor = (type: string) => {
    switch (type) {
      case 'vip':
        return 'bg-yellow-500 hover:bg-yellow-600 text-yellow-950';
      case 'comp':
        return 'bg-green-500 hover:bg-green-600 text-green-950';
      case 'reduced':
        return 'bg-blue-500 hover:bg-blue-600 text-blue-950';
      case 'standard':
        return 'bg-gray-500 hover:bg-gray-600 text-gray-950';
      default:
        return 'bg-gray-500';
    }
  };

  const handleCheckIn = () => {
    onCheckIn(actualPlusOnes);
  };

  const adjustPlusOnes = (delta: number) => {
    const newValue = Math.max(0, Math.min(10, actualPlusOnes + delta));
    setActualPlusOnes(newValue);
  };

  return (
    <Card className={`transition-all ${isCheckedIn ? 'opacity-60 bg-muted' : 'hover:shadow-md'}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Guest Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-semibold truncate">{guest.guestName}</h3>
              <Badge className={getListTypeColor(guest.listType)}>
                {guest.listType.toUpperCase()}
              </Badge>
              {isCheckedIn && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Checked In
                </Badge>
              )}
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              {guest.plusOnes > 0 && (
                <div className="flex items-center gap-1">
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {guest.plusOnes} {guest.plusOnes === 1 ? 'guest' : 'guests'}
                  </span>
                </div>
              )}

              {guest.coverCharge > 0 && (
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  <span>Cover: ${guest.coverCharge}</span>
                </div>
              )}

              {guest.notes && (
                <div className="text-xs italic">{guest.notes}</div>
              )}

              {guest.addedByName && (
                <div className="text-xs">Added by: {guest.addedByName}</div>
              )}

              {isCheckedIn && guest.checkedInAt && (
                <div className="text-xs text-green-600">
                  Checked in: {format(new Date(guest.checkedInAt), 'h:mm a')}
                </div>
              )}
            </div>
          </div>

          {/* Right: Check-in Action */}
          {!isCheckedIn && (
            <div className="flex flex-col items-end gap-2">
              {/* Plus Ones Adjustment */}
              {guest.plusOnes > 0 && (
                <div className="flex items-center gap-2 bg-muted rounded-lg px-2 py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => adjustPlusOnes(-1)}
                    disabled={actualPlusOnes === 0}
                  >
                    -
                  </Button>
                  <span className="text-sm font-medium w-8 text-center">
                    {actualPlusOnes}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => adjustPlusOnes(1)}
                    disabled={actualPlusOnes >= 10}
                  >
                    +
                  </Button>
                </div>
              )}

              {/* Check In Button */}
              <Button
                onClick={handleCheckIn}
                disabled={isCheckingIn}
                size="lg"
                className="min-w-[120px] h-12 text-base font-semibold"
              >
                {isCheckingIn ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Checking...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    CHECK IN
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
