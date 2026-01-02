/**
 * VIP Scanner Page
 * Dedicated page for door staff to scan VIP table guest passes
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VIPScanner } from '@/components/vip';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Event {
  id: string;
  name: string;
  event_date: string;
  event_time: string;
  status: 'draft' | 'published' | 'archived';
}

const VipScannerPage = () => {
  const navigate = useNavigate();
  const { eventId: urlEventId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(urlEventId || null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load events
  useEffect(() => {
    loadEvents();
  }, []);

  // Load selected event details
  useEffect(() => {
    if (selectedEventId) {
      loadEventDetails(selectedEventId);
    } else {
      setSelectedEvent(null);
    }
  }, [selectedEventId]);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get today's date and future events
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error: fetchError } = await supabase
        .from('events')
        .select('id, name, event_date, event_time, status')
        .eq('status', 'published')
        .gte('event_date', today.toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(50);

      if (fetchError) {
        throw fetchError;
      }

      setEvents(data || []);

      // If URL has eventId, try to select it
      if (urlEventId && data?.some(e => e.id === urlEventId)) {
        setSelectedEventId(urlEventId);
      } else if (data && data.length > 0 && !selectedEventId) {
        // Auto-select first event if none selected
        setSelectedEventId(data[0].id);
      }
    } catch (err) {
      console.error('Error loading events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
      toast({
        title: 'Error',
        description: 'Failed to load events',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadEventDetails = async (eventId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('id, name, event_date, event_time, status')
        .eq('id', eventId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      setSelectedEvent(data);
    } catch (err) {
      console.error('Error loading event details:', err);
      setSelectedEvent(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-gray-400">Loading events...</p>
        </div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              onClick={() => navigate('/scanner')}
              className="w-full mt-4"
              variant="outline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Scanner
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/scanner')}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Crown className="w-6 h-6 text-yellow-500" />
                <h1 className="text-xl font-bold">VIP Scanner</h1>
              </div>
            </div>

            {/* Event Selector */}
            {events.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Event:</label>
                <Select
                  value={selectedEventId || ''}
                  onValueChange={setSelectedEventId}
                >
                  <SelectTrigger className="w-[250px] bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {events.map((event) => (
                      <SelectItem
                        key={event.id}
                        value={event.id}
                        className="text-white focus:bg-gray-700"
                      >
                        {event.name} - {new Date(event.event_date).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {!selectedEventId ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">No Event Selected</h2>
              <p className="text-gray-400 mb-6">
                Please select an event from the dropdown above to start scanning VIP guest passes.
              </p>
              {events.length === 0 && (
                <Alert className="max-w-md mx-auto">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No published events found. Please create an event first.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : selectedEvent ? (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold mb-2">{selectedEvent.name}</h2>
              <p className="text-gray-400">
                {new Date(selectedEvent.event_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                {selectedEvent.event_time && ` • ${selectedEvent.event_time}`}
              </p>
            </div>
            <VIPScanner
              eventId={selectedEvent.id}
              onScanComplete={(_reservationId) => {
                // Optionally show success message or refresh
              }}
            />
          </div>
        ) : (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
              <p className="text-gray-400">Loading event details...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VipScannerPage;








