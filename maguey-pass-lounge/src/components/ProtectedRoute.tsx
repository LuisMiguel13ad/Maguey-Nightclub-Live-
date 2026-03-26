/**
 * Protected Route Component
 * Provides authentication, authorization, and DEV-mode gating for routes.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { type UserRole } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import Unauthorized from "@/pages/Unauthorized";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];  // Optional: omit = any authenticated user
  requireDev?: boolean;       // Optional: gate behind import.meta.env.DEV
}

export function ProtectedRoute({ children, allowedRoles, requireDev }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // DEV mode check
  if (requireDev && !import.meta.env.DEV) {
    return <Unauthorized />;
  }

  if (!user) {
    // Redirect to login page, but save the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role authorization check
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Unauthorized />;
  }

  return <>{children}</>;
}

