import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationItem {
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  size?: "large" | "medium" | "small";
  color?: string;
  bg?: string;
  iconBg?: string;
}

interface NavigationGridProps {
  items: NavigationItem[];
}

export function NavigationGrid({ items }: NavigationGridProps) {
  const navigate = useNavigate();

  const largeItems = items.filter((item) => item.size === "large" || !item.size);
  const mediumItems = items.filter((item) => item.size === "medium");
  const smallItems = items.filter((item) => item.size === "small");

  const renderCard = (item: NavigationItem, size: "large" | "medium" | "small") => {
    const Icon = item.icon;
    const isLarge = size === "large";
    const isMedium = size === "medium";

    return (
      <Card
        key={item.path}
        onClick={() => navigate(item.path)}
        className={cn(
          "min-w-0 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg",
          item.bg || "bg-gradient-to-br from-card to-card/50",
          item.color && `border-${item.color}/20`
        )}
      >
        <CardHeader className={cn(isLarge ? "pb-4" : "pb-3")}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className={cn(isLarge ? "text-lg" : "text-base")}>
                {item.title}
              </CardTitle>
              <CardDescription className={cn("mt-1", isLarge ? "text-sm" : "text-xs")}>
                {item.description}
              </CardDescription>
            </div>
            <div
              className={cn(
                "rounded-lg p-2 flex-shrink-0",
                item.iconBg || "bg-primary/10"
              )}
            >
              <Icon className={cn("h-5 w-5 text-primary", item.color && `text-${item.color}`)} />
            </div>
          </div>
        </CardHeader>
        {isLarge && <CardContent className="pt-0"></CardContent>}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Large Cards - Primary Actions */}
      {largeItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Business Operations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {largeItems.map((item) => renderCard(item, "large"))}
          </div>
        </div>
      )}

      {/* Medium Cards - Secondary Features */}
      {mediumItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Management
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {mediumItems.map((item) => renderCard(item, "medium"))}
          </div>
        </div>
      )}

      {/* Small Cards - Utilities */}
      {smallItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Settings & Tools
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {smallItems.map((item) => renderCard(item, "small"))}
          </div>
        </div>
      )}
    </div>
  );
}

