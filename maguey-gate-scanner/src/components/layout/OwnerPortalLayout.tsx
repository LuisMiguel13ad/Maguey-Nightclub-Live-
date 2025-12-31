import { type ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { localStorageService } from "@/lib/localStorage";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import RoleSwitcher from "@/components/RoleSwitcher";
import {
  BarChart3,
  Bell,
  Calendar,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  Settings,
  ShoppingCart,
  Users,
  Wine,
  X,
} from "lucide-react";

interface OwnerPortalLayoutProps {
  title?: string;
  subtitle?: string;
  description?: string;
  actions?: ReactNode;
  hero?: ReactNode;
  children: ReactNode;
}

const sidebarSections = [
  {
    title: "MAIN",
    items: [
      { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { title: "Events", path: "/events", icon: Calendar },
      { title: "Scanner", path: "/scanner", icon: ScanLine },
    ],
  },
  {
    title: "SALES",
    items: [
      { title: "Orders", path: "/orders", icon: ShoppingCart },
      { title: "VIP Tables", path: "/vip-tables", icon: Wine },
      { title: "Analytics", path: "/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "TEAM",
    items: [
      { title: "Staff", path: "/team", icon: Users },
      { title: "Audit Log", path: "/audit-log", icon: FileText },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      { title: "Notifications", path: "/notifications/preferences", icon: Bell },
      { title: "Settings", path: "/settings", icon: Settings },
    ],
  },
  // REMOVED ITEMS (commented out for reference):
  // - Sites (/sites)
  // - Devices (/devices)
  // - Door Counters (/door-counters)
  // - Queue (/queue)
  // - Waitlist (/waitlist)
  // - Branding (/branding) - merged into Settings
  // - Security (/security) - merged into Settings
  // - Staff Scheduling (/staff-scheduling)
  // - VIP Scanner (/scan/vip) - can access via Scanner page
];

export const OwnerPortalLayout = ({ title, subtitle, description, actions, hero, children }: OwnerPortalLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const role = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActivePath = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
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

  const renderSidebar = (className: string, showCloseButton = false) => (
    <aside className={cn(className, "overflow-y-auto")}>
      <div className="flex h-full flex-col gap-8 px-6 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500 shadow-lg shadow-indigo-900/40" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Maguey</p>
              <p className="text-lg font-semibold text-white">Owner Suite</p>
            </div>
          </div>
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        <nav className="flex-1 space-y-8">
          {sidebarSections.map((section) => (
            <div key={section.title} className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{section.title}</p>
              <div className="space-y-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setSidebarOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                        isActivePath(item.path)
                          ? "bg-white/15 text-white shadow-[0_20px_45px_rgba(15,23,42,0.6)]"
                          : "text-slate-400 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300",
                          isActivePath(item.path) && "bg-indigo-500/20 text-white border-white/20",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="text-left">
                        <p>{item.title}</p>
                        {item.path === "/scanner" && (
                          <span className="text-[11px] font-normal text-indigo-300">Quick access to scan</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Signed in as</p>
          <p className="text-sm font-semibold text-white">{user?.email}</p>
          <div className="mt-4 flex items-center gap-3">
            <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-300">
              {role}
            </Badge>
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100">
      {renderSidebar("hidden lg:flex lg:flex-col w-72 bg-[#040b1a]/95 border-r border-white/5 backdrop-blur-2xl fixed inset-y-0 left-0 z-30")}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
          {renderSidebar("lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-[#040b1a] border-r border-white/5 shadow-2xl", true)}
        </>
      )}

      <main className="lg:ml-72 min-h-screen px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl space-y-10">
          <div className="space-y-6">
            <div className="flex items-center justify-between lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                {actions}
                <RoleSwitcher />
              </div>
            </div>

            {(title || subtitle || description) && (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  {subtitle && <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{subtitle}</p>}
                  {title && <h1 className="text-3xl lg:text-4xl font-semibold text-white">{title}</h1>}
                  {description && <p className="text-slate-400">{description}</p>}
                </div>
                <div className="hidden lg:flex items-center gap-3">
                  {actions}
                  <RoleSwitcher />
                </div>
              </div>
            )}

            {hero}
          </div>

          {children}
        </div>
      </main>
    </div>
  );
};

export default OwnerPortalLayout;

