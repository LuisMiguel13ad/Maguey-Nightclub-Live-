import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { Navigation } from "@/components/layout/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, User, Mail, Phone, Calendar, DollarSign, Ticket, Tag } from "lucide-react";
import { format } from "date-fns";

interface Customer {
  email: string;
  name: string | null;
  phone: string | null;
  totalOrders: number;
  totalSpent: number;
  totalTickets: number;
  firstPurchase: string | null;
  lastPurchase: string | null;
  events: string[];
  tags: string[];
}

const CustomerManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerTickets, setCustomerTickets] = useState<any[]>([]);

  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Customer management is only available to owners.",
      });
      navigate("/dashboard");
    }
  }, [role, navigate, toast]);

  useEffect(() => {
    if (role === 'owner') {
      loadCustomers();
    }
  }, [role]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCustomers(customers);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCustomers(
        customers.filter(
          (customer) =>
            customer.email.toLowerCase().includes(query) ||
            customer.name?.toLowerCase().includes(query) ||
            customer.phone?.toLowerCase().includes(query) ||
            customer.events.some((event) => event.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, customers]);

  const loadCustomers = async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Get all orders
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Get all tickets
      const { data: tickets, error: ticketsError } = await supabase
        .from("tickets")
        .select("guest_email, guest_name, guest_phone, event_name, price_paid, created_at, order_id");

      if (ticketsError) throw ticketsError;

      // Aggregate customer data
      const customerMap = new Map<string, Customer>();

      // Process orders
      orders?.forEach((order: any) => {
        const email = order.customer_email.toLowerCase();
        if (!customerMap.has(email)) {
          customerMap.set(email, {
            email: order.customer_email,
            name: order.customer_name || null,
            phone: order.customer_phone || null,
            totalOrders: 0,
            totalSpent: 0,
            totalTickets: 0,
            firstPurchase: null,
            lastPurchase: null,
            events: [],
            tags: [],
          });
        }

        const customer = customerMap.get(email)!;
        customer.totalOrders += 1;
        // orders.total is stored in cents, convert to dollars
        customer.totalSpent += Number(order.total || 0) / 100;
        customer.totalTickets += order.ticket_count || 0;

        if (order.completed_at) {
          const purchaseDate = order.completed_at;
          if (!customer.firstPurchase || purchaseDate < customer.firstPurchase) {
            customer.firstPurchase = purchaseDate;
          }
          if (!customer.lastPurchase || purchaseDate > customer.lastPurchase) {
            customer.lastPurchase = purchaseDate;
          }
        }

        if (order.event_name && !customer.events.includes(order.event_name)) {
          customer.events.push(order.event_name);
        }
      });

      // Process tickets
      tickets?.forEach((ticket: any) => {
        if (ticket.guest_email) {
          const email = ticket.guest_email.toLowerCase();
          if (!customerMap.has(email)) {
            customerMap.set(email, {
              email: ticket.guest_email,
              name: ticket.guest_name || null,
              phone: ticket.guest_phone || null,
              totalOrders: 0,
              totalSpent: 0,
              totalTickets: 0,
              firstPurchase: null,
              lastPurchase: null,
              events: [],
              tags: [],
            });
          }

          const customer = customerMap.get(email)!;
          customer.totalTickets += 1;
          if (ticket.price_paid) {
            customer.totalSpent += parseFloat(ticket.price_paid);
          }

          if (ticket.created_at) {
            const purchaseDate = ticket.created_at;
            if (!customer.firstPurchase || purchaseDate < customer.firstPurchase) {
              customer.firstPurchase = purchaseDate;
            }
            if (!customer.lastPurchase || purchaseDate > customer.lastPurchase) {
              customer.lastPurchase = purchaseDate;
            }
          }

          if (ticket.event_name && !customer.events.includes(ticket.event_name)) {
            customer.events.push(ticket.event_name);
          }
        }
      });

      // Add tags based on spending
      customerMap.forEach((customer) => {
        if (customer.totalSpent >= 500) {
          customer.tags.push("VIP");
        }
        if (customer.totalOrders >= 5) {
          customer.tags.push("Regular");
        }
        if (customer.events.length >= 3) {
          customer.tags.push("Multi-Event");
        }
      });

      const customerList = Array.from(customerMap.values()).sort(
        (a, b) => b.totalSpent - a.totalSpent
      );

      setCustomers(customerList);
      setFilteredCustomers(customerList);
    } catch (error: any) {
      console.error("Error loading customers:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load customers",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomerDetails = async (customer: Customer) => {
    if (!isSupabaseConfigured()) return;

    try {
      const [ordersResult, ticketsResult] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .eq("customer_email", customer.email)
          .order("completed_at", { ascending: false }),
        supabase
          .from("tickets")
          .select("*")
          .eq("guest_email", customer.email)
          .order("created_at", { ascending: false }),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (ticketsResult.error) throw ticketsResult.error;

      setCustomerOrders(ordersResult.data || []);
      setCustomerTickets(ticketsResult.data || []);
      setSelectedCustomer(customer);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load customer details",
      });
    }
  };

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  if (role !== 'owner') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Customer Database</h1>
            <p className="text-muted-foreground mt-1">
              Manage and search your customer base
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, name, phone, or event..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customer List */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading customers...
            </CardContent>
          </Card>
        ) : filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {searchQuery ? "No customers found matching your search." : "No customers yet."}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                Customers ({filteredCustomers.length})
              </CardTitle>
              <CardDescription>
                Sorted by total spending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Tickets</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Last Purchase</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.email}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">
                                {customer.name || "No name"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {customer.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            {customer.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {customer.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{customer.totalOrders}</TableCell>
                        <TableCell>{customer.totalTickets}</TableCell>
                        <TableCell className="font-semibold">
                          {currencyFormatter.format(customer.totalSpent)}
                        </TableCell>
                        <TableCell>
                          {customer.lastPurchase
                            ? format(new Date(customer.lastPurchase), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {customer.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadCustomerDetails(customer)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Customer Details Dialog */}
        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCustomer?.name || "Customer"} Details
              </DialogTitle>
              <DialogDescription>
                {selectedCustomer?.email}
              </DialogDescription>
            </DialogHeader>

            {selectedCustomer && (
              <div className="space-y-6">
                {/* Customer Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total Orders</div>
                      <div className="text-2xl font-bold">{selectedCustomer.totalOrders}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total Tickets</div>
                      <div className="text-2xl font-bold">{selectedCustomer.totalTickets}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total Spent</div>
                      <div className="text-2xl font-bold">
                        {currencyFormatter.format(selectedCustomer.totalSpent)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Events Attended</div>
                      <div className="text-2xl font-bold">{selectedCustomer.events.length}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Orders */}
                <div>
                  <h3 className="font-semibold mb-3">Order History</h3>
                  {customerOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No orders found</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Tickets</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerOrders.map((order: any) => (
                            <TableRow key={order.id}>
                              <TableCell>
                                {order.completed_at
                                  ? format(new Date(order.completed_at), "MMM d, yyyy")
                                  : "-"}
                              </TableCell>
                              <TableCell>{order.event_name}</TableCell>
                              <TableCell>{order.ticket_count}</TableCell>
                              <TableCell>
                                {currencyFormatter.format(Number(order.total || 0) / 100)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    order.status === "completed"
                                      ? "default"
                                      : order.status === "refunded"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {order.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Tickets */}
                <div>
                  <h3 className="font-semibold mb-3">Ticket History</h3>
                  {customerTickets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tickets found</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ticket ID</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Scanned At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerTickets.slice(0, 20).map((ticket: any) => (
                            <TableRow key={ticket.id}>
                              <TableCell className="font-mono text-xs">
                                {ticket.ticket_id}
                              </TableCell>
                              <TableCell>{ticket.event_name}</TableCell>
                              <TableCell>{ticket.ticket_type}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    ticket.is_used || ticket.status === "scanned"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {ticket.is_used || ticket.status === "scanned"
                                    ? "Scanned"
                                    : "Active"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {ticket.scanned_at
                                  ? format(new Date(ticket.scanned_at), "MMM d, h:mm a")
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CustomerManagement;

