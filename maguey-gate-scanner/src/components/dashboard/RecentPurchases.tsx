import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ShoppingCart, TrendingUp } from "lucide-react";

interface Order {
  id: string;
  customer_email: string;
  customer_name: string | null;
  event_name: string;
  ticket_type: string;
  ticket_count: number;
  total: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface RecentPurchasesProps {
  orders: Order[];
  currencyFormatter: Intl.NumberFormat;
}

export const RecentPurchases = ({ orders, currencyFormatter }: RecentPurchasesProps) => {
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">Pending</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400">Failed</Badge>;
      case "refunded":
        return <Badge className="bg-gray-500/10 text-gray-700 dark:text-gray-400">Refunded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] shadow-[0_45px_90px_rgba(3,7,23,0.7)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Recent Ticket Purchases
            </CardTitle>
            <CardDescription className="mt-1">
              Latest ticket sales and customer orders
            </CardDescription>
          </div>
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No recent purchases</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Ticket Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const orderDate = order.completed_at || order.created_at;
                  const date = new Date(orderDate);
                  
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {order.customer_name || order.customer_email.split("@")[0]}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {order.customer_email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{order.event_name}</TableCell>
                      <TableCell>{order.ticket_type}</TableCell>
                      <TableCell className="text-right">{order.ticket_count}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {currencyFormatter.format(order.total)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(date, "MMM d, yyyy")}
                        <br />
                        <span className="text-xs">{format(date, "h:mm a")}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

