import { type ReactNode, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { localStorageService } from "@/lib/localStorage";
import { logAuditEvent } from "@/lib/audit-service";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, QrCode, ListChecks, Settings, LogOut, X } from "lucide-react";
import RoleSwitcher from "@/components/RoleSwitcher";

interface EmployeePortalLayoutProps {
  title?: string;
  subtitle?: string;
  description?: string;
  actions?: ReactNode;
  hero?: ReactNode;
  children: ReactNode;
}

const mobileNavItems = [
  { title: "Scanner", path: "/scanner", icon: QrCode },
  { title: "Guest List", path: "/guest-list", icon: ListChecks },
  { title: "Settings", path: "/crew/settings", icon: Settings },
];

export const EmployeePortalLayout = ({
  title,
  subtitle,
  description,
  actions,
  hero,
  children,
}: EmployeePortalLayoutProps) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = useMemo(() => {
    if (!user?.email) return "ST";
    return user.email
      .split("@")[0]
      .split(".")
      .map((part) => part[0]?.toUpperCase())
      .join("")
      .slice(0, 2);
  }, [user?.email]);

  const handleSignOut = async () => {
    // Audit log: employee logout
    await logAuditEvent('logout', 'user', 'Employee logged out', {
      userId: user?.id,
      severity: 'info',
      metadata: { role: 'employee', email: user?.email },
    }).catch(() => {}); // Non-blocking

    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      } else {
        localStorageService.clearUser();
      }
    } finally {
      navigate("/auth");
    }
  };

  const renderNav = () => (
    <div className="flex flex-col gap-4 px-6 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-lime flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">M</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-sidebar-muted">Maguey</p>
            <p className="text-base font-semibold text-sidebar-foreground">Crew Suite</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/10"
          onClick={() => setMenuOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="space-y-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path.replace(/\/$/, ""));
          return (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMenuOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.title}</span>
            </button>
          );
        })}
      </nav>
      <div className="rounded-2xl border border-border-dark bg-white/5 p-4">
        <p className="text-xs text-sidebar-muted">Signed in</p>
        <p className="text-sm font-semibold text-sidebar-foreground">{user?.email ?? "staff@venue.com"}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/10"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 border-b border-border bg-card backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-2xl border border-border-dark bg-white/5 text-card-foreground hover:bg-white/10"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              {subtitle && <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{subtitle}</p>}
              {title && <h1 className="text-xl font-semibold text-card-foreground">{title}</h1>}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
              {actions}
              <RoleSwitcher />
            </div>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary text-sm font-semibold">
              {initials}
            </div>
          </div>
        </div>
        {hero && (
          <div className="mx-auto w-full max-w-7xl px-4 pb-4">
            {hero}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 pb-28">{children}</div>

      {/* Mobile sidebar overlay */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-border-dark shadow-2xl">
            {renderNav()}
          </div>
        </>
      )}

      {/* Mobile bottom navigation */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-dark bg-sidebar pb-[max(0.75rem,_env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-6 py-3">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path.replace(/\/$/, ""));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center gap-1 text-[11px] font-medium transition-all",
                  isActive ? "text-sidebar-foreground" : "text-sidebar-muted",
                )}
              >
                <span
                  className={cn(
                    "rounded-xl border border-border-dark bg-white/5 p-2.5 transition-all",
                    isActive && "bg-primary text-primary-foreground border-primary shadow-glow-lime",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {item.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EmployeePortalLayout;
