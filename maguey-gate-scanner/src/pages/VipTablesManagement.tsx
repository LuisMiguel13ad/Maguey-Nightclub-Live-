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
  Plus,
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
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { VIPFloorPlanAdmin } from '@/components/vip/VIPFloorPlanAdmin';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  getReservationsForEvent,
  createWalkInReservation,
  updateReservationStatus,
  checkInAllGuests,
  getEventTableStats,
  type TableReservation,
  type VipTable,
  BOTTLE_CHOICES,
} from '@/lib/vip-tables-admin-service';

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
  }[]>([]);
  const [stats, setStats] = useState<{
    totalTables: number;
    reservedTables: number;
    availableTables: number;
    totalRevenue: number;
    totalGuests: number;
    checkedInGuests: number;
    walkInCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Walk-in dialog state
  const [showWalkInDialog, setShowWalkInDialog] = useState(false);
  const [walkInData, setWalkInData] = useState({
    tableId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    guestCount: 4,
    bottleChoice: '',
    notes: '',
  });
  const [isCreatingWalkIn, setIsCreatingWalkIn] = useState(false);

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

  // Redirect if not owner
  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'VIP Tables management is only available to owners.',
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
      // Fetch event VIP tables directly from event_vip_tables
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
        walkInCount: 0,
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

  const handleCreateWalkIn = async () => {
    if (!selectedEventId || !user) return;

    // Validate
    if (!walkInData.tableId || !walkInData.firstName || !walkInData.lastName || !walkInData.phone) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill in all required fields',
      });
      return;
    }

    setIsCreatingWalkIn(true);
    try {
      await createWalkInReservation({
        eventId: selectedEventId,
        tableId: walkInData.tableId,
        customerFirstName: walkInData.firstName,
        customerLastName: walkInData.lastName,
        customerEmail: walkInData.email || `walkin-${Date.now()}@maguey.local`,
        customerPhone: walkInData.phone,
        guestCount: walkInData.guestCount,
        bottleChoice: walkInData.bottleChoice || undefined,
        notes: walkInData.notes || undefined,
        createdBy: user.id,
      });

      toast({
        title: 'Walk-in Created',
        description: 'VIP table reservation created successfully',
      });

      setShowWalkInDialog(false);
      setWalkInData({
        tableId: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        guestCount: 4,
        bottleChoice: '',
        notes: '',
      });
      loadReservations();
    } catch (error) {
      console.error('Error creating walk-in:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create reservation',
      });
    } finally {
      setIsCreatingWalkIn(false);
    }
  };

  const handleCheckInAll = async (reservation: TableReservation) => {
    if (!user) return;

    try {
      await checkInAllGuests(reservation.id, user.id);
      toast({
        title: 'All Guests Checked In',
        description: `${reservation.guest_count} guests checked in for ${reservation.vip_table?.table_name}`,
      });
      loadReservations();
    } catch (error) {
      console.error('Error checking in guests:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to check in guests',
      });
    }
  };

  const handleStatusChange = async (reservationId: string, status: TableReservation['status']) => {
    try {
      await updateReservationStatus(reservationId, status);
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
      pending: { className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', label: 'Pending' },
      confirmed: { className: 'bg-green-500/20 text-green-400 border-green-500/50', label: 'Confirmed' },
      cancelled: { className: 'bg-red-500/20 text-red-400 border-red-500/50', label: 'Cancelled' },
      completed: { className: 'bg-blue-500/20 text-blue-400 border-blue-500/50', label: 'Completed' },
      no_show: { className: 'bg-gray-500/20 text-gray-400 border-gray-500/50', label: 'No Show' },
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

  if (role !== 'owner') return null;

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <OwnerPortalLayout
      title="VIP Tables"
      subtitle="Manage VIP table reservations"
      description="View reservations, add walk-ins, and track arrivals"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadReservations} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowWalkInDialog(true)} disabled={availableTables.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            Add Walk-in
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Event Selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="event-select">Select Event</Label>
                <Select
                  value={selectedEventId || ''}
                  onValueChange={setSelectedEventId}
                >
                  <SelectTrigger id="event-select">
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name} - {format(new Date(event.event_date), 'MMM d, yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label htmlFor="search">Search Reservations</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Name, phone, or reservation #"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="border-primary/20">
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

            <Card className="border-green-500/20">
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

            <Card className="border-blue-500/20">
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

            <Card className="border-purple-500/20">
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

            <Card>
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

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Walk-ins</p>
                    <p className="text-2xl font-bold">{stats.walkInCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content with Tabs */}
        <Tabs defaultValue="floor-plan" className="space-y-4">
          <TabsList>
            <TabsTrigger value="floor-plan" className="gap-2">
              <Map className="w-4 h-4" />
              Floor Plan
            </TabsTrigger>
            <TabsTrigger value="reservations" className="gap-2">
              <List className="w-4 h-4" />
              Reservations ({filteredReservations.length})
            </TabsTrigger>
          </TabsList>

          {/* Floor Plan Tab */}
          <TabsContent value="floor-plan">
            <Card>
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
                    className={`gap-2 ${isEditMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-amber-500/50 text-amber-500 hover:bg-amber-500/10'}`}
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
                        readOnly={false}
                      />
                    </div>

                    {/* Edit Panel - Only show in edit mode */}
                    {isEditMode && (
                      <div className="w-72 flex-shrink-0">
                        <Card className="border-primary/20 sticky top-4">
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
            <Card>
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
                              <div className="flex items-center gap-1">
                                {getTierBadge(reservation.vip_table?.tier || 'regular')}
                                {reservation.is_walk_in && (
                                  <Badge variant="outline" className="text-xs">Walk-in</Badge>
                                )}
                              </div>
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

        {/* Walk-in Dialog */}
        <Dialog open={showWalkInDialog} onOpenChange={setShowWalkInDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Walk-in Reservation</DialogTitle>
              <DialogDescription>
                Create a VIP table reservation for a walk-in customer
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Table *</Label>
                <Select
                  value={walkInData.tableId}
                  onValueChange={(value) => setWalkInData({ ...walkInData, tableId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose available table" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.table_name} - ${table.price} ({table.guest_capacity} guests)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    value={walkInData.firstName}
                    onChange={(e) => setWalkInData({ ...walkInData, firstName: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    value={walkInData.lastName}
                    onChange={(e) => setWalkInData({ ...walkInData, lastName: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input
                  value={walkInData.phone}
                  onChange={(e) => setWalkInData({ ...walkInData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input
                  type="email"
                  value={walkInData.email}
                  onChange={(e) => setWalkInData({ ...walkInData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Number of Guests</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={walkInData.guestCount}
                  onChange={(e) =>
                    setWalkInData({ ...walkInData, guestCount: parseInt(e.target.value) || 1 })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Bottle Choice (optional)</Label>
                <Select
                  value={walkInData.bottleChoice}
                  onValueChange={(value) => setWalkInData({ ...walkInData, bottleChoice: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bottle" />
                  </SelectTrigger>
                  <SelectContent>
                    {BOTTLE_CHOICES.map((bottle) => (
                      <SelectItem key={bottle.id} value={bottle.id}>
                        {bottle.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={walkInData.notes}
                  onChange={(e) => setWalkInData({ ...walkInData, notes: e.target.value })}
                  placeholder="Any special requests or notes..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWalkInDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateWalkIn} disabled={isCreatingWalkIn}>
                {isCreatingWalkIn ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Reservation'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                Close
              </Button>
              {selectedReservation && selectedReservation.checked_in_guests < selectedReservation.guest_count && (
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
