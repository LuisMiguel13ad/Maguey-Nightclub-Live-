import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import Events from "./pages/Events";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import PaymentEmail from "./pages/PaymentEmail";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import Ticket from "./pages/Ticket";
import Account from "./pages/Account";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import TwoFactorSetup from "./pages/TwoFactorSetup";
import Profile from "./pages/Profile";
import AccountSettings from "./pages/AccountSettings";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Refund from "./pages/Refund";
import AdminDashboard from "./pages/admin/AdminDashboard";
import TestTicketViewer from "./pages/TestTicketViewer";
import VipTableConfirmation from "./pages/VipTableConfirmation";
import VIPTablesPage from "./pages/VIPTablesPage";
import VIPBookingForm from "./pages/VIPBookingForm";
import VipPayment from "./pages/VipPayment";
import VipCheckoutSuccess from "./pages/VipCheckoutSuccess";
import VIPPassView from "./pages/VIPPassView";
import VIPGuestDashboard from "./pages/VIPGuestDashboard";
import TypographyShowcase from "./components/TypographyShowcase";

// Redirect component for old EventDetail route - redirects to checkout with event ID
const EventDetailRedirect = () => {
  const { eventId } = useParams();
  return <Navigate to={`/checkout?event=${eventId}`} replace />;
};

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <GoogleAnalytics />
          <Routes>
            <Route path="/" element={<Events />} />
          <Route path="/events" element={<Events />} />
          {/* Redirect old EventDetail page to checkout */}
          <Route path="/events/:eventId" element={<EventDetailRedirect />} />
          <Route path="/events/:eventId/vip-tables" element={<VIPTablesPage />} />
          <Route path="/events/:eventId/vip-booking" element={<VIPBookingForm />} />
          <Route path="/events/:eventId/vip-payment" element={<VipPayment />} />
              <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/2fa-setup" element={<TwoFactorSetup />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/payment/email" element={<PaymentEmail />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/ticket/:ticketId" element={<Ticket />} />
          <Route path="/test-tickets" element={<TestTicketViewer />} />
          {/* Legacy /vip-tables route removed - use /events/:eventId/vip-tables instead */}
          <Route path="/vip-confirmation" element={<VipTableConfirmation />} />
          <Route path="/vip-checkout-success" element={<VipCheckoutSuccess />} />
          <Route path="/vip-pass/:token" element={<VIPPassView />} />
          <Route path="/vip/dashboard/:reservationId" element={<VIPGuestDashboard />} />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AccountSettings />
                </ProtectedRoute>
              }
            />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          {/* Legal Pages */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refund" element={<Refund />} />
          {/* Typography Showcase (dev reference - remove before production) */}
          <Route path="/typography" element={<TypographyShowcase />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
