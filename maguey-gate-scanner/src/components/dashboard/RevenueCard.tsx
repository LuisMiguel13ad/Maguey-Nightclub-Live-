import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RevenueCardProps {
  label: string;
  description: string;
  amount: number;
  tickets: number;
  icon: LucideIcon;
  border?: string;
  bg?: string;
  iconBg?: string;
  iconColor?: string;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function RevenueCard({
  label,
  description,
  amount,
  tickets,
  icon: Icon,
  border = "border-primary/20",
  bg = "bg-gradient-to-br from-primary/5 to-transparent",
  iconBg = "bg-primary/10",
  iconColor = "text-primary",
}: RevenueCardProps) {
  return (
    <Card className={cn("hover:shadow-lg transition-all", border)}>
      <CardHeader className={cn("pb-3", bg)}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {label}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <div className={cn("rounded-lg p-3", iconBg)}>
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-3xl font-bold">{currencyFormatter.format(amount)}</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{tickets.toLocaleString()} tickets</span>
            {tickets > 0 && (
              <span className="text-xs">
                ({currencyFormatter.format(amount / tickets)} avg)
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

