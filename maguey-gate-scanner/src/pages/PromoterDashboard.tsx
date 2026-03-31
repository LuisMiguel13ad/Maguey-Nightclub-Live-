import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Link2,
  Copy,
  Check,
  TrendingUp,
  Ticket,
  DollarSign,
  Calendar,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

interface ReferralOrder {
  id: string;
  event_id: string;
  purchaser_name: string;
  purchaser_email: string;
  total: number;
  status: string;
  created_at: string;
  event_name?: string;
}

interface EventBreakdown {
  event_id: string;
  event_name: string;
  order_count: number;
  revenue: number;
}

const PromoterDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ReferralOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // A promoter's referral code is their user UUID
  const referralCode = user?.id || "";

  const purchaseBaseUrl =
    import.meta.env.VITE_PURCHASE_SITE_URL ||
    (import.meta.env.DEV ? "http://localhost:3016" : "https://tickets.magueynightclub.com");

  const referralLink = `${purchaseBaseUrl}/events?ref=${referralCode}`;

  const loadReferralOrders = async () => {
    if (!referralCode || !isSupabaseConfigured()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          event_id,
          purchaser_name,
          purchaser_email,
          total,
          status,
          created_at,
          events (name)
        `)
        .eq("referral_code", referralCode)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched: ReferralOrder[] = (data || []).map((o: any) => ({
        id: o.id,
        event_id: o.event_id,
        purchaser_name: o.purchaser_name,
        purchaser_email: o.purchaser_email,
        total: o.total,
        status: o.status,
        created_at: o.created_at,
        event_name: o.events?.name || "—",
      }));

      setOrders(enriched);
    } catch (err) {
      console.error("Failed to load referral orders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReferralOrders();
  }, [referralCode]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({ title: "Copied!", description: "Referral link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  // Compute stats
  const completedOrders = orders.filter((o) => o.status === "completed" || o.status === "paid");
  const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrders = completedOrders.length;

  // Per-event breakdown
  const eventBreakdown = completedOrders.reduce<Record<string, EventBreakdown>>((acc, o) => {
    const key = o.event_id;
    if (!acc[key]) {
      acc[key] = { event_id: key, event_name: o.event_name || "—", order_count: 0, revenue: 0 };
    }
    acc[key].order_count += 1;
    acc[key].revenue += o.total || 0;
    return acc;
  }, {});
  const breakdownList = Object.values(eventBreakdown).sort((a, b) => b.revenue - a.revenue);

  return (
    <OwnerPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">My Referral Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">
              Share your unique link. Earn credit for every sale you drive.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadReferralOrders}
            disabled={isLoading}
            className="border-white/20 text-gray-300 hover:bg-white/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Referral Link Card */}
        <Card className="bg-gradient-to-br from-indigo-900/40 to-purple-900/30 border-indigo-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-indigo-400" />
              Your Referral Link
            </CardTitle>
            <CardDescription className="text-gray-400">
              Share this link on social media, group chats, or anywhere you promote events.
              All ticket sales traced back to your link will appear below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-black/30 border border-white/10 rounded px-3 py-2 text-indigo-300 break-all">
                {referralLink}
              </code>
              <Button
                size="sm"
                onClick={handleCopyLink}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="shrink-0 border-white/20 text-gray-300 hover:bg-white/10"
              >
                <a href={referralLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              The link takes customers to the events page pre-tagged with your promoter ID.
              It works even if they navigate to a specific event from there.
            </p>
          </CardContent>
        </Card>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Revenue Driven</p>
                  <p className="text-2xl font-bold text-white">
                    ${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Ticket className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Completed Orders</p>
                  <p className="text-2xl font-bold text-white">{totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Calendar className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Events Promoted</p>
                  <p className="text-2xl font-bold text-white">{breakdownList.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Per-Event Breakdown */}
        {breakdownList.length > 0 && (
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
                Sales by Event
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-gray-400">Event</TableHead>
                    <TableHead className="text-gray-400 text-right">Orders</TableHead>
                    <TableHead className="text-gray-400 text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdownList.map((ev) => (
                    <TableRow key={ev.event_id} className="border-white/10">
                      <TableCell className="text-white font-medium">{ev.event_name}</TableCell>
                      <TableCell className="text-gray-300 text-right">{ev.order_count}</TableCell>
                      <TableCell className="text-green-400 text-right font-mono">
                        ${ev.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* All Attributed Orders */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Attributed Orders</CardTitle>
            <CardDescription className="text-gray-400">
              All orders (any status) placed via your referral link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-gray-500">Loading...</div>
            ) : orders.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                No orders attributed to your link yet. Start sharing!
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-gray-400">Date</TableHead>
                    <TableHead className="text-gray-400">Event</TableHead>
                    <TableHead className="text-gray-400">Customer</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="border-white/10">
                      <TableCell className="text-gray-400 text-sm">
                        {format(new Date(order.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-white text-sm">{order.event_name}</TableCell>
                      <TableCell className="text-gray-300 text-sm">{order.purchaser_name}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            order.status === "completed" || order.status === "paid"
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : order.status === "pending"
                              ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                              : "bg-red-500/20 text-red-400 border-red-500/30"
                          }
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-300">
                        ${(order.total || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </OwnerPortalLayout>
  );
};

export default PromoterDashboard;
