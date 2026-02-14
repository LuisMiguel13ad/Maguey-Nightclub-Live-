import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { ScrollToTop } from "./components/ScrollToTop";
import { AuthProvider } from "./contexts/AuthContext";
import { BrandingProvider } from "./contexts/BrandingContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import EmployeeLogin from "./pages/auth/EmployeeLogin";
import OwnerLogin from "./pages/auth/OwnerLogin";
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
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/owner" element={<OwnerLogin />} />
        <Route path="/auth/employee" element={<EmployeeLogin />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/guest-list" element={<GuestListCheckIn />} />
        <Route path="/scan/vip" element={<VipScannerPage />} />
        <Route path="/scan/vip/:eventId" element={<VipScannerPage />} />
        <Route path="/dashboard" element={<OwnerDashboard />} />
        <Route path="/events" element={<EventManagement />} />
        <Route path="/analytics" element={<AdvancedAnalytics />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/security" element={<SecuritySettings />} />
        <Route path="/staff-scheduling" element={<StaffScheduling />} />
        <Route path="/team" element={<TeamManagement />} />
        <Route path="/devices" element={<DeviceManagement />} />
        <Route path="/door-counters" element={<DoorCounterManagement />} />
        <Route path="/branding" element={<Branding />} />
        <Route path="/fraud-investigation" element={<FraudInvestigation />} />
        <Route path="/queue" element={<QueueManagement />} />
        <Route path="/queue-status/:eventId" element={<QueueStatus />} />
        <Route path="/notifications/preferences" element={<NotificationPreferences />} />
        <Route path="/notifications/rules" element={<NotificationRules />} />
        <Route path="/notifications/analytics" element={<NotificationAnalytics />} />
        <Route path="/sites" element={<SiteManagement />} />
        <Route path="/customers" element={<CustomerManagement />} />
        <Route path="/waitlist" element={<WaitlistManagement />} />
        <Route path="/crew/settings" element={<CrewSettings />} />
        <Route path="/vip-tables" element={<VipTablesManagement />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/test-qr" element={<TestQrGenerator />} />
        {/* Monitoring Routes */}
        <Route path="/monitoring/metrics" element={<MetricsPage />} />
        <Route path="/monitoring/traces" element={<TracesPage />} />
        <Route path="/monitoring/errors" element={<ErrorsPage />} />
        <Route path="/monitoring/circuit-breakers" element={<CircuitBreakersPage />} />
        <Route path="/monitoring/rate-limits" element={<RateLimitsPage />} />
        <Route path="/monitoring/query-performance" element={<QueryPerformancePage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
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
