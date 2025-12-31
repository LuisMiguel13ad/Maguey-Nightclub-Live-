import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { QueueDashboard } from "@/components/QueueDashboard";
import { QueueAnalytics } from "@/components/QueueAnalytics";
import { StaffingRecommendations } from "@/components/StaffingRecommendations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getEntryPoints } from "@/lib/queue-management-service";
import { AlertCircle } from "lucide-react";

interface Event {
  id: string;
  name: string;
  event_date: string;
}

export const QueueManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedEntryPointId, setSelectedEntryPointId] = useState<string | undefined>(undefined);
  const [entryPoints, setEntryPoints] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    // Redirect non-owners
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Queue management is only available to owners.",
      });
      navigate("/scanner");
      return;
    }

    const loadEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, name, event_date')
          .eq('is_active', true)
          .order('event_date', { ascending: false })
          .limit(10);

        if (error) throw error;

        setEvents(data || []);
        if (data && data.length > 0) {
          setSelectedEventId(data[0].id);
        }
      } catch (error) {
        console.error('Error loading events:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load events",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadEvents();
  }, [role, navigate, toast]);

  useEffect(() => {
    const loadEntryPoints = async () => {
      if (!selectedEventId) return;

      try {
        const points = await getEntryPoints(selectedEventId);
        setEntryPoints(points.map(p => ({ id: p.id, name: p.name })));
        setSelectedEntryPointId(undefined); // Reset selection when event changes
      } catch (error) {
        console.error('Error loading entry points:', error);
      }
    };

    loadEntryPoints();
  }, [selectedEventId]);

  if (isLoading) {
    return (
      <OwnerPortalLayout title="Queue Management">
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </OwnerPortalLayout>
    );
  }

  if (!selectedEventId) {
    return (
      <OwnerPortalLayout title="Queue Management">
          <Card>
            <CardHeader>
              <CardTitle>No Active Events</CardTitle>
              <CardDescription>No active events found. Please create an event first.</CardDescription>
            </CardHeader>
          </Card>
      </OwnerPortalLayout>
    );
  }

  return (
    <OwnerPortalLayout
      title="Queue Management"
      description="Real-time queue metrics, predictions, and staffing recommendations"
    >
      <div className="space-y-8">
          {/* Event and Entry Point Selection */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Event</label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} - {new Date(event.event_date).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {entryPoints.length > 0 && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Entry Point (Optional)</label>
                <Select 
                  value={selectedEntryPointId || "all"} 
                  onValueChange={(value) => setSelectedEntryPointId(value === "all" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All entry points" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entry Points</SelectItem>
                    {entryPoints.map((point) => (
                      <SelectItem key={point.id} value={point.id}>
                        {point.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        {/* Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="staffing">Staffing</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <QueueDashboard 
              eventId={selectedEventId} 
              entryPointId={selectedEntryPointId}
            />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <QueueAnalytics 
              eventId={selectedEventId} 
              entryPointId={selectedEntryPointId}
              daysBack={7}
            />
          </TabsContent>

          <TabsContent value="staffing" className="space-y-6">
            <StaffingRecommendations 
              eventId={selectedEventId} 
              entryPointId={selectedEntryPointId}
              autoRefresh={true}
              onAlert={(alert) => {
                if (alert.urgency === 'critical' || alert.urgency === 'high') {
                  toast({
                    variant: "destructive",
                    title: "Staffing Alert",
                    description: alert.message,
                  });
                }
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </OwnerPortalLayout>
  );
};

