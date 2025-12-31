/**
 * Scanner Ticket Display Component
 * Displays ticket information with event image when scanning QR codes
 * This component can be used in your separate scanner project
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, User, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScannerTicketData {
  ticket_id: string;
  status: string;
  ticket_type_name: string;
  event_name: string;
  event_image: string;
  event_date: string;
  event_time: string;
  venue_name: string;
  venue_address: string;
  customer_first_name: string;
  customer_last_name: string;
  checked_in_at?: string;
  expires_at: string;
}

interface ScannerTicketDisplayProps {
  ticket: ScannerTicketData;
  onCheckIn?: (ticketId: string) => Promise<void>;
  onReject?: (ticketId: string) => void;
}

export function ScannerTicketDisplay({ 
  ticket, 
  onCheckIn, 
  onReject 
}: ScannerTicketDisplayProps) {
  const isValid = ticket.status === 'issued';
  const isExpired = new Date(ticket.expires_at) < new Date();
  const isCheckedIn = ticket.status === 'checked_in';

  return (
    <Card className="overflow-hidden border-border/50 bg-card">
      {/* Event Image Header */}
      <div className="relative h-64 overflow-hidden bg-black/5">
        <img
          src={ticket.event_image}
          alt={ticket.event_name}
          className="w-full h-full object-contain"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h2 className="text-2xl font-bold mb-1">{ticket.event_name}</h2>
          <div className="flex items-center gap-2 text-sm opacity-90">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date(ticket.event_date).toLocaleDateString('en-US', { 
                weekday: 'short',
                month: 'short', 
                day: 'numeric',
                year: 'numeric' 
              })} • {ticket.event_time}
            </span>
          </div>
        </div>
      </div>

      {/* Ticket Details */}
      <div className="p-6 space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <Badge 
            variant={isValid ? "default" : "destructive"}
            className={
              isValid 
                ? "bg-green-500/20 text-green-400 border-green-500/50"
                : "bg-red-500/20 text-red-400 border-red-500/50"
            }
          >
            {isCheckedIn ? (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Checked In
              </>
            ) : isExpired ? (
              <>
                <XCircle className="w-3 h-3 mr-1" />
                Expired
              </>
            ) : (
              <>
                <Clock className="w-3 h-3 mr-1" />
                Valid
              </>
            )}
          </Badge>
          <Badge className="bg-primary/20 text-primary border-primary/50">
            {ticket.ticket_type_name}
          </Badge>
        </div>

        {/* Ticket ID */}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Ticket ID</div>
          <div className="font-mono text-sm font-semibold">{ticket.ticket_id}</div>
        </div>

        {/* Ticket Holder */}
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Ticket Holder</div>
            <div className="font-medium">
              {ticket.customer_first_name} {ticket.customer_last_name}
            </div>
          </div>
        </div>

        {/* Venue */}
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Venue</div>
            <div className="font-medium">{ticket.venue_name}</div>
            <div className="text-sm text-muted-foreground">{ticket.venue_address}</div>
          </div>
        </div>

        {/* Check-in Time */}
        {isCheckedIn && ticket.checked_in_at && (
          <div className="pt-4 border-t border-border/50">
            <div className="text-xs text-muted-foreground">
              Checked in: {new Date(ticket.checked_in_at).toLocaleString()}
            </div>
          </div>
        )}

        {/* Actions */}
        {isValid && !isCheckedIn && !isExpired && (
          <div className="pt-4 border-t border-border/50 space-y-2">
            {onCheckIn && (
              <Button
                className="w-full bg-gradient-primary hover:shadow-glow-primary"
                onClick={() => onCheckIn(ticket.ticket_id)}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Check In Ticket
              </Button>
            )}
            {onReject && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onReject(ticket.ticket_id)}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
            )}
          </div>
        )}

        {/* Invalid Status Message */}
        {!isValid && !isCheckedIn && (
          <div className="pt-4 border-t border-border/50">
            <div className="text-sm text-destructive">
              {isExpired ? 'This ticket has expired.' : `Ticket status: ${ticket.status}`}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

