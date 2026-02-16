import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import {
  getDashboardStats,
  type DashboardStats,
} from "@/lib/orders-service";

const DashboardHome = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: getDashboardStats,
  });

  const stats = useMemo(() => data, [data]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(4)].map((_, idx) => (
          <Skeleton key={idx} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6">
        <h2 className="text-lg font-semibold text-destructive">
          Failed to load dashboard
        </h2>
        <p className="text-sm text-destructive">
          {(error as Error)?.message ?? "Unknown error."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Quick overview of ticket sales and event performance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Active Events</p>
          <p className="mt-2 text-3xl font-semibold">{stats?.totalEvents ?? 0}</p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Orders</p>
          <p className="mt-2 text-3xl font-semibold">{stats?.totalOrders ?? 0}</p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Gross Revenue</p>
          <p className="mt-2 text-3xl font-semibold">
            ${((stats?.totalRevenue ?? 0) / 100).toFixed(2)}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Tickets Issued</p>
          <p className="mt-2 text-3xl font-semibold">
            {stats?.ticketsIssued ?? 0}
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Tickets Scanned</p>
          <p className="mt-2 text-3xl font-semibold">
            {stats?.ticketsScanned ?? 0}
          </p>
        </Card>
      </div>
    </div>
  );
};

export default DashboardHome;


