import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { localStorageService } from "@/lib/localStorage";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Scan,
  BarChart3,
  User,
  Users,
  Smartphone,
  Palette,
  Bell,
  DoorOpen,
  Calendar,
  Activity,
  Shield,
  FileText,
  Clock,
  Menu,
  X,
  Globe,
  ListChecks,
  QrCode,
  Crown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BatteryIndicator } from "@/components/BatteryIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const role = useRole();
  const isOwner = role === "owner";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    } else {
      localStorageService.clearUser();
    }
    navigate("/auth");
  };

  const userDisplayName = user?.email?.split("@")[0] || user?.name || "Staff";

  const isActive = (path: string) => location.pathname === path;

  // Owner navigation items
  const ownerNavItems = [
    { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { path: "/sites", label: "Sites", icon: Globe },
    { path: "/events", label: "Events", icon: Calendar },
    { path: "/analytics", label: "Analytics", icon: Activity },
    { path: "/team", label: "Team", icon: Users },
  ];

  const ownerMoreItems = [
    { path: "/devices", label: "Devices", icon: Smartphone },
    { path: "/door-counters", label: "Counters", icon: DoorOpen },
    { path: "/queue", label: "Queue", icon: Clock },
    { path: "/waitlist", label: "Waitlist", icon: ListChecks },
    { path: "/branding", label: "Branding", icon: Palette },
    { path: "/notifications/preferences", label: "Notifications", icon: Bell },
    { path: "/audit-log", label: "Audit Log", icon: FileText },
    { path: "/security", label: "Security", icon: Shield },
    { path: "/staff-scheduling", label: "Schedule", icon: Clock },
    { path: "/scanner", label: "Scanner", icon: Scan }, // Scanner last for owners
  ];

  return (
    <nav className="border-b border-primary/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <img 
              src="/logo.png" 
              alt="Maguey Logo" 
              className="h-10 w-auto object-contain"
            />
            <div>
              <h1 className="text-lg font-bold bg-gradient-purple bg-clip-text text-transparent">
                {isOwner ? "Maguey Admin" : "Maguey Scanner"}
              </h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {/* Scanner - Only for employees */}
            {!isOwner && (
              <>
                <Button
                  variant={isActive("/scanner") ? "secondary" : "ghost"}
                  onClick={() => navigate("/scanner")}
                  className={cn(
                    "flex items-center gap-2 h-10 px-4",
                    isActive("/scanner") && "bg-primary/10"
                  )}
                  size="sm"
                >
                  <Scan className="h-4 w-4" />
                  <span>Scanner</span>
                </Button>
                <Button
                  variant={isActive("/scan/vip") ? "secondary" : "ghost"}
                  onClick={() => navigate("/scan/vip")}
                  className={cn(
                    "flex items-center gap-2 h-10 px-4",
                    isActive("/scan/vip") && "bg-primary/10"
                  )}
                  size="sm"
                >
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span>VIP Scanner</span>
                </Button>
              </>
            )}

            {/* Owner Navigation */}
            {isOwner && (
              <>
                {ownerNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                <Button
                      key={item.path}
                      variant={isActive(item.path) ? "secondary" : "ghost"}
                      onClick={() => navigate(item.path)}
                      className={cn(
                        "flex items-center gap-2 h-10 px-4",
                        isActive(item.path) && "bg-primary/10"
                      )}
                  size="sm"
                >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                </Button>
                  );
                })}

                {/* More Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                      className="flex items-center gap-2 h-10 px-4"
                  size="sm"
                >
                      <span>More</span>
                </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Management</DropdownMenuLabel>
                    {ownerMoreItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <DropdownMenuItem
                          key={item.path}
                          onClick={() => navigate(item.path)}
                          className={cn(
                            "flex items-center gap-2 cursor-pointer",
                            isActive(item.path) && "bg-primary/10"
                          )}
                >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
            </div>

          {/* Right Side - User Info & Logout */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <BatteryIndicator />
            <div className="flex items-center gap-2 px-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate max-w-[100px]">
                {userDisplayName}
              </span>
              <Badge
                variant={isOwner ? "default" : "secondary"}
                className="text-xs"
              >
                {role}
              </Badge>
            </div>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="flex items-center gap-2 h-10 px-3"
              size="sm"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-primary/10 py-4 space-y-2">
            {!isOwner && (
              <>
                <Button
                  variant={isActive("/scanner") ? "secondary" : "ghost"}
                  onClick={() => {
                    navigate("/scanner");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start"
                >
                  <Scan className="h-4 w-4 mr-2" />
                  Scanner
                </Button>
                <Button
                  variant={isActive("/scan/vip") ? "secondary" : "ghost"}
                  onClick={() => {
                    navigate("/scan/vip");
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start"
                >
                  <Crown className="h-4 w-4 mr-2 text-yellow-500" />
                  VIP Scanner
                </Button>
              </>
            )}

            {isOwner && (
              <>
                {ownerNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.path}
                      variant={isActive(item.path) ? "secondary" : "ghost"}
                      onClick={() => {
                        navigate(item.path);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full justify-start"
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </Button>
                  );
                })}

                {ownerMoreItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.path}
                      variant={isActive(item.path) ? "secondary" : "ghost"}
                      onClick={() => {
                        navigate(item.path);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full justify-start"
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </Button>
                  );
                })}
              </>
            )}

            <div className="pt-4 border-t border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {userDisplayName}
                </span>
                <Badge variant={isOwner ? "default" : "secondary"} className="text-xs">
                  {role}
                </Badge>
              </div>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                size="sm"
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
