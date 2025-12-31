/**
 * VIP Reservations List Component
 * Displays a list of VIP table reservations for an event
 */

import { useState, useEffect } from 'react';
import { Crown, Users, Calendar, Phone, Mail, CheckCircle2, Clock, XCircle, Eye, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getReservationsForEvent, type TableReservation } from '@/services/vip-admin-service';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface VIPReservationsListProps {
  eventId: string;
  onSelectReservation?: (reservation: TableReservation) => void;
  refreshTrigger?: number;
}

export function VIPReservationsList({ 
  eventId, 
  onSelectReservation,
  refreshTrigger 
}: VIPReservationsListProps) {
  const { toast } = useToast();
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadReservations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getReservationsForEvent(eventId);
      setReservations(data);
    } catch (err) {
      console.error('Error loading reservations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reservations');
      toast({
        title: 'Error',
        description: 'Failed to load VIP reservations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      loadReservations();
    }
  }, [eventId, refreshTrigger]);

  const filteredReservations = reservations.filter((reservation) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      reservation.reservation_number.toLowerCase().includes(query) ||
      reservation.customer_first_name.toLowerCase().includes(query) ||
      reservation.customer_last_name.toLowerCase().includes(query) ||
      reservation.customer_email.toLowerCase().includes(query) ||
      reservation.customer_phone.includes(query) ||
      reservation.vip_table?.table_name.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string, paymentStatus: string) => {
    if (paymentStatus === 'paid' && status === 'confirmed') {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Confirmed</Badge>;
    }
    if (paymentStatus === 'pending') {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Pending</Badge>;
    }
    if (status === 'cancelled') {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getTierBadge = (tier: string) => {
    const colors = {
      premium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      standard: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      regular: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    };
    return (
      <Badge className={colors[tier as keyof typeof colors] || colors.regular}>
        {tier.toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading reservations...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            VIP Reservations ({reservations.length})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadReservations}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Search by name, email, phone, or reservation number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {filteredReservations.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {searchQuery ? 'No reservations match your search.' : 'No VIP reservations found for this event.'}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reservation</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReservations.map((reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell>
                      <div className="font-mono text-sm">{reservation.reservation_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(reservation.created_at), 'MMM d, yyyy h:mm a')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold">
                        {reservation.customer_first_name} {reservation.customer_last_name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {reservation.customer_phone}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {reservation.customer_email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold">{reservation.vip_table?.table_name}</div>
                      {reservation.vip_table && getTierBadge(reservation.vip_table.tier)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">
                          {reservation.checked_in_guests}/{reservation.guest_count}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(reservation.status, reservation.payment_status)}
                      {reservation.is_walk_in && (
                        <Badge variant="outline" className="ml-2">Walk-in</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {reservation.checked_in_guests === reservation.guest_count ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : reservation.checked_in_guests > 0 ? (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">
                          {reservation.checked_in_guests}/{reservation.guest_count}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {onSelectReservation && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectReservation(reservation)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

