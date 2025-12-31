import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  resendTicket,
  requestRefund,
  getOrders,
  type OrdersQueryOptions,
  type AdminOrderRow,
} from "@/lib/orders-service";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const OrdersList = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const {
    data: orders,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin-orders", statusFilter],
    queryFn: () =>
      getOrders({
        limit: 50,
        status: statusFilter,
      } as OrdersQueryOptions),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Orders</h1>
        </div>
        {[...Array(4)].map((_, idx) => (
          <Skeleton key={idx} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-6 border-destructive/50 bg-destructive/10">
        <h2 className="text-lg font-semibold text-destructive">
          Failed to load orders
        </h2>
        <p className="text-sm text-destructive">
          {(error as Error)?.message ?? "Unknown error"}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-muted-foreground">
            Recent purchases and their current status.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button variant="outline" className="w-full sm:w-auto">
            Export CSV
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {orders?.map((order) => (
          <Card
            key={order.id}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4"
          >
            <div>
              <p className="text-sm text-muted-foreground">
                Order ID: <span className="font-mono">{order.id}</span>
              </p>
              <p className="text-base font-medium">
                {order.purchaser_name || "Guest"} · {order.purchaser_email}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(order.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>

              <div className="flex flex-col md:items-end gap-3">
              <Badge
                className="shrink-0"
                variant={
                  order.status === "paid"
                    ? "default"
                    : order.status === "refunded"
                    ? "destructive"
                    : "secondary"
                }
              >
                {order.status.toUpperCase()}
              </Badge>
              <OrderActions order={order} />
            </div>
          </Card>
        ))}

        {orders && orders.length === 0 && (
          <Card className="p-6 text-center text-muted-foreground">
            No orders yet. Once tickets are purchased, they will appear here.
          </Card>
        )}
      </div>
    </div>
  );
};

export default OrdersList;

function OrderActions({ order }: { order: AdminOrderRow }) {
  const queryClient = useQueryClient();
  const [resendOpen, setResendOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);

  const handleResend = async () => {
    setIsResending(true);
    try {
      await resendTicket(order.id);
      toast.success("Ticket email has been resent.");
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      setResendOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to resend tickets.";
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  const handleRefund = async () => {
    setIsRefunding(true);
    try {
      await requestRefund(order.id);
      toast.success("Refund workflow requested.");
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      setRefundOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to request refund.";
      toast.error(message);
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <div className="text-right space-y-3">
      <p className="text-xl font-semibold">
        ${(order.total / 100).toFixed(2)}
      </p>
      <div className="flex gap-2 justify-end">
        <Dialog open={resendOpen} onOpenChange={setResendOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              Resend Tickets
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resend tickets?</DialogTitle>
              <DialogDescription>
                This will trigger the ticket email workflow again for order{" "}
                <span className="font-mono">{order.id}</span>.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setResendOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleResend} disabled={isResending}>
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Confirm resend"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-destructive">
              Mark Refunded
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark order as refunded?</DialogTitle>
              <DialogDescription>
                This will mark the order as refunded and should trigger a Stripe
                refund in a future iteration.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRefundOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-destructive"
                onClick={handleRefund}
                disabled={isRefunding}
              >
                {isRefunding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Confirm refund"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


