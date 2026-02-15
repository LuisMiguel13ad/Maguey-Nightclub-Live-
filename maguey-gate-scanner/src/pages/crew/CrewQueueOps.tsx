import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmployeePortalLayout from "@/components/layout/EmployeePortalLayout";
import { WaitTimeDisplay } from "@/components/dashboard/WaitTimeDisplay";
import { QueueDashboard } from "@/components/dashboard/QueueDashboard";
import { StaffingRecommendations } from "@/components/dashboard/StaffingRecommendations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarDays, AlertTriangle, MapPin, RefreshCw, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { getEntryPoints } from "@/lib/queue-management-service";
import { format } from "date-fns";

interface EventRecord {
  id: string;
  name: string;
  event_date: string;
}

interface EntryPointRecord {
  id: string;
  name: string;
}

const FALLBACK_EVENTS: EventRecord[] = [
  {
    id: "demo-event",
    name: "Demo Night",
    event_date: new Date().toISOString(),
  },
];

const CrewQueueOps = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const role = useRole();

  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [entryPoints, setEntryPoints] = useState<EntryPointRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedEntryPointId, setSelectedEntryPointId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (role === "owner") {
      navigate("/queue");
      return;
    }
  }, [authLoading, user, role, navigate]);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        setEvents(FALLBACK_EVENTS);
        setSelectedEventId((prev) => prev || FALLBACK_EVENTS[0].id);
        return;
      }

      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date")
        .eq("is_active", true)
        .order("event_date", { ascending: false })
        .limit(8);

      if (error) throw error;

      const activeEvents = data || [];
      setEvents(activeEvents);
      if (activeEvents.length > 0) {
        setSelectedEventId((prev) => prev || activeEvents[0].id);
      } else {
        setSelectedEventId("");
      }
    } catch (error) {
      console.error("[CrewQueueOps] Failed to load events:", error);
      toast({
        variant: "destructive",
        title: "Unable to load events",
        description: "Crew queue data needs an active event. Please retry.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadEntryPoints = async (eventId: string) => {
    if (!eventId) {
      setEntryPoints([]);
      setSelectedEntryPointId(undefined);
      return;
    }

    try {
      const points = await getEntryPoints(eventId);
      const simplified = points.map((point) => ({
        id: point.id,
        name: point.name,
      }));
      setEntryPoints(simplified);
      setSelectedEntryPointId(undefined);
    } catch (error) {
      console.error("[CrewQueueOps] Failed to load entry points:", error);
      setEntryPoints([]);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadEntryPoints(selectedEventId);
    }
  }, [selectedEventId]);

  const activeEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId],
  );

  const layoutSubtitle = activeEvent ? `Monitoring • ${activeEvent.name}` : "Pick an event";
  const layoutDescription = activeEvent
    ? format(new Date(activeEvent.event_date), "EEEE, MMM d • h:mm a")
    : "Select an event to unlock live queue insights";

  const heroSection =
    selectedEventId && !isLoading ? (
      <WaitTimeDisplay eventId={selectedEventId} entryPointId={selectedEntryPointId} showQRCode={false} />
    ) : null;

  const headerActions = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Button
        size="sm"
        variant="secondary"
        className="w-full bg-white/10 text-white hover:bg-white/20 sm:w-auto"
        onClick={() => navigate("/scanner")}
      >
        <QrCode className="mr-2 h-4 w-4" />
        Scanner
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="w-full border-white/30 text-white hover:bg-white/10 sm:w-auto"
        onClick={loadEvents}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <EmployeePortalLayout title="Queue Watch" subtitle="Loading crew intel" actions={headerActions}>
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Fetching live queue data...
        </div>
      </EmployeePortalLayout>
    );
  }

  if (!selectedEventId) {
    return (
      <EmployeePortalLayout
        title="Queue Watch"
        subtitle="No active events assigned"
        description="Ask an owner to assign you to an active event to unlock live queue telemetry."
        actions={headerActions}
      >
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>No events available</CardTitle>
            <CardDescription className="text-purple-100/80">
              Crew queue tools need at least one active event.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-purple-100/70">
            <p>• Confirm you have the correct venue selected.</p>
            <p>• Owners can activate events from the business dashboard.</p>
            <p>• Tap refresh after an event goes live.</p>
          </CardContent>
        </Card>
      </EmployeePortalLayout>
    );
  }

  return (
    <EmployeePortalLayout
      title="Queue Watch"
      subtitle={layoutSubtitle}
      description={layoutDescription}
      actions={headerActions}
      hero={heroSection}
    >
      <div className="space-y-6">
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <MapPin className="h-4 w-4" />
              Event Target
            </CardTitle>
            <CardDescription className="text-purple-100/70">
              Choose the event and entry point you are responsible for tonight.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-purple-200/70">Event</p>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="bg-white/10 text-white border-white/20">
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{event.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.event_date), "MMM d • h:mm a")}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-purple-200/70">Entry Point</p>
              <Select
                value={selectedEntryPointId || "all"}
                onValueChange={(value) => setSelectedEntryPointId(value === "all" ? undefined : value)}
              >
                <SelectTrigger className="bg-white/10 text-white border-white/20">
                  <SelectValue placeholder="All entry points" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entry points</SelectItem>
                  {entryPoints.map((point) => (
                    <SelectItem key={point.id} value={point.id}>
                      {point.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {entryPoints.length === 0 && (
          <Alert variant="default" className="border-white/20 bg-white/5 text-white">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Single lane watch</AlertTitle>
            <AlertDescription className="text-purple-100/80">
              We did not find any configured entry points for this event. Stay with your assigned lane
              and keep the scanner synced.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6">
          <QueueDashboard eventId={selectedEventId} entryPointId={selectedEntryPointId} />
          <StaffingRecommendations
            eventId={selectedEventId}
            entryPointId={selectedEntryPointId}
            autoRefresh
            onAlert={(alert) => {
              toast({
                variant: alert.urgency === "critical" ? "destructive" : "default",
                title: "Staffing alert",
                description: alert.message,
              });
            }}
          />
        </div>

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Crew Checklist
            </CardTitle>
            <CardDescription className="text-purple-100/70">
              Keep scans flowing and owners informed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-purple-100/80">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="border-white/30 text-white">
                1
              </Badge>
              <p>Confirm your lane assignment before the queue builds.</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="border-white/30 text-white">
                2
              </Badge>
              <p>Broadcast any staffing gaps via radio or the owner dashboard chat.</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="border-white/30 text-white">
                3
              </Badge>
              <p>Run manual syncs if offline scans exceed five pending tickets.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </EmployeePortalLayout>
  );
};

export default CrewQueueOps;


