import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { WaitTimeDisplay } from "@/components/dashboard/WaitTimeDisplay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLatestWaitTimePrediction } from "@/lib/queue-prediction-service";
import { estimateQueueDepth } from "@/lib/queue-metrics-service";

export const QueueStatus = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const entryPointId = searchParams.get('entry_point') || undefined;
  
  const [eventName, setEventName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [ticketId, setTicketId] = useState("");
  const [ticketWaitTime, setTicketWaitTime] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) return;

      try {
        const { data, error } = await supabase
          .from('events')
          .select('name')
          .eq('id', eventId)
          .single();

        if (error) throw error;
        setEventName(data?.name || "");
      } catch (error) {
        console.error('Error loading event:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  const lookupTicketWaitTime = async () => {
    if (!ticketId.trim()) return;

    setIsSearching(true);
    try {
      // Get ticket's event
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select('event_id, status')
        .or(`ticket_id.eq.${ticketId},qr_token.eq.${ticketId}`)
        .maybeSingle();

      if (error) throw error;

      if (!ticket) {
        setTicketWaitTime(null);
        return;
      }

      // If already scanned, no wait time
      if (ticket.status === 'scanned') {
        setTicketWaitTime(0);
        return;
      }

      // Get wait time for this event
      const prediction = await getLatestWaitTimePrediction(ticket.event_id, entryPointId);
      setTicketWaitTime(prediction?.predicted_wait_minutes || 0);
    } catch (error) {
      console.error('Error looking up ticket:', error);
      setTicketWaitTime(null);
    } finally {
      setIsSearching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">{eventName}</h1>
          <p className="text-muted-foreground">Current Entry Queue Status</p>
        </div>

        {/* Main Wait Time Display */}
        {eventId && (
          <WaitTimeDisplay 
            eventId={eventId} 
            entryPointId={entryPointId}
            showQRCode={true}
            compact={false}
          />
        )}

        {/* Ticket Lookup */}
        <Card>
          <CardHeader>
            <CardTitle>Check Your Ticket Wait Time</CardTitle>
            <CardDescription>
              Enter your ticket ID or QR code to see your estimated wait time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter ticket ID or QR code"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    lookupTicketWaitTime();
                  }
                }}
              />
              <Button onClick={lookupTicketWaitTime} disabled={isSearching || !ticketId.trim()}>
                {isSearching ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            {ticketWaitTime !== null && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Your Estimated Wait Time</p>
                <p className="text-2xl font-bold">
                  {ticketWaitTime === 0 ? 'No wait - already scanned!' : `${ticketWaitTime} minutes`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Code Info */}
        <Card>
          <CardContent className="p-6 text-center">
            <QrCode className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Scan the QR code above with your phone camera to bookmark this page
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Wait times update every 30 seconds
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

