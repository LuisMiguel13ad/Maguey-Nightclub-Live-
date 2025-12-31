/**
 * Guest List Manager
 * 
 * Admin interface for managing guest lists for events.
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GuestListTable } from '@/components/admin/GuestListTable';
import { AddGuestForm, AddGuestButton } from '@/components/admin/AddGuestForm';
import { BulkImportButton } from '@/components/admin/BulkGuestImport';
import {
  getEventGuestLists,
  getGuestListEntries,
  createGuestList,
  checkInGuest,
  removeGuest,
  getGuestListStats,
  type GuestList,
  type GuestListEntry,
} from '@/lib/guest-list-service';
import { getEventsPaginated } from '@/lib/events-service';
import { isOk } from '@/lib/result';
import { toast } from 'sonner';
import { Loader2, Plus, Users, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';

const GuestListManager = () => {
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('vip');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const queryClient = useQueryClient();

  // Fetch events
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const result = await getEventsPaginated({ limit: 100 });
      if (isOk(result)) {
        return result.data.items;
      }
      throw result.error;
    },
  });

  // Fetch guest lists for selected event
  const { data: guestLists, isLoading: listsLoading } = useQuery({
    queryKey: ['guest-lists', selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const result = await getEventGuestLists(selectedEventId);
      if (isOk(result)) {
        return result.data;
      }
      throw result.error;
    },
    enabled: !!selectedEventId,
  });

  // Fetch guest list entries
  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['guest-entries', selectedListId],
    queryFn: async () => {
      if (!selectedListId) return [];
      const result = await getGuestListEntries(selectedListId);
      if (isOk(result)) {
        return result.data;
      }
      throw result.error;
    },
    enabled: !!selectedListId,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['guest-stats', selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return null;
      const result = await getGuestListStats(selectedEventId);
      if (isOk(result)) {
        return result.data;
      }
      return null;
    },
    enabled: !!selectedEventId,
  });

  // Auto-select first list when lists load
  React.useEffect(() => {
    if (guestLists && guestLists.length > 0 && !selectedListId) {
      // Try to find list matching active tab
      const matchingList = guestLists.find((list) => list.listType === activeTab);
      if (matchingList) {
        setSelectedListId(matchingList.id);
      } else {
        setSelectedListId(guestLists[0].id);
      }
    }
  }, [guestLists, activeTab, selectedListId]);

  // Update selected list when tab changes
  React.useEffect(() => {
    if (guestLists) {
      const matchingList = guestLists.find((list) => list.listType === activeTab);
      if (matchingList) {
        setSelectedListId(matchingList.id);
      }
    }
  }, [activeTab, guestLists]);

  const handleCreateList = async (listType: 'vip' | 'comp' | 'reduced' | 'standard') => {
    if (!selectedEventId) {
      toast.error('Please select an event first');
      return;
    }

    setIsCreatingList(true);
    try {
      const result = await createGuestList(selectedEventId, {
        name: `${listType.toUpperCase()} List`,
        listType,
        coverCharge: listType === 'comp' ? 0 : listType === 'reduced' ? 10 : listType === 'vip' ? 0 : 20,
      });

      if (isOk(result)) {
        toast.success('Guest list created');
        queryClient.invalidateQueries({ queryKey: ['guest-lists', selectedEventId] });
        setSelectedListId(result.data.id);
        setActiveTab(listType);
      } else {
        toast.error(result.error.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create list');
    } finally {
      setIsCreatingList(false);
    }
  };

  const handleCheckIn = async (entry: GuestListEntry) => {
    const { data: userData } = await import('@/lib/supabase').then((m) => m.supabase.auth.getUser());
    if (!userData.user) {
      toast.error('Not authenticated');
      return;
    }

    try {
      const result = await checkInGuest(entry.id, userData.user.id, entry.plusOnes);
      if (isOk(result)) {
        toast.success(`${entry.guestName} checked in`);
        queryClient.invalidateQueries({ queryKey: ['guest-entries', selectedListId] });
        queryClient.invalidateQueries({ queryKey: ['guest-stats', selectedEventId] });
      } else {
        toast.error(result.error.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to check in guest');
    }
  };

  const handleRemove = async (entry: GuestListEntry) => {
    try {
      const result = await removeGuest(entry.id);
      if (isOk(result)) {
        toast.success(`${entry.guestName} removed`);
        queryClient.invalidateQueries({ queryKey: ['guest-entries', selectedListId] });
        queryClient.invalidateQueries({ queryKey: ['guest-stats', selectedEventId] });
      } else {
        toast.error(result.error.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove guest');
    }
  };

  const handleGuestAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['guest-entries', selectedListId] });
    queryClient.invalidateQueries({ queryKey: ['guest-stats', selectedEventId] });
  };

  const getListForType = (type: string) => {
    return guestLists?.find((list) => list.listType === type);
  };

  if (eventsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Guest Lists</h1>
        <p className="text-muted-foreground">
          Manage guest lists for events. Promoters can add names, door staff can check them in.
        </p>
      </div>

      {/* Event Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Event</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Choose an event" />
            </SelectTrigger>
            <SelectContent>
              {events?.map((event: any) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name || event.title || event.event_name} - {format(new Date(event.date || event.event_date || event.start_time), 'MMM d, yyyy')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && selectedEventId && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Guests</CardDescription>
              <CardTitle className="text-2xl">{stats.totalGuests}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Checked In</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.checkedIn}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Plus Ones</CardDescription>
              <CardTitle className="text-2xl">{stats.totalPlusOnes}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Guest Lists Tabs */}
      {selectedEventId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Guest Lists</CardTitle>
                <CardDescription>Manage guests by list type</CardDescription>
              </div>
              <div className="flex gap-2">
                {selectedListId && (
                  <>
                    <AddGuestButton guestListId={selectedListId} onSuccess={handleGuestAdded} />
                    <BulkImportButton guestListId={selectedListId} onSuccess={handleGuestAdded} />
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="vip">VIP</TabsTrigger>
                <TabsTrigger value="comp">Comp</TabsTrigger>
                <TabsTrigger value="reduced">Reduced</TabsTrigger>
                <TabsTrigger value="standard">Standard</TabsTrigger>
              </TabsList>

              {['vip', 'comp', 'reduced', 'standard'].map((type) => {
                const list = getListForType(type);
                const listId = list?.id || '';

                return (
                  <TabsContent key={type} value={type} className="space-y-4">
                    {listsLoading ? (
                      <Skeleton className="h-64 w-full" />
                    ) : list ? (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">{list.name}</h3>
                            <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                              <span>
                                <Users className="w-4 h-4 inline mr-1" />
                                {list.totalGuests} guests
                              </span>
                              <span>
                                <CheckCircle2 className="w-4 h-4 inline mr-1 text-green-600" />
                                {list.checkedInCount} checked in
                              </span>
                              <span>
                                <Clock className="w-4 h-4 inline mr-1 text-yellow-600" />
                                {list.totalGuests - list.checkedInCount} pending
                              </span>
                            </div>
                          </div>
                        </div>

                        {entriesLoading ? (
                          <Skeleton className="h-64 w-full" />
                        ) : (
                          <GuestListTable
                            entries={entries || []}
                            onCheckIn={handleCheckIn}
                            onRemove={handleRemove}
                            showCheckInButton={true}
                            showActions={true}
                          />
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12 border rounded-lg">
                        <p className="text-muted-foreground mb-4">
                          No {type.toUpperCase()} list created yet
                        </p>
                        <Button
                          onClick={() => handleCreateList(type as any)}
                          disabled={isCreatingList}
                        >
                          {isCreatingList && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          <Plus className="w-4 h-4 mr-2" />
                          Create {type.toUpperCase()} List
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GuestListManager;
