/**
 * Guest Search Results Component
 * 
 * Displays search results with check-in actions.
 */

import React from 'react';
import { GuestSearchResult } from '@/lib/guest-list-service';
import { GuestCheckInCard } from './GuestCheckInCard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

interface GuestSearchResultsProps {
  results: GuestSearchResult[];
  isLoading: boolean;
  onCheckIn: (guest: GuestSearchResult, actualPlusOnes: number) => void;
  checkingInId?: string;
}

export function GuestSearchResults({
  results,
  isLoading,
  onCheckIn,
  checkingInId,
}: GuestSearchResultsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg">No guests found</p>
        <p className="text-sm mt-2">Try a different search term</p>
      </div>
    );
  }

  // Separate checked in and pending
  const pending = results.filter((g) => g.status === 'pending');
  const checkedIn = results.filter((g) => g.status === 'checked_in');

  return (
    <div className="space-y-6">
      {/* Pending Guests */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Pending ({pending.length})
          </h3>
          {pending.map((guest) => (
            <GuestCheckInCard
              key={guest.id}
              guest={guest}
              onCheckIn={(actualPlusOnes) => onCheckIn(guest, actualPlusOnes)}
              isCheckingIn={checkingInId === guest.id}
            />
          ))}
        </div>
      )}

      {/* Already Checked In */}
      {checkedIn.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Already Checked In ({checkedIn.length})
          </h3>
          {checkedIn.map((guest) => (
            <GuestCheckInCard
              key={guest.id}
              guest={guest}
              onCheckIn={(actualPlusOnes) => onCheckIn(guest, actualPlusOnes)}
              isCheckingIn={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
