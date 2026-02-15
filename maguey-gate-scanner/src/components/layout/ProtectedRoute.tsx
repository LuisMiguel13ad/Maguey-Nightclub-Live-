/**
 * Protected Route Component
 *
 * Provides authentication, authorization, and DEV-mode gating for routes.
 *
 * Features:
 * - Loading spinner while auth state resolves
 * - Redirects unauthenticated users to /auth with state.from preserved
 * - Role-based authorization with 403 page for wrong roles
 * - DEV-only route protection (blocks access in production builds)
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

  // 1. Loading check - show spinner while auth state resolves
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 2. DEV mode check - block route in production if requireDev is true
  // Check this BEFORE auth so the route is invisible in production
  if (requireDev && !import.meta.env.DEV) {
    return <Unauthorized />;
  }

  // 3. Authentication check - redirect to /auth if no user
  if (!user) {
    // Redirect to /auth, preserving the attempted URL for post-login redirect
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 4. Role authorization check - show 403 if user role not in allowedRoles
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Unauthorized />;
  }

  // 5. All checks pass - render children
  return <>{children}</>;
}
