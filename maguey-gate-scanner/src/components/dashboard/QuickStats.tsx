import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Calendar, Ticket, TrendingUp } from "lucide-react";

interface QuickStatsProps {
  activeEvents: number;
  totalTicketsSold: number;
  totalTicketsScanned: number;
  conversionRate: number;
}

export function QuickStats({
  activeEvents,
  totalTicketsSold,
  totalTicketsScanned,
  conversionRate,
}: QuickStatsProps) {
  const stats = [
    {
      label: "Active Events",
      value: activeEvents,
      icon: Calendar,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Tickets Sold",
      value: totalTicketsSold.toLocaleString(),
      icon: Ticket,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Tickets Scanned",
      value: totalTicketsScanned.toLocaleString(),
      icon: Activity,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Scan Rate",
      value: `${conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <div className={`rounded-lg p-1.5 ${stat.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${stat.color}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

