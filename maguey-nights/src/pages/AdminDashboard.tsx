import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Filter, 
  Download, 
  Mail, 
  Eye, 
  Edit, 
  Trash2, 
  DollarSign, 
  Users, 
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { fetchOrders, fetchStats, updateOrderStatus, type Order as SupabaseOrder, type EventStats } from '@/services/adminService';
import { toast } from '@/hooks/use-toast';

interface Order {
  id: string;
  orderId: string;
  event: {
    artist: string;
    date: string;
    time: string;
    venue: string;
  };
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  tickets: {[key: string]: number};
  tables: {[key: string]: number};
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded' | 'paid';
  paymentStatus: 'pending' | 'succeeded' | 'failed' | 'refunded';
  createdAt: string;
  updatedAt: string;
  paymentIntentId?: string;
}

const AdminDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, statusFilter, dateFilter]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([fetchOrdersData(), fetchStatsData()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data. Please refresh the page.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrdersData = async () => {
    try {
      const supabaseOrders = await fetchOrders();
      
      // Transform Supabase orders to display format
      const transformedOrders: Order[] = supabaseOrders.map(order => {
        const eventDate = order.events?.event_date 
          ? new Date(order.events.event_date).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              weekday: 'short' 
            }).toUpperCase()
          : 'TBD';
        
        const eventTime = order.events?.event_time 
          ? new Date(`2000-01-01T${order.events.event_time}`).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit'
            })
          : 'TBD';

        // Count tickets by type
        const ticketCounts: {[key: string]: number} = {};
        order.tickets?.forEach(ticket => {
          const type = ticket.ticket_type || 'general';
          ticketCounts[type] = (ticketCounts[type] || 0) + 1;
        });

        // Parse customer name
        const nameParts = (order.purchaser_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        return {
          id: order.id,
          orderId: order.payment_reference || order.id.substring(0, 8).toUpperCase(),
          event: {
            artist: order.events?.name || 'Unknown Event',
            date: eventDate,
            time: eventTime,
            venue: order.events?.venue_name || 'MAGUEY DELAWARE'
          },
          customer: {
            firstName,
            lastName,
            email: order.purchaser_email,
            phone: '' // Not stored in orders table
          },
          tickets: ticketCounts,
          tables: {}, // Not stored in current schema
          subtotal: Number(order.subtotal || 0),
          tax: Number(order.fees_total || 0),
          total: Number(order.total || 0),
          status: (order.status === 'paid' ? 'completed' : order.status) as Order['status'],
          paymentStatus: (order.status === 'paid' ? 'succeeded' : order.status) as Order['paymentStatus'],
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          paymentIntentId: order.payment_reference || undefined
        };
      });

      setOrders(transformedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  };

  const fetchStatsData = async () => {
    try {
      const statsData = await fetchStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  };

  const filterOrders = () => {
    let filtered = orders;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.event.artist.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(order => new Date(order.createdAt) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(order => new Date(order.createdAt) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(order => new Date(order.createdAt) >= filterDate);
          break;
      }
    }

    setFilteredOrders(filtered);
  };

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    try {
      // Map display status to database status
      const dbStatus = newStatus === 'completed' ? 'paid' : newStatus;
      
      const success = await updateOrderStatus(orderId, dbStatus);
      
      if (success) {
        // Update local state
        setOrders(prev => prev.map(order => 
          order.id === orderId 
            ? { ...order, status: newStatus, updatedAt: new Date().toISOString() }
            : order
        ));

        toast({
          title: 'Success',
          description: `Order status updated to ${newStatus}`,
        });

        // If cancelling, process refund
        if (newStatus === 'cancelled') {
          await processRefund(orderId);
        }
      } else {
        throw new Error('Failed to update order status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update order status. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const processRefund = async (_orderId: string) => {
    try {
      // TODO: Implement Stripe refund API call
      toast({
        title: 'Refund Processing',
        description: 'Refund request has been submitted. This will be processed shortly.',
      });
    } catch (error) {
      console.error('Error processing refund:', error);
      toast({
        title: 'Error',
        description: 'Failed to process refund. Please contact support.',
        variant: 'destructive'
      });
    }
  };

  const exportOrders = () => {
    const csvContent = [
      ['Order ID', 'Customer', 'Email', 'Event', 'Date', 'Total', 'Status', 'Created'],
      ...filteredOrders.map(order => [
        order.orderId,
        `${order.customer.firstName} ${order.customer.lastName}`,
        order.customer.email,
        order.event.artist,
        order.event.date,
        `$${order.total.toFixed(2)}`,
        order.status,
        new Date(order.createdAt).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getStatusBadge = (status: Order['status']) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-500', icon: Clock },
      completed: { color: 'bg-green-500', icon: CheckCircle },
      cancelled: { color: 'bg-red-500', icon: AlertCircle },
      refunded: { color: 'bg-gray-500', icon: DollarSign }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#39B54A] mx-auto mb-4" />
          <div className="text-white text-xl">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <div className="text-white text-xl mb-4">Error loading dashboard</div>
          <div className="text-gray-400 mb-4">{error}</div>
          <Button onClick={loadData} className="bg-[#39B54A] hover:bg-[#39B54A]/90">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      
      <div className="pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
            <p className="text-gray-400">Manage orders, events, and analytics</p>
          </motion.div>

          {/* Stats Cards */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
            >
              <Card className="bg-gray-900 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Orders</p>
                      <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Revenue</p>
                      <p className="text-2xl font-bold text-white">${stats.totalRevenue.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Tickets</p>
                      <p className="text-2xl font-bold text-white">{stats.totalTickets}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Avg Order Value</p>
                      <p className="text-2xl font-bold text-white">${stats.averageOrderValue.toFixed(2)}</p>
                    </div>
                    <Calendar className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Tabs defaultValue="orders" className="space-y-6">
              <TabsList className="bg-gray-900 border-gray-700">
                <TabsTrigger value="orders" className="text-white">Orders</TabsTrigger>
                <TabsTrigger value="analytics" className="text-white">Analytics</TabsTrigger>
                <TabsTrigger value="settings" className="text-white">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="orders" className="space-y-6">
                {/* Filters */}
                <Card className="bg-gray-900 border-gray-700">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <Label htmlFor="search" className="text-white">Search Orders</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input
                            id="search"
                            placeholder="Search by order ID, customer name, or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-gray-800 border-gray-600 text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="status" className="text-white">Status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-40 bg-gray-800 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="date" className="text-white">Date Range</Label>
                        <Select value={dateFilter} onValueChange={setDateFilter}>
                          <SelectTrigger className="w-40 bg-gray-800 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="week">This Week</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button onClick={exportOrders} variant="outline" className="border-gray-600 text-white hover:bg-gray-800">
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Orders Table */}
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Orders ({filteredOrders.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="text-left text-white py-3 px-4">Order ID</th>
                            <th className="text-left text-white py-3 px-4">Customer</th>
                            <th className="text-left text-white py-3 px-4">Event</th>
                            <th className="text-left text-white py-3 px-4">Total</th>
                            <th className="text-left text-white py-3 px-4">Status</th>
                            <th className="text-left text-white py-3 px-4">Date</th>
                            <th className="text-left text-white py-3 px-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.map((order) => (
                            <tr key={order.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                              <td className="py-3 px-4 text-white font-mono text-sm">{order.orderId}</td>
                              <td className="py-3 px-4 text-white">
                                <div>
                                  <div className="font-medium">{order.customer.firstName} {order.customer.lastName}</div>
                                  <div className="text-gray-400 text-sm">{order.customer.email}</div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-white">
                                <div>
                                  <div className="font-medium">{order.event.artist}</div>
                                  <div className="text-gray-400 text-sm">{order.event.date}</div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-white font-bold">${order.total.toFixed(2)}</td>
                              <td className="py-3 px-4">{getStatusBadge(order.status)}</td>
                              <td className="py-3 px-4 text-white text-sm">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedOrder(order)}
                                    className="border-gray-600 text-white hover:bg-gray-800"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-gray-600 text-white hover:bg-gray-800"
                                  >
                                    <Mail className="w-4 h-4" />
                                  </Button>
                                  <Select
                                    value={order.status}
                                    onValueChange={(value) => handleStatusChange(order.id, value as Order['status'])}
                                  >
                                    <SelectTrigger className="w-32 h-8 bg-gray-800 border-gray-600 text-white text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                      <SelectItem value="cancelled">Cancelled</SelectItem>
                                      <SelectItem value="refunded">Refunded</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics">
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Analytics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400">Analytics dashboard coming soon...</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings">
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400">Settings panel coming soon...</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
