import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

// Lazy load all routes for code splitting
const Index = lazy(() => import("./pages/Index"));
const EventPage = lazy(() => import("./pages/EventPage"));
const UpcomingEvents = lazy(() => import("./pages/UpcomingEvents"));
const Contact = lazy(() => import("./pages/Contact"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Payment = lazy(() => import("./pages/Payment"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const TicketScanner = lazy(() => import("./pages/TicketScanner"));
const MobileScanner = lazy(() => import("./pages/MobileScanner"));
const Restaurant = lazy(() => import("./pages/Restaurant"));
const RestaurantMenu = lazy(() => import("./pages/RestaurantMenu"));
const RestaurantCheckout = lazy(() => import("./pages/RestaurantCheckout"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Policies = lazy(() => import("./pages/Policies"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Careers = lazy(() => import("./pages/Careers"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback component with immediate display
const LoadingFallback = () => (
  <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#39B54A] mx-auto mb-4" />
      <p className="text-white text-lg">Loading...</p>
    </div>
  </div>
);

// Optimized QueryClient configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// App content component that uses location
// Using key on a wrapper div forces React to remount on route change, ensuring clean transitions
const AppContent = () => {
  const location = useLocation();
  
  return (
    <div key={location.pathname}>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/events" element={<UpcomingEvents />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/restaurant" element={<Restaurant />} />
          <Route path="/restaurant/menu" element={<RestaurantMenu />} />
          <Route path="/restaurant/checkout" element={<RestaurantCheckout />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/event/:eventId" element={<EventPage />} />
          <Route path="/checkout/:eventId" element={<Checkout />} />
          <Route path="/payment/:paymentIntentId" element={<Payment />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/scanner" element={<TicketScanner />} />
          <Route path="/scanner/mobile" element={<MobileScanner />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
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
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
