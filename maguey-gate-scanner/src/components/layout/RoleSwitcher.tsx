import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { localStorageService } from "@/lib/localStorage";
import type { UserRole } from "@/lib/auth";

const DEMO_PROFILES: Record<UserRole, { id: string; email: string; name: string; role: UserRole }> = {
  owner: {
    id: "test-owner-1",
    email: "owner@test.maguey",
    name: "Test Owner",
    role: "owner",
  },
  employee: {
    id: "test-employee-1",
    email: "employee@test.maguey",
    name: "Test Employee",
    role: "employee",
  },
};

/**
 * Lightweight role switcher that mirrors the quick access buttons from the auth page.
 * Only available when Supabase isn't configured so it won't interfere with prod auth.
 */
export const RoleSwitcher = () => {
  const navigate = useNavigate();
  const { role, refreshRole } = useAuth();

  const handleSwitch = useCallback(
    async (targetRole: UserRole) => {
      if (targetRole === role) return;
      const profile = DEMO_PROFILES[targetRole];
      localStorageService.setUser(profile);
      await refreshRole();
      navigate(targetRole === "owner" ? "/dashboard" : "/scanner");
    },
    [navigate, refreshRole, role],
  );

  if (isSupabaseConfigured()) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="border border-white/10 bg-white/5 text-xs uppercase tracking-[0.2em] text-white hover:bg-white/10">
          {role === "owner" ? "Owner" : "Crew"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Switch Persona</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={role === "owner"}
          className="flex items-center gap-2"
          onClick={() => handleSwitch("owner")}
        >
          <Shield className="h-4 w-4 text-indigo-400" />
          Owner Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={role === "employee"}
          className="flex items-center gap-2"
          onClick={() => handleSwitch("employee")}
        >
          <Users className="h-4 w-4 text-purple-400" />
          Crew Scanner
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RoleSwitcher;
