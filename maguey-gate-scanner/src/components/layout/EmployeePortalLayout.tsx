import { type ReactNode, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { localStorageService } from "@/lib/localStorage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-purple-200/70">Maguey</p>
          <p className="text-lg font-semibold text-white">Crew Suite</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-purple-100/70 hover:text-white"
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
                isActive ? "bg-white/15 text-white shadow-lg shadow-purple-900/40" : "text-purple-50/70 hover:bg-white/5",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-purple-100",
                  isActive && "bg-purple-500/30 text-white",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <p>{item.title}</p>
            </button>
          );
        })}
      </nav>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-purple-100/70">Signed in</p>
        <p className="text-sm font-semibold text-white">{user?.email ?? "staff@venue.com"}</p>
        <Button variant="ghost" size="sm" className="mt-3 text-purple-100/80 hover:text-white" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#140327] via-[#0a0116] to-[#05000b] text-purple-50">
      <div className="sticky top-0 z-40 border-b border-white/5 bg-[#090015]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              {subtitle && <p className="text-[11px] uppercase tracking-[0.3em] text-purple-200/70">{subtitle}</p>}
              {title && <h1 className="text-xl font-semibold text-white">{title}</h1>}
              {description && <p className="text-sm text-purple-100/70">{description}</p>}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            {actions}
            <RoleSwitcher />
          </div>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold">
              {initials}
            </div>
          </div>
        </div>
        {hero && (
          <div className="mx-auto w-full max-w-4xl px-4 pb-4">
            {hero}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 pb-28">{children}</div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-[#0d011a] border-r border-white/5 shadow-2xl">{renderNav()}</div>
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-[#0c0115]/95 pb-[max(0.75rem,_env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
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
                  isActive ? "text-white" : "text-purple-200/60",
                )}
              >
                <span
                  className={cn(
                    "rounded-xl border border-white/10 bg-white/5 p-2.5",
                    isActive && "bg-purple-500/30 text-white border-white/20",
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

