/**
 * Recent Guest Check-Ins Component
 * 
 * Sidebar showing recent check-ins with real-time updates.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getRecentCheckIns,
  subscribeToGuestListUpdates,
  checkInGuest,
  type GuestSearchResult,
} from '@/lib/guest-list-service';
import { isOk } from '@/lib/result';
import { formatDistanceToNow } from 'date-fns';
import { RotateCcw, Users } from 'lucide-react';
import { toast } from 'sonner';

interface RecentGuestCheckInsProps {
  eventId: string;
  scannerId: string;
}

export function RecentGuestCheckIns({
  eventId,
  scannerId,
}: RecentGuestCheckInsProps) {
  const [recentCheckIns, setRecentCheckIns] = useState<GuestSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [undoableEntries, setUndoableEntries] = useState<Set<string>>(new Set());

  // Fetch recent check-ins
  useEffect(() => {
    if (!eventId) return;

    const fetchRecent = async () => {
      setIsLoading(true);
      const result = await getRecentCheckIns(eventId, 10);
      if (isOk(result)) {
        setRecentCheckIns(result.data);
      }
      setIsLoading(false);
    };

    fetchRecent();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToGuestListUpdates(eventId, (entry) => {
      if (entry.status === 'checked_in') {
        setRecentCheckIns((prev) => {
          // Remove if already exists, add to front
          const filtered = prev.filter((e) => e.id !== entry.id);
          return [entry, ...filtered].slice(0, 10);
        });

        // Mark as undoable for 30 seconds
        setUndoableEntries((prev) => new Set(prev).add(entry.id));
        setTimeout(() => {
          setUndoableEntries((prev) => {
            const next = new Set(prev);
            next.delete(entry.id);
            return next;
          });
        }, 30000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [eventId]);

  const handleUndo = async (entry: GuestSearchResult) => {
    // Note: This would require a new function to undo check-in
    // For now, we'll just show a message
    toast.info('Undo check-in feature coming soon');
  };

  const getListTypeColor = (type: string) => {
    switch (type) {
      case 'vip':
        return 'bg-yellow-500';
      case 'comp':
        return 'bg-green-500';
      case 'reduced':
        return 'bg-blue-500';
      case 'standard':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Check-Ins</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5" />
          Recent Check-Ins
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recentCheckIns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent check-ins
          </p>
        ) : (
          <div className="space-y-2">
            {recentCheckIns.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{entry.guestName}</span>
                    <Badge className={`${getListTypeColor(entry.listType)} text-xs`}>
                      {entry.listType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {entry.actualPlusOnes !== undefined && entry.actualPlusOnes > 0 && (
                      <span>+{entry.actualPlusOnes}</span>
                    )}
                    {entry.checkedInAt && (
                      <span>{formatDistanceToNow(new Date(entry.checkedInAt), { addSuffix: true })}</span>
                    )}
                  </div>
                </div>
                {undoableEntries.has(entry.id) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUndo(entry)}
                    className="h-8 w-8 p-0"
                    title="Undo (within 30 seconds)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
