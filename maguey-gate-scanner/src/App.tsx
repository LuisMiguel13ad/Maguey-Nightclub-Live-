import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { ScrollToTop } from "./components/ScrollToTop";
import { AuthProvider } from "./contexts/AuthContext";
import { BrandingProvider } from "./contexts/BrandingContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import EmployeeLogin from "./pages/auth/EmployeeLogin";
import OwnerLogin from "./pages/auth/OwnerLogin";
import Unauthorized from "./pages/Unauthorized";
import Scanner from "./pages/Scanner";
import OwnerDashboard from "./pages/OwnerDashboard";
import Dashboard from "./pages/Dashboard";
import EventManagement from "./pages/EventManagement";
import AdvancedAnalytics from "./pages/AdvancedAnalytics";
import AuditLog from "./pages/AuditLog";
import SecuritySettings from "./pages/SecuritySettings";
import StaffScheduling from "./pages/StaffScheduling";
import TeamManagement from "./pages/TeamManagement";
import DeviceManagement from "./pages/DeviceManagement";
import DoorCounterManagement from "./pages/DoorCounterManagement";
import Branding from "./pages/Branding";
import FraudInvestigation from "./pages/FraudInvestigation";
import { QueueStatus } from "./pages/QueueStatus";
import { QueueManagement } from "./pages/QueueManagement";
import NotificationPreferences from "./pages/NotificationPreferences";
import NotificationRules from "./pages/NotificationRules";
import NotificationAnalytics from "./pages/NotificationAnalytics";
import SiteManagement from "./pages/SiteManagement";
import CustomerManagement from "./pages/CustomerManagement";
import WaitlistManagement from "./pages/WaitlistManagement";
import NotFound from "./pages/NotFound";
import CrewSettings from "./pages/crew/CrewSettings";
import VipTablesManagement from "./pages/VipTablesManagement";
import { GuestListCheckIn } from "./pages/GuestListCheckIn";
import VipScannerPage from "./pages/VipScannerPage";
import Orders from "./pages/Orders";
import TestQrGenerator from "./pages/TestQrGenerator";
// Monitoring pages
import MetricsPage from "./pages/monitoring/MetricsPage";
import TracesPage from "./pages/monitoring/TracesPage";
import ErrorsPage from "./pages/monitoring/ErrorsPage";
import CircuitBreakersPage from "./pages/monitoring/CircuitBreakersPage";
import RateLimitsPage from "./pages/monitoring/RateLimitsPage";
import QueryPerformancePage from "./pages/monitoring/QueryPerformancePage";

const queryClient = new QueryClient();

const AppContent = () => {
  return (
    <>
      <Routes>
        {/* PUBLIC ROUTES - No protection required */}
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/owner" element={<OwnerLogin />} />
        <Route path="/auth/employee" element={<EmployeeLogin />} />

        {/* EMPLOYEE ROUTES - Auth required, any role */}
        <Route path="/scanner" element={<ProtectedRoute><Scanner /></ProtectedRoute>} />
        <Route path="/guest-list" element={<ProtectedRoute><GuestListCheckIn /></ProtectedRoute>} />
        <Route path="/scan/vip" element={<ProtectedRoute><VipScannerPage /></ProtectedRoute>} />
        <Route path="/scan/vip/:eventId" element={<ProtectedRoute><VipScannerPage /></ProtectedRoute>} />

        {/* OWNER ROUTES - Auth required + owner/promoter role */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><OwnerDashboard /></ProtectedRoute>} />
        <Route path="/events" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><EventManagement /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><AdvancedAnalytics /></ProtectedRoute>} />
        <Route path="/audit-log" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><AuditLog /></ProtectedRoute>} />
        <Route path="/security" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><SecuritySettings /></ProtectedRoute>} />
        <Route path="/staff-scheduling" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><StaffScheduling /></ProtectedRoute>} />
        <Route path="/team" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><TeamManagement /></ProtectedRoute>} />
        <Route path="/devices" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><DeviceManagement /></ProtectedRoute>} />
        <Route path="/door-counters" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><DoorCounterManagement /></ProtectedRoute>} />
        <Route path="/branding" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><Branding /></ProtectedRoute>} />
        <Route path="/fraud-investigation" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><FraudInvestigation /></ProtectedRoute>} />
        <Route path="/queue" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><QueueManagement /></ProtectedRoute>} />
        <Route path="/queue-status/:eventId" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><QueueStatus /></ProtectedRoute>} />
        <Route path="/notifications/preferences" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><NotificationPreferences /></ProtectedRoute>} />
        <Route path="/notifications/rules" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><NotificationRules /></ProtectedRoute>} />
        <Route path="/notifications/analytics" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><NotificationAnalytics /></ProtectedRoute>} />
        <Route path="/sites" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><SiteManagement /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><CustomerManagement /></ProtectedRoute>} />
        <Route path="/waitlist" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><WaitlistManagement /></ProtectedRoute>} />
        <Route path="/crew/settings" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><CrewSettings /></ProtectedRoute>} />
        <Route path="/vip-tables" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><VipTablesManagement /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><Orders /></ProtectedRoute>} />

        {/* DEV-ONLY ROUTES - Blocked in production + owner role required */}
        <Route path="/test-qr" element={<ProtectedRoute requireDev allowedRoles={['owner']}><TestQrGenerator /></ProtectedRoute>} />

        {/* Monitoring Routes - Owner/Promoter only */}
        <Route path="/monitoring/metrics" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><MetricsPage /></ProtectedRoute>} />
        <Route path="/monitoring/traces" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><TracesPage /></ProtectedRoute>} />
        <Route path="/monitoring/errors" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><ErrorsPage /></ProtectedRoute>} />
        <Route path="/monitoring/circuit-breakers" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><CircuitBreakersPage /></ProtectedRoute>} />
        <Route path="/monitoring/rate-limits" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><RateLimitsPage /></ProtectedRoute>} />
        <Route path="/monitoring/query-performance" element={<ProtectedRoute allowedRoles={['owner', 'promoter']}><QueryPerformancePage /></ProtectedRoute>} />

        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <BrandingProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true,
                }}
              >
                <ScrollToTop />
                <AppContent />
              </BrowserRouter>
            </BrandingProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
