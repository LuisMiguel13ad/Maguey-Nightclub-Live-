/**
 * Guest List Check-In Page
 * 
 * Main interface for door staff to check in guests from guest lists.
 * Optimized for speed - 800 people need to be checked in quickly.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GuestSearchInput } from '@/components/vip/GuestSearchInput';
import { GuestSearchResults } from '@/components/vip/GuestSearchResults';
import { RecentGuestCheckIns } from '@/components/dashboard/RecentGuestCheckIns';
import {
  searchGuests,
  checkInGuest,
  getGuestListStats,
  getAllGuestsForEvent,
  exportGuestListToCSV,
  type GuestSearchResult,
} from '@/lib/guest-list-service';
import { isOk } from '@/lib/result';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Users, CheckCircle2, Clock, Download, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

export function GuestListCheckIn() {
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [scannerId, setScannerId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  // Get current user for scanner ID
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setScannerId(data.user.id);
      }
    };
    getUser();
  }, []);

  // Fetch available events (upcoming events)
  const { data: events } = useQuery({
    queryKey: ['scanner-events'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('events')
        .select('id, name, event_date, event_time')
        .gte('event_date', today)
        .eq('is_active', true)
        .order('event_date', { ascending: true })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
  });

  // Auto-select first event if available
  useEffect(() => {
    if (events && events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  // Get selected event name for export
  const selectedEventName = events?.find((e: any) => e.id === selectedEventId)?.name || 'event';

  // Export guest list handler
  const handleExportGuestList = async () => {
    if (!selectedEventId) {
      toast.error('Please select an event first');
      return;
    }

    setIsExporting(true);
    try {
      const result = await getAllGuestsForEvent(selectedEventId);
      if (isOk(result)) {
        if (result.data.length === 0) {
          toast.error('No guests found for this event');
          return;
        }
        exportGuestListToCSV(result.data, selectedEventName);
        toast.success(`Exported ${result.data.length} guests to CSV`);
      } else {
        toast.error('Failed to fetch guest list');
      }
    } catch (error) {
      toast.error('Export failed');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Search guests
  const {
    data: searchResults,
    isLoading: isSearching,
    refetch: refetchSearch,
  } = useQuery({
    queryKey: ['guest-search', selectedEventId, searchTerm],
    queryFn: async () => {
      if (!selectedEventId || !searchTerm.trim()) {
        return [];
      }
      const result = await searchGuests(selectedEventId, searchTerm);
      if (isOk(result)) {
        return result.data;
      }
      throw result.error;
    },
    enabled: !!selectedEventId && searchTerm.trim().length > 0,
  });

  // Get stats
  const { data: stats } = useQuery({
    queryKey: ['guest-stats', selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return null;
      
      // Get stats from guest_list_entries
      const { data: entries, error } = await supabase
        .from('guest_list_entries')
        .select('status, plus_ones, guest_lists!inner(event_id)')
        .eq('guest_lists.event_id', selectedEventId)
        .neq('status', 'cancelled');

      if (error) throw error;

      const total = entries?.length || 0;
      const checkedIn = entries?.filter((e) => e.status === 'checked_in').length || 0;
      const pending = total - checkedIn;
      const totalPlusOnes = entries?.reduce((sum, e) => sum + (e.plus_ones || 0), 0) || 0;

      return { total, checkedIn, pending, totalPlusOnes };
    },
    enabled: !!selectedEventId,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const handleCheckIn = useCallback(
    async (guest: GuestSearchResult, actualPlusOnes: number) => {
      if (!scannerId) {
        toast.error('Scanner ID not available');
        return;
      }

      setCheckingInId(guest.id);

      try {
        const result = await checkInGuest(guest.id, scannerId, actualPlusOnes);
        if (isOk(result)) {
          toast.success(`${guest.guestName} checked in`, {
            description: actualPlusOnes > 0 ? `+${actualPlusOnes} guests` : undefined,
          });
          
          // Clear search and refetch
          setSearchTerm('');
          queryClient.invalidateQueries({ queryKey: ['guest-search', selectedEventId] });
          queryClient.invalidateQueries({ queryKey: ['guest-stats', selectedEventId] });
          
          // Refocus search input after a brief delay
          setTimeout(() => {
            const input = document.querySelector('input[type="text"]') as HTMLInputElement;
            if (input) {
              input.focus();
            }
          }, 100);
        } else {
          toast.error(result.error.message);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to check in guest');
      } finally {
        setCheckingInId(null);
      }
    },
    [scannerId, selectedEventId, queryClient]
  );

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Guest List Check-In</h1>
          <p className="text-muted-foreground">
            Search by name and check in guests quickly
          </p>
        </div>

        {/* Event Selector */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1">
                <label htmlFor="event-select" className="text-sm font-medium">
                  Event:
                </label>
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger id="event-select" className="w-full sm:w-64">
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events?.map((event: any) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name || event.title} - {new Date(event.event_date).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={handleExportGuestList}
                disabled={!selectedEventId || isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {selectedEventId && (
          <>
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-5 h-5 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Total Guests</p>
                    </div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <p className="text-sm text-muted-foreground">Checked In</p>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{stats.checkedIn}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-5 h-5 text-yellow-600" />
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                    <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-5 h-5 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Plus Ones</p>
                    </div>
                    <p className="text-2xl font-bold">{stats.totalPlusOnes}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Search and Results */}
              <div className="lg:col-span-2 space-y-6">
                {/* Search Input */}
                <GuestSearchInput
                  onSearch={setSearchTerm}
                  autoFocus={true}
                  placeholder="Type guest name to search..."
                />

                {/* Search Results */}
                {searchTerm && (
                  <GuestSearchResults
                    results={searchResults || []}
                    isLoading={isSearching}
                    onCheckIn={handleCheckIn}
                    checkingInId={checkingInId || undefined}
                  />
                )}

                {/* Empty State */}
                {!searchTerm && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-lg font-medium mb-2">Ready to check in guests</p>
                      <p className="text-sm text-muted-foreground">
                        Start typing a name to search the guest list
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right: Recent Check-Ins */}
              <div className="lg:col-span-1">
                <RecentGuestCheckIns eventId={selectedEventId} scannerId={scannerId} />
              </div>
            </div>
          </>
        )}

        {!selectedEventId && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Please select an event to begin</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
