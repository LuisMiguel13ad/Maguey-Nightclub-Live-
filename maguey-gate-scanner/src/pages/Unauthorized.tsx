/**
 * 403 Unauthorized Error Page
 *
 * Displays when user is authenticated but doesn't have permission to access a route.
 * Provides role-aware navigation buttons to return to appropriate section of the app.
 */

import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

const Unauthorized = () => {
  const { role, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Determine primary action button based on user role
  const getPrimaryAction = () => {
    if (!user) {
      // Edge case: DEV-only route accessed in production (no user)
      return (
        <Button variant="default" onClick={() => navigate("/auth")} className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Login
        </Button>
      );
    }

    if (role === "owner" || role === "promoter") {
      return (
        <Button variant="default" onClick={() => navigate("/dashboard")} className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      );
    }

    // Employee role
    return (
      <Button variant="default" onClick={() => navigate("/scanner")} className="w-full">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Scanner
      </Button>
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md mx-auto p-6">
        <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="mb-2 text-4xl font-bold">403</h1>
        <p className="mb-2 text-xl text-muted-foreground">Access Denied</p>
        <p className="mb-6 text-sm text-muted-foreground">
          You don't have permission to access this page.
        </p>

        {/* Action buttons - stack vertically for mobile-friendly layout */}
        <div className="space-y-3">
          {getPrimaryAction()}

          <Button variant="outline" onClick={handleSignOut} className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
