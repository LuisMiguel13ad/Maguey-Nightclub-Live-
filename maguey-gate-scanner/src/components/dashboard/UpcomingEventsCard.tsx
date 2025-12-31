import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, MapPin, Ticket } from "lucide-react";

interface UpcomingEvent {
  id: string;
  name: string;
  dateLabel: string;
  location?: string | null;
  ticketsSold: number;
  capacity: number;
  percentSold: number;
  status: "on-track" | "monitor" | "sellout";
}

interface UpcomingEventsCardProps {
  events: UpcomingEvent[];
  onManageEvents?: () => void;
}

const statusConfig: Record<UpcomingEvent["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }>
  = {
    "on-track": { label: "On track", variant: "secondary" },
    monitor: { label: "Monitor", variant: "outline" },
    sellout: { label: "Sellout risk", variant: "destructive" },
  };

export const UpcomingEventsCard = ({ events, onManageEvents }: UpcomingEventsCardProps) => {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-xl">Upcoming Events</CardTitle>
          <CardDescription>Ticket velocity and capacity insights</CardDescription>
        </div>
        {onManageEvents && (
          <button
            onClick={onManageEvents}
            className="text-sm font-medium text-primary hover:underline"
          >
            Manage events
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center">
            <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No upcoming events</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create an event to start tracking sales performance here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const status = statusConfig[event.status];
              return (
                <div key={event.id} className="rounded border border-border/60 p-4 shadow-sm bg-card">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold tracking-tight">{event.name}</h3>
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {event.dateLabel}
                        </span>
                        {event.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Ticket className="h-3.5 w-3.5" />
                          {event.ticketsSold.toLocaleString()} / {event.capacity.toLocaleString()} sold
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {event.percentSold.toFixed(0)}% capacity
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <Progress
                      value={Math.min(100, event.percentSold)}
                      className="h-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Remaining {Math.max(event.capacity - event.ticketsSold, 0).toLocaleString()} tickets</span>
                      <span>
                        {event.percentSold >= 100
                          ? "Sold out"
                          : `${Math.max(100 - Math.round(event.percentSold), 0)}% available`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
