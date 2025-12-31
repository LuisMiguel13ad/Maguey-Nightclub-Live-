/**
 * Orders Page
 * View all ticket purchases and orders with search, filters, and real-time updates
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth, useRole } from "@/contexts/AuthContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart,
  Search,
  RefreshCw,
  Eye,
  Download,
  Calendar,
  DollarSign,
  Ticket,
  User,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  Loader2,
  Filter,
} from "lucide-react";
import { format, subDays, parseISO } from "date-fns";

interface Order {
  id: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  event_id: string | null;
  event_name: string | null;
  ticket_type: string | null;
  ticket_count: number;
  total: number;
  status: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  completed_at: string | null;
  tickets?: Array<{
    id: string;
    ticket_id: string;
    status: string;
    scanned_at: string | null;
  }>;
}

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  totalTickets: number;
  completedOrders: number;
  pendingOrders: number;
}

const Orders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();

  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([]);
  const [stats, setStats] = useState<OrderStats>({
    totalOrders: 0,
    totalRevenue: 0,
    totalTickets: 0,
    completedOrders: 0,
    pendingOrders: 0,
  });

  // Order detail dialog
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Redirect employees
  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Orders management is only available to owners.",
      });
      navigate("/scanner");
    }
  }, [role, navigate, toast]);

  // Load orders
  useEffect(() => {
    if (role === 'owner') {
      loadOrders();
      loadEvents();
      setupRealtimeSubscription();
    }
  }, [role]);

  // Filter orders when filters change
  useEffect(() => {
    filterOrders();
  }, [orders, searchQuery, statusFilter, eventFilter, dateFilter]);

  const setupRealtimeSubscription = () => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as Order;
            setOrders(prev => [newOrder, ...prev]);
            toast({
              title: "New Order",
              description: `Order from ${newOrder.customer_email}`,
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = payload.new as Order;
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadOrders = async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      setOrders(data || []);
      calculateStats(data || []);
    } catch (error: any) {
      console.error("Error loading orders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load orders",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadEvents = async () => {
    if (!isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name')
        .order('event_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error loading events:", error);
    }
  };

  const calculateStats = (orderList: Order[]) => {
    const completed = orderList.filter(o => o.status === 'completed' || o.status === 'paid');
    const pending = orderList.filter(o => o.status === 'pending');

    setStats({
      totalOrders: orderList.length,
      totalRevenue: completed.reduce((sum, o) => sum + (Number(o.total) || 0), 0) / 100,
      totalTickets: orderList.reduce((sum, o) => sum + (o.ticket_count || 0), 0),
      completedOrders: completed.length,
      pendingOrders: pending.length,
    });
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.customer_email?.toLowerCase().includes(query) ||
        o.customer_name?.toLowerCase().includes(query) ||
        o.customer_phone?.includes(query) ||
        o.id.toLowerCase().includes(query) ||
        o.event_name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    // Event filter
    if (eventFilter !== 'all') {
      filtered = filtered.filter(o => o.event_id === eventFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = subDays(now, 7);
          break;
        case 'month':
          startDate = subDays(now, 30);
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter(o => new Date(o.created_at) >= startDate);
    }

    setFilteredOrders(filtered);
  };

  const loadOrderTickets = async (orderId: string) => {
    if (!isSupabaseConfigured()) return;

    setLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, ticket_id, status, scanned_at')
        .eq('order_id', orderId);

      if (error) throw error;

      if (selectedOrder) {
        setSelectedOrder({
          ...selectedOrder,
          tickets: data || [],
        });
      }
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailDialog(true);
    loadOrderTickets(order.id);
  };

  const exportOrders = () => {
    const csvContent = [
      ['Order ID', 'Customer Email', 'Customer Name', 'Event', 'Tickets', 'Total', 'Status', 'Date'].join(','),
      ...filteredOrders.map(o => [
        o.id,
        o.customer_email,
        o.customer_name || '',
        o.event_name || '',
        o.ticket_count,
        (Number(o.total) / 100).toFixed(2),
        o.status,
        format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${filteredOrders.length} orders to CSV`,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; icon: React.ReactNode }> = {
      completed: { className: 'bg-green-500/20 text-green-400 border-green-500/50', icon: <CheckCircle2 className="h-3 w-3" /> },
      paid: { className: 'bg-green-500/20 text-green-400 border-green-500/50', icon: <CheckCircle2 className="h-3 w-3" /> },
      pending: { className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', icon: <Clock className="h-3 w-3" /> },
      failed: { className: 'bg-red-500/20 text-red-400 border-red-500/50', icon: <XCircle className="h-3 w-3" /> },
      refunded: { className: 'bg-purple-500/20 text-purple-400 border-purple-500/50', icon: <AlertCircle className="h-3 w-3" /> },
    };
    const variant = variants[status] || { className: 'bg-gray-500/20 text-gray-400', icon: null };
    return (
      <Badge className={`${variant.className} flex items-center gap-1`}>
        {variant.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (role !== 'owner') return null;

  return (
    <OwnerPortalLayout
      title="Orders"
      subtitle="SALES"
      description="View and manage all ticket purchases"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadOrders} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportOrders} disabled={filteredOrders.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{stats.totalOrders}</p>
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
                <Ticket className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Tickets Sold</p>
                  <p className="text-2xl font-bold">{stats.totalTickets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completedOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats.pendingOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Email, name, phone, or order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Event</Label>
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Date Range</Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Orders
              <Badge variant="outline" className="ml-2">
                {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
              </Badge>
            </CardTitle>
            <CardDescription>
              {searchQuery || statusFilter !== 'all' || eventFilter !== 'all' || dateFilter !== 'all'
                ? 'Filtered results'
                : 'All ticket purchases and orders'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No orders found</p>
                <p className="text-sm">
                  {searchQuery || statusFilter !== 'all' || eventFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Orders will appear here as customers make purchases'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Tickets</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <p className="font-mono text-xs">{order.id.slice(0, 8)}...</p>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.customer_name || 'Guest'}</p>
                            <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{order.event_name || '-'}</p>
                          {order.ticket_type && (
                            <p className="text-xs text-muted-foreground">{order.ticket_type}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Ticket className="h-4 w-4 text-muted-foreground" />
                            <span>{order.ticket_count}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-green-500">
                            ${(Number(order.total) / 100).toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>
                          <p className="text-sm">{format(new Date(order.created_at), 'MMM d, yyyy')}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), 'h:mm a')}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewOrder(order)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Order Details
              </DialogTitle>
              <DialogDescription>
                Order ID: {selectedOrder?.id}
              </DialogDescription>
            </DialogHeader>

            {selectedOrder && (
              <div className="space-y-6">
                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Name:</span> {selectedOrder.customer_name || 'Guest'}</p>
                      <p className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {selectedOrder.customer_email}
                      </p>
                      {selectedOrder.customer_phone && (
                        <p className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {selectedOrder.customer_phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment Details
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Status:</span> {getStatusBadge(selectedOrder.status)}</p>
                      <p><span className="text-muted-foreground">Total:</span> <span className="font-bold text-green-500">${(Number(selectedOrder.total) / 100).toFixed(2)}</span></p>
                      {selectedOrder.stripe_payment_intent_id && (
                        <p className="text-xs font-mono text-muted-foreground">
                          Stripe: {selectedOrder.stripe_payment_intent_id.slice(0, 20)}...
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Event Info */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4" />
                    Event Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <p><span className="text-muted-foreground">Event:</span> {selectedOrder.event_name || '-'}</p>
                    <p><span className="text-muted-foreground">Ticket Type:</span> {selectedOrder.ticket_type || '-'}</p>
                    <p><span className="text-muted-foreground">Quantity:</span> {selectedOrder.ticket_count}</p>
                    <p><span className="text-muted-foreground">Order Date:</span> {format(new Date(selectedOrder.created_at), 'PPP p')}</p>
                  </div>
                </div>

                {/* Tickets */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <Ticket className="h-4 w-4" />
                    Tickets ({selectedOrder.ticket_count})
                  </h4>
                  {loadingTickets ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : selectedOrder.tickets && selectedOrder.tickets.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedOrder.tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className={`p-2 rounded border text-sm ${
                            ticket.scanned_at
                              ? 'bg-green-500/10 border-green-500/30'
                              : 'bg-muted/50'
                          }`}
                        >
                          <p className="font-mono text-xs">{ticket.ticket_id.slice(0, 12)}...</p>
                          <Badge
                            className={
                              ticket.scanned_at
                                ? 'bg-green-500/20 text-green-400 mt-1'
                                : 'mt-1'
                            }
                          >
                            {ticket.scanned_at ? 'Scanned' : ticket.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No tickets found for this order</p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </OwnerPortalLayout>
  );
};

export default Orders;
