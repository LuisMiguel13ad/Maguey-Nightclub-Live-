import { useState } from "react";
import { Music, Search, Loader2, QrCode, Calendar, MapPin, User, Ticket as TicketIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface TicketWithQR {
  id: string;
  order_id: string;
  event_id: string;
  attendee_name: string;
  attendee_email: string | null;
  qr_code_url: string | null;
  qr_token: string;
  qr_signature: string;
  status: string;
  price: number;
  fee_total: number;
  issued_at: string;
  scanned_at: string | null;
}

interface OrderWithTickets {
  id: string;
  purchaser_email: string;
  purchaser_name: string | null;
  total: number;
  status: string;
  created_at: string;
  event: {
    name: string;
    event_date: string;
    event_time: string;
    venue_name: string | null;
    venue_address: string | null;
    image_url: string | null;
  };
  tickets: TicketWithQR[];
}

const TestTicketViewer = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderWithTickets[]>([]);

  const handleSearch = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setLoading(true);
    try {
      // Fetch orders with tickets and event data
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          purchaser_email,
          purchaser_name,
          total,
          status,
          created_at,
          event_id
        `)
        .eq("purchaser_email", email.toLowerCase().trim())
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        toast.info("No orders found for this email");
        setOrders([]);
        return;
      }

      // Fetch tickets and events for each order
      const ordersWithTickets: OrderWithTickets[] = [];

      for (const order of ordersData) {
        // Fetch event
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("name, event_date, event_time, venue_name, venue_address, image_url")
          .eq("id", order.event_id)
          .single();

        if (eventError) {
          console.error("Error fetching event:", eventError);
          continue;
        }

        // Fetch tickets
        const { data: ticketsData, error: ticketsError } = await supabase
          .from("tickets")
          .select("id, order_id, event_id, attendee_name, attendee_email, qr_code_url, qr_token, qr_signature, status, price, fee_total, issued_at, scanned_at")
          .eq("order_id", order.id);

        if (ticketsError) {
          console.error("Error fetching tickets:", ticketsError);
          continue;
        }

        ordersWithTickets.push({
          ...order,
          event: eventData,
          tickets: ticketsData || [],
        });
      }

      setOrders(ordersWithTickets);
      toast.success(`Found ${ordersWithTickets.length} order(s)`);
    } catch (error) {
      console.error("Error searching orders:", error);
      toast.error("Failed to search orders");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <Music className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                MAGUEY
              </h1>
            </Link>
            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">
              🧪 Test Mode
            </Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Search Section */}
        <Card className="p-6 border-border/50 bg-card mb-8">
          <h2 className="text-2xl font-bold mb-4">
            Test Ticket <span className="bg-gradient-primary bg-clip-text text-transparent">Viewer</span>
          </h2>
          <p className="text-muted-foreground mb-6">
            Enter the email used during checkout to view purchased tickets with QR codes.
          </p>
          
          <div className="flex gap-3">
            <Input
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Orders List */}
        {orders.length > 0 && (
          <div className="space-y-8">
            {orders.map((order) => (
              <Card key={order.id} className="p-6 border-border/50 bg-card">
                {/* Order Header */}
                <div className="mb-6 pb-4 border-b border-border/50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-xl font-bold">{order.event.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Order #{order.id.slice(0, 8)}
                      </p>
                    </div>
                    <Badge className={
                      order.status === "paid" 
                        ? "bg-green-500/20 text-green-500 border-green-500/50"
                        : "bg-yellow-500/20 text-yellow-500 border-yellow-500/50"
                    }>
                      {order.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(order.event.event_date).toLocaleDateString()} • {order.event.event_time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{order.event.venue_name || "TBA"}</span>
                    </div>
                  </div>
                </div>

                {/* Tickets */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <TicketIcon className="w-5 h-5 text-primary" />
                    Tickets ({order.tickets.length})
                  </h4>

                  {order.tickets.map((ticket) => (
                    <Card key={ticket.id} className="p-4 border-border/30 bg-card/50">
                      <div className="flex flex-col md:flex-row gap-4">
                        {/* QR Code */}
                        <div className="flex-shrink-0">
                          {ticket.qr_code_url ? (
                            <div className="bg-white p-3 rounded-lg">
                              <img
                                src={ticket.qr_code_url}
                                alt="Ticket QR Code"
                                className="w-32 h-32"
                              />
                            </div>
                          ) : (
                            <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
                              <QrCode className="w-12 h-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Ticket Details */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{ticket.attendee_name}</span>
                              </div>
                              {ticket.attendee_email && (
                                <p className="text-sm text-muted-foreground ml-6">
                                  {ticket.attendee_email}
                                </p>
                              )}
                            </div>
                            <Badge className={
                              ticket.status === "scanned"
                                ? "bg-blue-500/20 text-blue-500 border-blue-500/50"
                                : ticket.status === "issued"
                                ? "bg-green-500/20 text-green-500 border-green-500/50"
                                : "bg-gray-500/20 text-gray-500 border-gray-500/50"
                            }>
                              {ticket.status}
                            </Badge>
                          </div>

                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Ticket ID: <code className="text-xs">{ticket.id.slice(0, 16)}...</code></p>
                            <p>QR Token: <code className="text-xs">{ticket.qr_token.slice(0, 24)}...</code></p>
                            <p>Price: ${ticket.price.toFixed(2)} + ${ticket.fee_total.toFixed(2)} fee</p>
                            <p>Issued: {new Date(ticket.issued_at).toLocaleString()}</p>
                            {ticket.scanned_at && (
                              <p>Scanned: {new Date(ticket.scanned_at).toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Order Total */}
                <div className="mt-4 pt-4 border-t border-border/50 text-right">
                  <p className="text-lg font-bold">
                    Total: ${order.total.toFixed(2)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && orders.length === 0 && email && (
          <Card className="p-12 border-border/50 bg-card text-center">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No orders found. Try making a test purchase first.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TestTicketViewer;

