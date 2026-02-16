import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  resendTicket,
  getTickets,
  type TicketsQueryOptions,
  type AdminTicketRow,
} from "@/lib/orders-service";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const TicketList = () => {
  const [filter, setFilter] = useState<"all" | "scanned" | "pending" | "refunded">("all");
  const {
    data: tickets,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin-tickets", filter],
    queryFn: () =>
      getTickets({
        status: filter,
        limit: 100,
      } as TicketsQueryOptions),
  });

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    if (filter === "all") return tickets;
    if (filter === "scanned") {
      return tickets.filter((ticket) => ticket.status === "scanned");
    }
    if (filter === "refunded") {
      return tickets.filter((ticket) => ticket.status === "refunded");
    }
    return tickets.filter(
      (ticket) => ticket.status !== "scanned" && ticket.status !== "refunded"
    );
  }, [tickets, filter]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Tickets</h1>
        </div>
        {[...Array(4)].map((_, idx) => (
          <Skeleton key={idx} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-6 border-destructive/50 bg-destructive/10">
        <h2 className="text-lg font-semibold text-destructive">
          Failed to load tickets
        </h2>
        <p className="text-sm text-destructive">
          {(error as Error)?.message ?? "Unknown error"}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tickets</h1>
          <p className="text-muted-foreground">
            Monitor issued tickets and their scan status.
          </p>
        </div>
            <Select value={filter} onValueChange={(value: typeof filter) => setFilter(value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter tickets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tickets</SelectItem>
            <SelectItem value="pending">Not scanned</SelectItem>
            <SelectItem value="scanned">Scanned</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredTickets.map((ticket) => (
          <Card
            key={ticket.id}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4"
          >
            <div>
              <p className="text-sm text-muted-foreground">
                Ticket ID: <span className="font-mono">{ticket.id}</span>
              </p>
              <p className="text-base font-medium">
                {ticket.attendee_name || "Unnamed Guest"} ·{" "}
                {ticket.attendee_email || "No email provided"}
              </p>
              <p className="text-sm text-muted-foreground">
                Type: {ticket.ticket_types?.name ?? "Unknown"} · Event:{" "}
                {ticket.events?.name ?? "Unknown"}
              </p>
              <p className="text-sm text-muted-foreground">
                Issued{" "}
                {ticket.issued_at
                  ? format(new Date(ticket.issued_at), "MMM d, yyyy p")
                  : "—"}
              </p>
            </div>

            <div className="flex flex-col gap-2 md:items-end">
              <Badge
                variant={
                  ticket.status === "scanned"
                    ? "default"
                    : ticket.status === "refunded"
                    ? "destructive"
                    : "secondary"
                }
              >
                {ticket.status.toUpperCase()}
              </Badge>
              {ticket.status === "scanned" && ticket.scanned_at && (
                <p className="text-xs text-muted-foreground">
                  Scanned at {format(new Date(ticket.scanned_at), "MMM d, yyyy p")}
                </p>
              )}
              <TicketActions ticket={ticket} />
            </div>
          </Card>
        ))}

        {filteredTickets.length === 0 && (
          <Card className="p-6 text-center text-muted-foreground">
            No tickets found for this filter.
          </Card>
        )}
      </div>
    </div>
  );
};

export default TicketList;

function TicketActions({ ticket }: { ticket: AdminTicketRow }) {
  const queryClient = useQueryClient();
  const [resendOpen, setResendOpen] = useState(false);
  const [invalidateOpen, setInvalidateOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isInvalidating, setIsInvalidating] = useState(false);

  const handleResend = async () => {
    if (!ticket.order_id) {
      toast.error("Unable to find the order for this ticket.");
      return;
    }

    setIsResending(true);
    try {
      await resendTicket(ticket.order_id, ticket.id);
      toast.success("Ticket email has been resent.");
      await queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setResendOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to resend ticket.";
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  const handleInvalidate = async () => {
    setIsInvalidating(true);
    try {
      // TODO: implement invalidate ticket API call when backend is ready.
      toast.info("Ticket invalidation workflow coming soon.");
      setInvalidateOpen(false);
    } finally {
      setIsInvalidating(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Dialog open={resendOpen} onOpenChange={setResendOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            Resend
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend ticket email?</DialogTitle>
            <DialogDescription>
              This will re-trigger the ticket email workflow for ticket{" "}
              <span className="font-mono">{ticket.id}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResendOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResend} disabled={isResending}>
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Confirm resend"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invalidateOpen} onOpenChange={setInvalidateOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" className="text-destructive">
            Invalidate
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invalidate ticket?</DialogTitle>
            <DialogDescription>
              This will mark the ticket as invalid. Future scan attempts should
              fail. TODO: implement status change once backend flow is ready.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInvalidateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive"
              onClick={handleInvalidate}
              disabled={isInvalidating}
            >
              {isInvalidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                "Confirm invalidate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


