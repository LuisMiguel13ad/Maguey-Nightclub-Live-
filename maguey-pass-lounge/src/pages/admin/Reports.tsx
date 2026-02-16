import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import {
  getOrderSummary,
  getOrderReportRows,
  type OrderSummary,
  type OrderReportRow,
} from "@/lib/orders-service";
import { toCsv, downloadCsv } from "@/lib/csv";

type RangePreset = "30d" | "7d" | "all";

const mockSummary: OrderSummary = {
  totalOrders: 8,
  totalRevenue: 3425,
  totalTicketsIssued: 112,
  totalTicketsScanned: 76,
};

const mockRows: OrderReportRow[] = [
  {
    orderId: "mock-1",
    purchaserName: "Jane Doe",
    purchaserEmail: "jane@example.com",
    total: 180,
    status: "paid",
    created_at: new Date().toISOString(),
    ticketCount: 3,
  },
  {
    orderId: "mock-2",
    purchaserName: "Alex Rivera",
    purchaserEmail: "alex@example.com",
    total: 520,
    status: "paid",
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    ticketCount: 6,
  },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatCurrency = (value: number) => currency.format(value);

const Reports = () => {
  const [preset, setPreset] = useState<RangePreset>("30d");

  const summaryRange = useMemo(() => {
    if (preset === "all" || !preset) return {};
    if (preset === "7d") {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 7);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    if (preset === "30d") {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 30);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    return {};
  }, [preset]);

  const summaryQuery = useQuery({
    queryKey: ["admin-reports-summary", summaryRange],
    queryFn: () => getOrderSummary(summaryRange),
    staleTime: 60_000,
    retry: false,
  });

  const ordersQuery = useQuery({
    queryKey: ["admin-reports-orders", summaryRange],
    queryFn: () => getOrderReportRows(summaryRange),
    staleTime: 60_000,
    retry: false,
  });

  const summary = summaryQuery.isSuccess && summaryQuery.data
    ? summaryQuery.data
    : mockSummary;

  const rows =
    ordersQuery.isSuccess && ordersQuery.data && ordersQuery.data.length
      ? ordersQuery.data
      : mockRows;

  const isLoading = summaryQuery.isLoading || ordersQuery.isLoading;

  const handleDownloadCsv = () => {
    const csv = toCsv(rows, [
      { key: "orderId", header: "Order ID" },
      { key: "purchaserName", header: "Purchaser Name" },
      { key: "purchaserEmail", header: "Email" },
      {
        key: "total",
        header: "Total",
        format: (val) => formatCurrency(Number(val ?? 0)),
      },
      { key: "status", header: "Status" },
      {
        key: "created_at",
        header: "Created At",
        format: (val) => new Date(val).toLocaleString(),
      },
      { key: "ticketCount", header: "Tickets" },
    ]);
    downloadCsv(csv, "maguey-sales-report.csv");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Reports</h1>
          <p className="text-muted-foreground">
            Monitor ticket revenue and download summaries.{" "}
            <span className="italic">
              TODO: Replace mock data when Supabase analytics tables are ready.
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={preset === "7d" ? "default" : "outline"}
            onClick={() => setPreset("7d")}
          >
            Last 7 days
          </Button>
          <Button
            variant={preset === "30d" ? "default" : "outline"}
            onClick={() => setPreset("30d")}
          >
            Last 30 days
          </Button>
          <Button
            variant={preset === "all" ? "default" : "outline"}
            onClick={() => setPreset("all")}
          >
            All time
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total Orders"
          value={summary.totalOrders.toLocaleString()}
        />
        <SummaryCard
          label="Ticket Revenue"
          value={formatCurrency(summary.totalRevenue)}
        />
        <SummaryCard
          label="Tickets Issued"
          value={summary.totalTicketsIssued.toLocaleString()}
        />
        <SummaryCard
          label="Tickets Scanned"
          value={summary.totalTicketsScanned.toLocaleString()}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Orders & Tickets</CardTitle>
            <p className="text-sm text-muted-foreground">
              Join of orders and issued tickets (limited to latest 100).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled>
              Custom range (coming soon)
            </Button>
            <Button onClick={handleDownloadCsv} disabled={!rows.length}>
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-muted border-t border-muted">
                <thead className="bg-muted/40 text-left text-sm uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order ID</th>
                    <th className="px-4 py-3 font-medium">Purchaser</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Tickets</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted text-sm">
                  {rows.map((row) => (
                    <tr key={row.orderId} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">
                        {row.orderId.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3">{row.purchaserName ?? "—"}</td>
                      <td className="px-4 py-3">{row.purchaserEmail ?? "—"}</td>
                      <td className="px-4 py-3">{formatCurrency(row.total)}</td>
                      <td className="px-4 py-3">{row.ticketCount}</td>
                      <td className="px-4 py-3 capitalize">{row.status}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const SummaryCard = ({ label, value }: { label: string; value: string }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {label}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
    </CardContent>
  </Card>
);

export default Reports;

