import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Trash2,
  CheckCheck,
  X,
  User
} from "lucide-react";
import { useEffect, useState } from "react";
import type { QueuedTicket, BatchGroup } from "@/lib/batch-scan-service";
import { detectTicketGroups, getPartySize } from "@/lib/batch-scan-service";

interface BatchQueueProps {
  queuedTickets: QueuedTicket[];
  onApproveBatch: () => void;
  onClearQueue: () => void;
  onRemoveTicket: (ticketId: string) => void;
  isProcessing: boolean;
}

export const BatchQueue = ({
  queuedTickets,
  onApproveBatch,
  onClearQueue,
  onRemoveTicket,
  isProcessing,
}: BatchQueueProps) => {
  const [partySizes, setPartySizes] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    // Fetch actual party sizes for tickets with order IDs
    const fetchPartySizes = async () => {
      const sizeMap = new Map<string, number>();
      const orderIds = new Set(queuedTickets.map(t => t.orderId).filter(Boolean) as string[]);
      
      for (const orderId of orderIds) {
        const ticketsInOrder = queuedTickets.filter(t => t.orderId === orderId);
        if (ticketsInOrder.length > 0 && ticketsInOrder[0].ticket) {
          try {
            const size = await getPartySize(ticketsInOrder[0].ticket);
            sizeMap.set(orderId, size);
          } catch (error) {
            console.error('Error fetching party size:', error);
            sizeMap.set(orderId, ticketsInOrder.length);
          }
        }
      }
      
      setPartySizes(sizeMap);
    };

    if (queuedTickets.length > 0) {
      fetchPartySizes();
    }
  }, [queuedTickets]);

  if (queuedTickets.length === 0) return null;

  const validTickets = queuedTickets.filter(t => t.status === 'valid');
  const invalidTickets = queuedTickets.filter(t => t.status !== 'valid');
  const groups = detectTicketGroups(queuedTickets);

  // Calculate total party size using actual party sizes when available
  let totalPartySize = 0;
  const processedOrderIds = new Set<string>();
  
  groups.forEach(group => {
    const actualSize = partySizes.get(group.orderId) || group.partySize;
    totalPartySize += actualSize;
    processedOrderIds.add(group.orderId);
  });
  
  // Add individual tickets not in groups
  queuedTickets.forEach(t => {
    if (!t.orderId || !processedOrderIds.has(t.orderId)) {
      totalPartySize += 1;
    }
  });

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Batch Queue</CardTitle>
            <Badge variant="outline" className="border-primary/50">
              {queuedTickets.length} {queuedTickets.length === 1 ? 'ticket' : 'tickets'}
            </Badge>
            {totalPartySize > queuedTickets.length && (
              <Badge className="bg-accent/20 text-accent border-accent/50">
                <Users className="h-3 w-3 mr-1" />
                Party of {totalPartySize}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearQueue}
            disabled={isProcessing}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Group Indicators */}
        {groups.length > 0 && (
          <div className="space-y-2">
            {groups.map((group) => {
              const actualPartySize = partySizes.get(group.orderId) || group.partySize;
              return (
                <Alert key={group.orderId} className="border-accent/50 bg-accent/5">
                  <Users className="h-4 w-4 text-accent" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold">Party of {actualPartySize}</span>
                        {actualPartySize > group.tickets.length && (
                          <Badge variant="outline" className="ml-2 text-xs border-accent/50 text-accent">
                            {group.tickets.length} in queue
                          </Badge>
                        )}
                        {group.customerName && (
                          <span className="text-muted-foreground ml-2">• {group.customerName}</span>
                        )}
                      </div>
                      <Badge variant="outline" className="border-accent/50 text-accent">
                        {group.tickets.filter(t => t.status === 'valid').length}/{group.tickets.length} valid
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              );
            })}
          </div>
        )}

        {/* Valid Tickets List */}
        {validTickets.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Valid Tickets ({validTickets.length})
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {validTickets.map((queuedTicket) => {
                const group = groups.find(g => g.orderId === queuedTicket.orderId);
                const actualPartySize = group ? (partySizes.get(group.orderId) || group.partySize) : 1;
                
                return (
                  <div
                    key={queuedTicket.id}
                    className="flex items-center justify-between p-2 bg-success/10 rounded-lg border border-success/20"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium truncate">
                          {queuedTicket.guestName || queuedTicket.ticketId}
                        </span>
                        {actualPartySize > 1 && (
                          <Badge variant="outline" className="text-xs border-accent/50 text-accent">
                            Party of {actualPartySize}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {queuedTicket.ticketType} • {queuedTicket.ticketId.slice(-8)}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveTicket(queuedTicket.id)}
                      disabled={isProcessing}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Invalid Tickets List */}
        {invalidTickets.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Issues ({invalidTickets.length})
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {invalidTickets.map((queuedTicket) => (
                <div
                  key={queuedTicket.id}
                  className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg border border-destructive/20"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                      <span className="font-medium truncate text-sm">
                        {queuedTicket.guestName || queuedTicket.ticketId}
                      </span>
                    </div>
                    <div className="text-xs text-destructive mt-0.5">
                      {queuedTicket.message}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveTicket(queuedTicket.id)}
                    disabled={isProcessing}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {validTickets.length > 0 && (
          <div className="flex gap-2 pt-2 border-t border-primary/10">
            <Button
              onClick={onApproveBatch}
              disabled={isProcessing || validTickets.length === 0}
              className="flex-1 bg-gradient-green hover:shadow-glow-green"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              {isProcessing 
                ? `Processing...` 
                : `Approve All (${validTickets.length})`}
            </Button>
            {invalidTickets.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  invalidTickets.forEach(t => onRemoveTicket(t.id));
                }}
                disabled={isProcessing}
                className="border-destructive/20 text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Remove Invalid
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

