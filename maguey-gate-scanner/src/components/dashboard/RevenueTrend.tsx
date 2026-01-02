import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";

interface RevenueTrendPoint {
  date: string;
  label: string;
  revenue: number;
  tickets: number;
}

interface RevenueTrendProps {
  data: RevenueTrendPoint[];
  trendDelta: number;
  caption?: string;
  revenueLabel: string;
  revenueTotal: string;
  ticketsLabel?: string;
  ticketsTotal?: string;
}

export const RevenueTrend = ({
  data,
  trendDelta,
  caption = "Performance over the last 14 days",
  revenueLabel,
  revenueTotal,
  ticketsLabel = "Tickets",
  ticketsTotal,
}: RevenueTrendProps) => {
  const trendPositive = trendDelta >= 0;
  const formattedTrend = `${trendPositive ? "+" : ""}${trendDelta.toFixed(1)}%`;

  return (
    <Card className="h-full rounded-3xl border border-white/10 bg-gradient-to-br from-[#161d45] via-[#0b132f] to-[#050915] shadow-[0_45px_90px_rgba(3,7,23,0.7)]">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">Revenue Trend</CardTitle>
            <CardDescription>{caption}</CardDescription>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              trendPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            <span>{trendPositive ? "▲" : "▼"}</span>
            <span>{formattedTrend}</span>
            <span className="text-muted-foreground">vs prev. period</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex flex-col">
            <span className="text-muted-foreground">{revenueLabel}</span>
            <span className="text-lg font-semibold">{revenueTotal}</span>
          </div>
          {ticketsTotal && (
            <div className="flex flex-col">
              <span className="text-muted-foreground">{ticketsLabel}</span>
              <span className="text-lg font-semibold">{ticketsTotal}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer
          config={{
            revenue: {
              label: "Revenue",
              theme: { light: "hsl(66 70% 54%)", dark: "hsl(66 70% 54%)" },
            },
            tickets: {
              label: "Tickets",
              theme: { light: "hsl(142 76% 36%)", dark: "hsl(142 76% 36%)" },
            },
          }}
          className="h-[280px]"
        >
          <AreaChart data={data} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} dy={8} />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
              width={45}
            />
            <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={35} />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => `$${Number(value).toLocaleString()}`} />}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              stroke="var(--color-revenue)"
              fill="url(#revenueGradient)"
              strokeWidth={2}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="tickets"
              stroke="var(--color-tickets)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
