/**
 * VIP Tables Management Page
 * Admin interface for managing VIP table reservations
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useRole } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import OwnerPortalLayout from '@/components/layout/OwnerPortalLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Crown,
  Users,
  DollarSign,
  Phone,
  Mail,
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  Wine,
  MapPin,
  UserCheck,
  AlertCircle,
  RefreshCw,
  Eye,
  Edit,
  Loader2,
  Map,
  List,
  Ticket,
  Link as LinkIcon,
  Copy,
  Share2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { VIPFloorPlanAdmin } from '@/components/vip/VIPFloorPlanAdmin';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  getReservationsForEvent,
  updateReservationStatus,
  checkInAllGuests,
  confirmPaymentManually,
  getEventTableStats,
  updateTablePosition,
  generateInviteCode,
  type TableReservation,
  type VipTable,
  BOTTLE_CHOICES,
} from '@/lib/vip-tables-admin-service';
import { syncVipTables } from '@/lib/cross-site-sync';

interface Event {
  id: string;
  name: string;
  event_date: string;
  event_time: string;
}

const VipTablesManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();

  // State
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [availableTables, setAvailableTables] = useState<VipTable[]>([]);
  const [eventVipTables, setEventVipTables] = useState<{
    id: string;
    event_id: string;
    table_number: number;
    tier: 'premium' | 'front_row' | 'standard';
    capacity: number;
    price_cents: number;
    bottles_included: number;
    package_description: string | null;
    is_available: boolean;
    position_x: number;
    position_y: number;
  }[]>([]);
  const [stats, setStats] = useState<{
    totalTables: number;
    reservedTables: number;
    availableTables: number;
    totalRevenue: number;
    totalGuests: number;
    checkedInGuests: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Reservation detail dialog
  const [selectedReservation, setSelectedReservation] = useState<TableReservation | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Table info dialog (for viewing table details without reservation)
  const [showTableInfoDialog, setShowTableInfoDialog] = useState(false);
  const [selectedTableForInfo, setSelectedTableForInfo] = useState<{
    id: string;
    table_number: number;
    tier: 'premium' | 'front_row' | 'standard';
    capacity: number;
    price_cents: number;
    bottles_included: number;
    is_available: boolean;
    package_description: string | null;
  } | null>(null);

  // Linked tickets state (GA tickets purchased via invite link)
  interface LinkedTicket {
    id: string;
    purchased_by_email: string;
    purchased_by_name: string | null;
    is_booker_purchase: boolean;
    created_at: string;
    tickets: {
      id: string;
      status: string;
      ticket_id: string;
    };
  }
  const [linkedTickets, setLinkedTickets] = useState<LinkedTicket[]>([]);
  const [loadingLinkedTickets, setLoadingLinkedTickets] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  // Fetch linked tickets when a reservation is selected
  useEffect(() => {
    const fetchLinkedTickets = async () => {
      if (!selectedReservation) {
        setLinkedTickets([]);
        return;
      }

      setLoadingLinkedTickets(true);
      try {
        const { data, error } = await supabase
          .from('vip_linked_tickets')
          .select('*, tickets(id, status, ticket_id)')
          .eq('vip_reservation_id', selectedReservation.id)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setLinkedTickets(data as LinkedTicket[]);
        }
      } catch (err) {
        console.error('Error fetching linked tickets:', err);
      } finally {
        setLoadingLinkedTickets(false);
      }
    };

    fetchLinkedTickets();
  }, [selectedReservation]);

  // Redirect if not owner or promoter
  useEffect(() => {
    if (role !== 'owner' && role !== 'promoter') {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'VIP Tables is only available to owners and promoters.',
      });
      navigate('/scanner');
    }
  }, [role, navigate, toast]);

  // Load events
  useEffect(() => {
    loadEvents();
  }, []);

  // Load reservations when event changes
  useEffect(() => {
    if (selectedEventId) {
      loadReservations();
    }
  }, [selectedEventId]);

  // Real-time subscription for VIP reservations
  useEffect(() => {
    if (!selectedEventId) return;

    const channel = supabase
      .channel(`vip-reservations-${selectedEventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vip_reservations',
          filter: `event_id=eq.${selectedEventId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            toast({
              title: 'New VIP Reservation',
              description: 'A new table reservation has been made',
            });
          }
          // Reload reservations on any change
          loadReservations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEventId]);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, event_date, event_time')
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(20);

      if (error) throw error;
      setEvents(data || []);

      // Auto-select first event
      if (data && data.length > 0) {
        setSelectedEventId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading events:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load events',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadReservations = async () => {
    if (!selectedEventId) return;

    setIsLoading(true);
    try {
      // Fetch event VIP tables directly from event_vip_tables (only tables 1-20)
      const { data: eventTablesData, error: tablesError } = await supabase
        .from('event_vip_tables')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('table_number', { ascending: true });

      if (tablesError) {
        console.error('Error fetching event VIP tables:', tablesError);
        throw tablesError;
      }

      setEventVipTables(eventTablesData || []);

      // Fetch reservations
      const { data: vipReservations, error: resError } = await supabase
        .from('vip_reservations')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('created_at', { ascending: false });

      if (resError) {
        console.error('Error fetching VIP reservations:', resError);
      }

      // Map to TableReservation format for compatibility
      const mappedReservations: TableReservation[] = (vipReservations || []).map(r => ({
        id: r.id,
        reservation_number: r.qr_code_token || r.id.substring(0, 8),
        event_id: r.event_id,
        table_id: r.event_vip_table_id,
        customer_first_name: r.purchaser_name?.split(' ')[0] || '',
        customer_last_name: r.purchaser_name?.split(' ').slice(1).join(' ') || '',
        customer_email: r.purchaser_email,
        customer_phone: r.purchaser_phone || '',
        guest_count: 6, // Default from table capacity
        bottle_choice: null,
        special_requests: r.special_requests,
        table_price: r.amount_paid_cents / 100,
        total_amount: r.amount_paid_cents / 100,
        stripe_payment_intent_id: r.stripe_payment_intent_id,
        stripe_session_id: null,
        payment_status: r.status === 'confirmed' ? 'paid' : 'pending',
        paid_at: r.confirmed_at,
        status: r.status as any,
        is_walk_in: false,
        checked_in_guests: r.checked_in_at ? 1 : 0,
        arrival_time: r.checked_in_at,
        created_by: null,
        notes: r.internal_notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
        vip_table: eventTablesData?.find(t => t.id === r.event_vip_table_id) ? {
          id: r.event_vip_table_id,
          table_number: String(eventTablesData.find(t => t.id === r.event_vip_table_id)?.table_number || 0),
          table_name: `Table ${eventTablesData.find(t => t.id === r.event_vip_table_id)?.table_number || 0}`,
          tier: eventTablesData.find(t => t.id === r.event_vip_table_id)?.tier as any || 'standard',
          price: (eventTablesData.find(t => t.id === r.event_vip_table_id)?.price_cents || 0) / 100,
          guest_capacity: eventTablesData.find(t => t.id === r.event_vip_table_id)?.capacity || 6,
          bottle_service_description: eventTablesData.find(t => t.id === r.event_vip_table_id)?.package_description || '',
          floor_section: 'VIP',
          position_description: null,
          is_active: true,
          sort_order: eventTablesData.find(t => t.id === r.event_vip_table_id)?.table_number || 0,
        } : undefined,
      }));

      setReservations(mappedReservations);

      // Map event_vip_tables to VipTable format for availableTables
      const mappedTables: VipTable[] = (eventTablesData || []).map(t => ({
        id: t.id,
        table_number: String(t.table_number),
        table_name: `Table ${t.table_number}`,
        tier: t.tier as any,
        price: t.price_cents / 100,
        guest_capacity: t.capacity,
        bottle_service_description: t.package_description || '1 Bottle',
        floor_section: 'VIP',
        position_description: null,
        is_active: t.is_available,
        sort_order: t.table_number,
        is_available: t.is_available,
      }));

      setAvailableTables(mappedTables);

      // Calculate stats
      const reservedTableIds = new Set((vipReservations || [])
        .filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status))
        .map(r => r.event_vip_table_id));

      setStats({
        totalTables: eventTablesData?.length || 0,
        reservedTables: reservedTableIds.size,
        availableTables: (eventTablesData || []).filter(t => t.is_available && !reservedTableIds.has(t.id)).length,
        totalRevenue: (vipReservations || [])
          .filter(r => r.status === 'confirmed')
          .reduce((sum, r) => sum + (r.amount_paid_cents / 100), 0),
        totalGuests: (vipReservations || []).length * 6, // Approximation
        checkedInGuests: (vipReservations || []).filter(r => r.checked_in_at).length,
      });

    } catch (error) {
      console.error('Error loading reservations:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load reservations',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function for clipboard operations
  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Invite link copied', description: 'Share this link with guests to join the VIP table' });
    } catch {
      toast({ title: 'Copy failed', description: url, variant: 'destructive' });
    }
  };

  const handleCheckInAll = async (reservation: TableReservation) => {
    if (!user) return;

    console.log('Check-in all for reservation:', reservation.id, 'status:', reservation.status);

    try {
      const result = await checkInAllGuests(reservation.id, user.id, reservation.status);

      if (result.success) {
        if (result.checkedIn > 0) {
          toast({
            title: 'Guests Checked In',
            description: result.message,
          });
        } else {
          toast({
            title: 'Already Checked In',
            description: result.message,
          });
        }
        loadReservations();
      } else {
        toast({
          variant: 'destructive',
          title: 'Cannot Check In',
          description: result.message,
        });
      }
    } catch (error) {
      console.error('Error checking in guests:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred',
      });
    }
  };

  const handleConfirmPayment = async (reservation: TableReservation) => {
    if (!user) return;

    try {
      const result = await confirmPaymentManually(reservation.id, user.id);

      if (result.success) {
        toast({
          title: 'Payment Confirmed',
          description: result.message,
        });
        loadReservations();
        // Refresh the selected reservation to show updated data
        setSelectedReservation(null);
        setShowDetailDialog(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Cannot Confirm Payment',
          description: result.message,
        });
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred',
      });
    }
  };

  const handleStatusChange = async (reservationId: string, status: TableReservation['status']) => {
    try {
      await updateReservationStatus(reservationId, status);

      // Log sync for purchase site visibility
      if (selectedEventId) {
        syncVipTables(selectedEventId, 'update').catch(err =>
          console.warn('VIP sync log failed:', err)
        );
      }

      toast({
        title: 'Status Updated',
        description: `Reservation status changed to ${status}`,
      });
      loadReservations();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update reservation status',
      });
    }
  };

  // Handle table edit
  const handleTableEdit = async (tableId: string, updates: Partial<{
    price_cents: number;
    capacity: number;
    tier: 'premium' | 'front_row' | 'standard';
    is_available: boolean;
    bottles_included: number;
  }>) => {
    try {
      setIsSavingEdit(true);
      const { error } = await supabase
        .from('event_vip_tables')
        .update(updates)
        .eq('id', tableId);

      if (error) throw error;

      // Update local state
      setEventVipTables(prev => prev.map(t =>
        t.id === tableId ? { ...t, ...updates } : t
      ));

      // Log sync for purchase site visibility
      if (selectedEventId) {
        syncVipTables(selectedEventId, 'update').catch(err =>
          console.warn('VIP sync log failed:', err)
        );
      }

      toast({
        title: 'Table Updated',
        description: 'Changes saved successfully',
      });
    } catch (error) {
      console.error('Error updating table:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update table',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle table position update
  const handleUpdatePosition = async (tableId: string, x: number, y: number) => {
    const result = await updateTablePosition(tableId, { x, y });
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save table position' });
      throw new Error(result.error);
    }
  };

  // Get editing table
  const editingTable = eventVipTables.find(t => t.id === editingTableId);

  // Filter reservations
  const filteredReservations = reservations.filter((r) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.customer_first_name.toLowerCase().includes(query) ||
      r.customer_last_name.toLowerCase().includes(query) ||
      r.customer_phone.includes(query) ||
      r.customer_email.toLowerCase().includes(query) ||
      r.reservation_number.toLowerCase().includes(query) ||
      r.vip_table?.table_name.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      pending: { className: 'bg-red-500/20 text-red-400 border-red-500/50', label: '⚠ UNPAID' },
      confirmed: { className: 'bg-green-500/20 text-green-400 border-green-500/50', label: '✓ PAID' },
      checked_in: { className: 'bg-blue-500/20 text-blue-400 border-blue-500/50', label: '✓ Checked In' },
      cancelled: { className: 'bg-gray-500/20 text-gray-400 border-gray-500/50', label: 'Cancelled' },
      completed: { className: 'bg-purple-500/20 text-purple-400 border-purple-500/50', label: 'Completed' },
      no_show: { className: 'bg-orange-500/20 text-orange-400 border-orange-500/50', label: 'No Show' },
    };
    const variant = variants[status] || variants.pending;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const getTierBadge = (tier: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      premium: { className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', label: 'Premium' },
      standard: { className: 'bg-blue-500/20 text-blue-400 border-blue-500/50', label: 'Standard' },
      regular: { className: 'bg-purple-500/20 text-purple-400 border-purple-500/50', label: 'Regular' },
    };
    const variant = variants[tier] || variants.regular;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  if (role !== 'owner' && role !== 'promoter') return null;

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <OwnerPortalLayout
      title="VIP Tables"
      subtitle="Manage VIP table reservations"
      description="View reservations and track arrivals"
      actions={
        <Button variant="outline" onClick={loadReservations} disabled={isLoading} className="border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Event Selector */}
        <Card className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] shadow-[0_45px_90px_rgba(3,7,23,0.7)]">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="event-select" className="text-sm font-medium text-slate-300">Select Event</Label>
                <Select
                  value={selectedEventId || ''}
                  onValueChange={setSelectedEventId}
                >
                  <SelectTrigger id="event-select" className="bg-indigo-500/20 border-indigo-500/30 text-white hover:bg-indigo-500/30 focus:ring-indigo-500/50">
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b132f] border-indigo-500/30">
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id} className="text-white hover:bg-indigo-500/20 focus:bg-indigo-500/20">
                        {event.name} - {format(new Date(event.event_date), 'MMM d, yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label htmlFor="search" className="text-sm font-medium text-slate-300">Search Reservations</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="search"
                    placeholder="Name, phone, or reservation #"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-indigo-500/20 border-indigo-500/30 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-500/50"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Reserved</p>
                    <p className="text-2xl font-bold">{stats.reservedTables}/{stats.totalTables}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Guests</p>
                    <p className="text-2xl font-bold">{stats.totalGuests}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Checked In</p>
                    <p className="text-2xl font-bold">{stats.checkedInGuests}/{stats.totalGuests}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="text-2xl font-bold">{stats.availableTables}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content with Tabs */}
        <Tabs defaultValue="floor-plan" className="space-y-4">
          <TabsList className="bg-indigo-500/10 border border-indigo-500/20 p-1 rounded-xl">
            <TabsTrigger value="floor-plan" className="gap-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg text-slate-400 hover:text-white transition-all">
              <Map className="w-4 h-4" />
              Floor Plan
            </TabsTrigger>
            <TabsTrigger value="reservations" className="gap-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg text-slate-400 hover:text-white transition-all">
              <List className="w-4 h-4" />
              Reservations ({filteredReservations.length})
            </TabsTrigger>
          </TabsList>

          {/* Floor Plan Tab */}
          <TabsContent value="floor-plan">
            <Card className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] shadow-[0_45px_90px_rgba(3,7,23,0.7)]">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Map className="h-5 w-5 text-emerald-500" />
                      VIP Table Layout
                      {selectedEvent && (
                        <Badge variant="outline" className="ml-2">
                          {selectedEvent.name}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {isEditMode 
                        ? 'Click on a table to edit pricing, capacity & services.'
                        : 'Click on a table to view details or reservation info.'}
                    </CardDescription>
                  </div>
                  <Button
                    variant={isEditMode ? "default" : "outline"}
                    onClick={() => {
                      setIsEditMode(!isEditMode);
                      setEditingTableId(null);
                    }}
                    className={`gap-2 ${isEditMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10'}`}
                  >
                    <Edit className="h-4 w-4" />
                    {isEditMode ? 'Done Editing' : 'Edit Map & Pricing'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className={isEditMode ? "flex gap-4" : ""}>
                    {/* Floor Plan */}
                    <div className={isEditMode ? "flex-1" : ""}>
                      <VIPFloorPlanAdmin
                        tables={eventVipTables.map(t => ({
                          id: t.id,
                          event_id: t.event_id,
                          table_template_id: '',
                          table_number: t.table_number,
                          tier: t.tier,
                          capacity: t.capacity,
                          price_cents: t.price_cents,
                          bottles_included: t.bottles_included,
                          champagne_included: 0,
                          package_description: t.package_description,
                          is_available: t.is_available,
                          display_order: t.table_number,
                          position_x: t.position_x ?? null,
                          position_y: t.position_y ?? null,
                        }))}
                        reservations={reservations.map(r => ({
                          id: r.id,
                          table_number: r.vip_table?.table_number ? parseInt(r.vip_table.table_number) : 0,
                          purchaser_name: `${r.customer_first_name} ${r.customer_last_name}`,
                          status: r.status,
                        }))}
                        selectedTableId={isEditMode ? editingTableId || undefined : undefined}
                        onSelectTable={(table) => {
                          if (isEditMode) {
                            setEditingTableId(table.id);
                          } else {
                            // Find the reservation for this table
                            const reservation = reservations.find(r =>
                              r.vip_table?.table_number && parseInt(r.vip_table.table_number) === table.table_number
                            );
                            if (reservation) {
                              setSelectedReservation(reservation);
                              setShowDetailDialog(true);
                            } else {
                              // Show table info dialog for tables without reservations
                              setSelectedTableForInfo({
                                id: table.id,
                                table_number: table.table_number,
                                tier: table.tier,
                                capacity: table.capacity,
                                price_cents: table.price_cents,
                                bottles_included: table.bottles_included,
                                is_available: table.is_available,
                                package_description: table.package_description,
                              });
                              setShowTableInfoDialog(true);
                            }
                          }
                        }}
                        onUpdatePosition={handleUpdatePosition}
                        readOnly={false}
                      />
                    </div>

                    {/* Edit Panel - Only show in edit mode */}
                    {isEditMode && (
                      <div className="w-72 flex-shrink-0">
                        <Card className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] sticky top-4">
                          <CardHeader className="p-3 pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Edit className="w-3 h-3" />
                              Quick Edit
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-3 pt-0">
                            {eventVipTables.length === 0 ? (
                              <div className="text-center py-6 text-muted-foreground">
                                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-yellow-500" />
                                <p className="text-xs font-medium">No VIP tables configured</p>
                                <p className="text-[10px] mt-1">Go to Events → Edit Event → VIP Setup to configure tables for this event.</p>
                              </div>
                            ) : editingTable ? (
                              <div className="space-y-3">
                                {/* Table header */}
                                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                  <div className={`w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-bold ${
                                    editingTable.tier === 'premium' ? 'bg-amber-500' :
                                    editingTable.tier === 'front_row' ? 'bg-purple-500' : 'bg-blue-500'
                                  }`}>
                                    {editingTable.table_number}
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-semibold">Table {editingTable.table_number}</h4>
                                    <Badge className={`text-[10px] ${
                                      editingTable.tier === 'premium' ? 'bg-amber-500/20 text-amber-400' :
                                      editingTable.tier === 'front_row' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                                    }`}>
                                      {editingTable.tier === 'front_row' ? 'Front Row' : editingTable.tier.charAt(0).toUpperCase() + editingTable.tier.slice(1)}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Availability Toggle */}
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs">Available</Label>
                                  <Switch
                                    checked={editingTable.is_available}
                                    onCheckedChange={(checked) =>
                                      handleTableEdit(editingTable.id, { is_available: checked })
                                    }
                                    disabled={isSavingEdit}
                                  />
                                </div>

                                {/* Price & Capacity Row */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs flex items-center gap-1">
                                      <DollarSign className="w-3 h-3" />
                                      Price
                                    </Label>
                                    <Input
                                      type="number"
                                      className="h-8 text-sm"
                                      value={editingTable.price_cents / 100}
                                      onChange={(e) =>
                                        handleTableEdit(editingTable.id, {
                                          price_cents: Number(e.target.value) * 100,
                                        })
                                      }
                                      disabled={isSavingEdit}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs flex items-center gap-1">
                                      <Users className="w-3 h-3" />
                                      Capacity
                                    </Label>
                                    <Input
                                      type="number"
                                      className="h-8 text-sm"
                                      min={1}
                                      max={20}
                                      value={editingTable.capacity}
                                      onChange={(e) =>
                                        handleTableEdit(editingTable.id, {
                                          capacity: Number(e.target.value),
                                        })
                                      }
                                      disabled={isSavingEdit}
                                    />
                                  </div>
                                </div>

                                {/* Tier */}
                                <div className="space-y-1">
                                  <Label className="text-xs">Tier</Label>
                                  <Select
                                    value={editingTable.tier}
                                    onValueChange={(value: 'premium' | 'front_row' | 'standard') =>
                                      handleTableEdit(editingTable.id, { tier: value })
                                    }
                                    disabled={isSavingEdit}
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="premium">
                                        <span className="flex items-center gap-2 text-sm">
                                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                                          Premium
                                        </span>
                                      </SelectItem>
                                      <SelectItem value="front_row">
                                        <span className="flex items-center gap-2 text-sm">
                                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                                          Front Row
                                        </span>
                                      </SelectItem>
                                      <SelectItem value="standard">
                                        <span className="flex items-center gap-2 text-sm">
                                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                                          Standard
                                        </span>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Bottles */}
                                <div className="space-y-1">
                                  <Label className="text-xs flex items-center gap-1">
                                    <Wine className="w-3 h-3" />
                                    Bottles Included
                                  </Label>
                                  <Input
                                    type="number"
                                    className="h-8 text-sm"
                                    min={0}
                                    max={10}
                                    value={editingTable.bottles_included}
                                    onChange={(e) =>
                                      handleTableEdit(editingTable.id, {
                                        bottles_included: Number(e.target.value),
                                      })
                                    }
                                    disabled={isSavingEdit}
                                  />
                                </div>

                                {/* Clear button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-7 text-xs"
                                  onClick={() => setEditingTableId(null)}
                                >
                                  Clear Selection
                                </Button>

                                {isSavingEdit && (
                                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Saving...
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-6 text-muted-foreground">
                                <Map className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-xs">Click a table to edit</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reservations Tab */}
          <TabsContent value="reservations">
            <Card className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] shadow-[0_45px_90px_rgba(3,7,23,0.7)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  Reservations
                  {selectedEvent && (
                    <Badge variant="outline" className="ml-2">
                      {selectedEvent.name}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {filteredReservations.length} reservation{filteredReservations.length !== 1 ? 's' : ''}
                  {searchQuery && ` matching "${searchQuery}"`}
                </CardDescription>
              </CardHeader>
              <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredReservations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? 'No reservations found matching your search'
                  : 'No reservations for this event yet'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Guests</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReservations.map((reservation) => (
                      <TableRow key={reservation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-yellow-500" />
                            <div>
                              <p className="font-semibold">{reservation.vip_table?.table_name}</p>
                              {getTierBadge(reservation.vip_table?.tier || 'regular')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {reservation.customer_first_name} {reservation.customer_last_name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {reservation.reservation_number}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{reservation.customer_phone}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{reservation.guest_count}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(reservation.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={reservation.checked_in_guests > 0 ? 'text-green-500 font-semibold' : ''}>
                              {reservation.checked_in_guests}/{reservation.guest_count}
                            </span>
                            {reservation.checked_in_guests < reservation.guest_count && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCheckInAll(reservation)}
                              >
                                <UserCheck className="h-3 w-3 mr-1" />
                                All
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedReservation(reservation);
                                setShowDetailDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Select
                              value={reservation.status}
                              onValueChange={(value) =>
                                handleStatusChange(reservation.id, value as TableReservation['status'])
                              }
                            >
                              <SelectTrigger className="w-[100px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="no_show">No Show</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>

        {/* Reservation Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Reservation Details
              </DialogTitle>
            </DialogHeader>

            {selectedReservation && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Reservation #</p>
                    <p className="font-mono font-bold">{selectedReservation.reservation_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedReservation.status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Table</p>
                    <p className="font-semibold">{selectedReservation.vip_table?.table_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p>{selectedReservation.vip_table?.floor_section}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Customer Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">
                        {selectedReservation.customer_first_name} {selectedReservation.customer_last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {selectedReservation.customer_phone}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-sm">{selectedReservation.customer_email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Guests</p>
                      <p className="font-medium">{selectedReservation.guest_count}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Guest Passes</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedReservation.guest_passes?.map((pass) => (
                      <div
                        key={pass.id}
                        className={`p-2 rounded border ${
                          pass.status === 'checked_in'
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-muted/50'
                        }`}
                      >
                        <p className="text-sm font-medium">Guest {pass.guest_number}</p>
                        <p className="text-xs font-mono text-muted-foreground">{pass.pass_id}</p>
                        <Badge
                          className={
                            pass.status === 'checked_in'
                              ? 'bg-green-500/20 text-green-400 mt-1'
                              : 'mt-1'
                          }
                        >
                          {pass.status === 'checked_in' ? 'Checked In' : 'Pending'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Linked Guests - GA tickets purchased via invite link */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Ticket className="h-4 w-4" />
                      Linked GA Tickets
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={isGeneratingCode}
                      onClick={async () => {
                        setIsGeneratingCode(true);
                        try {
                          // Ensure invite code exists
                          let inviteCode = selectedReservation.invite_code;
                          if (!inviteCode) {
                            const result = await generateInviteCode(selectedReservation.id);
                            if (result.error || !result.code) {
                              toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to generate invite code' });
                              return;
                            }
                            inviteCode = result.code;
                            // Update local state so the code persists in UI
                            setSelectedReservation(prev => prev ? { ...prev, invite_code: inviteCode } : prev);
                          }

                          const purchaseBaseUrl = import.meta.env.VITE_PURCHASE_SITE_URL || (import.meta.env.DEV ? 'http://localhost:3016' : 'https://tickets.maguey.club');
                          const url = `${purchaseBaseUrl}/checkout?event=${selectedReservation.event_id}&vip=${inviteCode}`;
                          const eventName = events.find(e => e.id === selectedReservation.event_id)?.name || 'Maguey VIP';

                          const shareData = {
                            title: `Join VIP Table - ${eventName}`,
                            text: `You're invited to join Table ${selectedReservation.vip_table?.table_number || ''} at ${eventName}!`,
                            url,
                          };

                          // Try Web Share API first (mobile native share sheet)
                          if (navigator.canShare && navigator.canShare(shareData)) {
                            try {
                              await navigator.share(shareData);
                              toast({ title: 'Shared successfully' });
                            } catch (err: any) {
                              if (err.name !== 'AbortError') {
                                // Share failed, fall back to clipboard
                                await copyToClipboard(url);
                              }
                              // AbortError = user cancelled, no action needed
                            }
                          } else {
                            // Desktop fallback: copy to clipboard
                            await copyToClipboard(url);
                          }
                        } finally {
                          setIsGeneratingCode(false);
                        }
                      }}
                    >
                      {isGeneratingCode ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : navigator.canShare ? (
                        <Share2 className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {isGeneratingCode ? 'Generating...' : 'Share Invite'}
                    </Button>
                  </div>

                  {loadingLinkedTickets ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : linkedTickets.length > 0 ? (
                    <div className="space-y-2">
                      {linkedTickets.map((lt, index) => (
                        <div
                          key={lt.id}
                          className={`p-2 rounded border ${
                            lt.tickets?.status === 'checked_in'
                              ? 'bg-green-500/10 border-green-500/30'
                              : 'bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">
                                {lt.purchased_by_name || 'Guest'}
                                {lt.is_booker_purchase && (
                                  <Badge variant="secondary" className="ml-2 text-xs">Booker</Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">{lt.purchased_by_email}</p>
                            </div>
                            <Badge
                              className={
                                lt.tickets?.status === 'checked_in'
                                  ? 'bg-green-500/20 text-green-400'
                                  : ''
                              }
                            >
                              {lt.tickets?.status === 'checked_in' ? 'Checked In' : 'Confirmed'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No linked GA tickets yet</p>
                      <p className="text-xs mt-1">Share the invite link for guests to purchase</p>
                    </div>
                  )}

                  {linkedTickets.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {linkedTickets.filter(lt => lt.tickets?.status === 'checked_in').length} / {linkedTickets.length} guests checked in
                    </p>
                  )}
                </div>

                {selectedReservation.bottle_choice && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground">Bottle Choice</p>
                    <p className="font-medium flex items-center gap-2">
                      <Wine className="h-4 w-4" />
                      {BOTTLE_CHOICES.find((b) => b.id === selectedReservation.bottle_choice)?.name ||
                        selectedReservation.bottle_choice}
                    </p>
                  </div>
                )}

                {selectedReservation.special_requests && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground">Special Requests</p>
                    <p>{selectedReservation.special_requests}</p>
                  </div>
                )}

                {selectedReservation.notes && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground">Staff Notes</p>
                    <p className="text-sm bg-muted/50 p-2 rounded">{selectedReservation.notes}</p>
                  </div>
                )}

                <div className="border-t pt-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-2xl font-bold text-green-500">
                      ${Number(selectedReservation.total_amount).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Check-in Status</p>
                    <p className="text-lg font-semibold">
                      {selectedReservation.checked_in_guests}/{selectedReservation.guest_count} guests
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                Close
              </Button>
              {/* Show Confirm Payment button for pending reservations */}
              {selectedReservation && selectedReservation.status === 'pending' && (
                <Button
                  onClick={() => handleConfirmPayment(selectedReservation)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Confirm Cash/Card Payment
                </Button>
              )}
              {/* Show Check In All button only for paid/confirmed reservations */}
              {selectedReservation &&
                selectedReservation.status !== 'pending' &&
                selectedReservation.status !== 'cancelled' &&
                selectedReservation.checked_in_guests < selectedReservation.guest_count && (
                <Button onClick={() => handleCheckInAll(selectedReservation)}>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Check In All Guests
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Table Info Dialog (for tables without reservations) */}
        <Dialog open={showTableInfoDialog} onOpenChange={setShowTableInfoDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold ${
                  selectedTableForInfo?.tier === 'premium' ? 'bg-amber-500' :
                  selectedTableForInfo?.tier === 'front_row' ? 'bg-purple-500' : 'bg-blue-500'
                }`}>
                  {selectedTableForInfo?.table_number}
                </div>
                <div>
                  <span className="text-lg">Table {selectedTableForInfo?.table_number}</span>
                  <Badge className={`ml-2 text-xs ${
                    selectedTableForInfo?.tier === 'premium' ? 'bg-amber-500/20 text-amber-400' :
                    selectedTableForInfo?.tier === 'front_row' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {selectedTableForInfo?.tier === 'front_row' ? 'Front Row' : selectedTableForInfo?.tier?.charAt(0).toUpperCase() + (selectedTableForInfo?.tier?.slice(1) || '')}
                  </Badge>
                </div>
              </DialogTitle>
              <DialogDescription>
                {selectedTableForInfo?.is_available ? 'This table is available for reservation.' : 'This table is currently disabled.'}
              </DialogDescription>
            </DialogHeader>

            {selectedTableForInfo && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Price</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-500">${(selectedTableForInfo.price_cents / 100).toFixed(0)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">Capacity</span>
                    </div>
                    <p className="text-2xl font-bold">{selectedTableForInfo.capacity} <span className="text-sm font-normal text-muted-foreground">guests</span></p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Wine className="h-4 w-4" />
                      <span className="text-sm">Bottles Included</span>
                    </div>
                    <p className="text-2xl font-bold">{selectedTableForInfo.bottles_included}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm">Status</span>
                    </div>
                    <Badge variant={selectedTableForInfo.is_available ? "default" : "secondary"} className={selectedTableForInfo.is_available ? "bg-emerald-500" : ""}>
                      {selectedTableForInfo.is_available ? 'Available' : 'Disabled'}
                    </Badge>
                  </div>
                </div>

                {selectedTableForInfo.package_description && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground mb-1">Package Description</p>
                    <p className="text-sm">{selectedTableForInfo.package_description}</p>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground text-center">
                    No active reservation for this table.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setShowTableInfoDialog(false)}>
                Close
              </Button>
              <Button 
                onClick={() => {
                  setShowTableInfoDialog(false);
                  setIsEditMode(true);
                  setEditingTableId(selectedTableForInfo?.id || null);
                }}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Table
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </OwnerPortalLayout>
  );
};

export default VipTablesManagement;
