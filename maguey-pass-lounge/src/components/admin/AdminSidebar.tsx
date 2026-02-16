import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/tickets", label: "Tickets" },
  { to: "/admin/guest-lists", label: "Guest Lists" },
  { to: "/admin/vip-tables", label: "🍾 VIP Tables" },
  { to: "/admin/reports", label: "Reports" },
];

export function AdminSidebar() {
  const location = useLocation();

  return (
    <nav className="flex flex-col gap-2 p-4 border-r border-border/50 lg:min-h-[calc(100vh-64px)]">
      <h2 className="text-lg font-semibold mb-4">Promoter Console</h2>
      {navItems.map((item) => {
        const isActive =
          item.to === "/admin"
            ? location.pathname === "/admin"
            : location.pathname.startsWith(item.to);

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive: routerActive }) =>
              cn(
                "w-full",
                (isActive || routerActive) && "pointer-events-none"
              )
            }
          >
            <Button
              variant={isActive ? "default" : "ghost"}
              className={cn(
                "justify-start w-full",
                isActive ? "" : "text-muted-foreground"
              )}
            >
              {item.label}
            </Button>
          </NavLink>
        );
      })}
      <div className="mt-8 text-xs text-muted-foreground">
        {/* Future quick links or stats */}
        <p>Signed in as promoter.</p>
      </div>
    </nav>
  );
}


