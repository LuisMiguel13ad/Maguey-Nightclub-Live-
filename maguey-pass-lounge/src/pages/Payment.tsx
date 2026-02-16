import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Loader2, AlertCircle, Calendar, MapPin, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEventWithTickets, type EventWithTickets } from "@/lib/events-service";
import { createCheckoutSession, forceStripeCircuitClose } from "@/lib/stripe";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CustomCursor } from "@/components/CustomCursor";
import { handlePaymentError } from "@/lib/payment-errors";

// Helper function to format ticket display names
const getTicketDisplayName = (ticketName: string) => {
  if (ticketName.toLowerCase().includes("female")) {
    return "Female - General Admission";
  }
  if (ticketName.toLowerCase().includes("male")) {
    return "Male - General Admission";
  }
  if (ticketName.toLowerCase().includes("expedited")) {
    return "Expedited Entry Admission";
  }
  if (ticketName.toLowerCase().includes("vip")) {
    return "VIP - General Admission";
  }
  return ticketName;
};

const Payment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventWithTickets | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [tickets, setTickets] = useState<Array<{ id: string; name: string; quantity: number; price: number; fee: number }>>([]);
  const [promoCode, setPromoCode] = useState("");

  const fees = useMemo(() => {
    let subtotal = 0;
    tickets.forEach((ticket) => {
      subtotal += (ticket.price + ticket.fee) * ticket.quantity;
    });

    // Calculate illustrative fees (adjust to match Stripe/finance setup)
    const xsFees = subtotal * 0.06; // 6%
    const processingFees = subtotal * 0.096; // 9.6%
    const entertainmentTax = subtotal * 0.074; // 7.4%

    return {
      subtotal,
      xsFees: parseFloat(xsFees.toFixed(2)),
      processingFees: parseFloat(processingFees.toFixed(2)),
      entertainmentTax: parseFloat(entertainmentTax.toFixed(2)),
      total: subtotal + xsFees + processingFees + entertainmentTax,
    };
  }, [tickets]);

  // Reset circuit breaker on mount (in case it tripped from previous errors)
  useEffect(() => {
    forceStripeCircuitClose();
  }, []);

  // Parse tickets from URL params
  useEffect(() => {
    try {
      const eventId = searchParams.get("event");
      if (!eventId) {
        console.warn("No event ID in URL params, redirecting to events");
        navigate("/");
        return;
      }

      const promoParam = searchParams.get("promoCode");
      if (promoParam) {
        setPromoCode(promoParam);
      }

      // Check for VIP invite code (for linking GA tickets to VIP reservation)
      const vipParam = searchParams.get("vipInviteCode");
      // We'll use this when creating the checkout session

      // Parse tickets from URL first
      const ticketsParam = searchParams.get("tickets");
      if (ticketsParam) {
        try {
          const parsedTickets = JSON.parse(decodeURIComponent(ticketsParam));
          setTickets(parsedTickets);
        } catch (e) {
          console.error("Error parsing tickets:", e);
          setError("Failed to parse ticket data");
        }
      } else {
        console.warn("No tickets parameter in URL");
        setError("No tickets selected");
      }

      // Fetch event data
      getEventWithTickets(eventId)
        .then((eventData) => {
          if (!eventData) {
            setError("Event not found");
            setEvent(null);
            setEventLoading(false);
            return;
          }
          setEvent(eventData);
          setEventLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching event:", err);
          setError("Failed to load event: " + (err instanceof Error ? err.message : "Unknown error"));
          setEvent(null);
          setEventLoading(false);
        });
    } catch (err) {
      console.error("Error in Payment useEffect:", err);
      setError("An error occurred while loading the payment page");
      setEventLoading(false);
    }
  }, [searchParams, navigate]);

  // Checkout handler - extracted for retry capability
  const handleCheckout = useCallback(async () => {
    setIsLoading(true);
    const toastId = toast.loading("Redirecting to Stripe Checkout...");
    try {
      const eventId = searchParams.get("event");
      if (!eventId || tickets.length === 0) {
        throw new Error("Missing event or tickets");
      }

      const customerEmail = user?.email || "guest@example.com";
      const customerName =
        (user?.user_metadata?.first_name && user?.user_metadata?.last_name)
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
          : "Guest User";

      const stripeTickets = tickets.map((ticket) => ({
        ticketTypeId: ticket.id,
        quantity: ticket.quantity,
        unitPrice: Number(ticket.price),
        unitFee: Number(ticket.fee || 0),
        displayName: getTicketDisplayName(ticket.name),
      }));

      const successUrl = `${window.location.origin}/checkout/success`;
      const cancelUrl = `${window.location.origin}/payment?event=${eventId}&canceled=true`;

      // Get VIP invite code if present
      const vipInviteCode = searchParams.get("vipInviteCode") || undefined;

      const session = await createCheckoutSession({
        eventId,
        tickets: stripeTickets,
        customerEmail,
        customerName,
        totalAmount: fees.total,
        feesAmount: fees.xsFees + fees.processingFees + fees.entertainmentTax,
        successUrl,
        cancelUrl,
        vipInviteCode,
      });

      toast.success("Redirecting to Stripe...", { id: toastId });
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      toast.dismiss(toastId);
      handlePaymentError(err, {
        onRetry: handleCheckout,
        setIsLoading,
        customerEmail: user?.email,
        paymentType: 'ga_ticket',
        eventId: searchParams.get("event") || undefined,
      });
      setIsLoading(false);
    }
  }, [searchParams, tickets, user, fees]);

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-copper-400" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Loading Payment...
        </p>
      </div>
    );
  }

  if (!event || tickets.length === 0) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="font-serif text-2xl text-stone-100 mb-2">No Tickets Selected</h2>
          <p className="text-stone-400 mb-4">Please select tickets before checkout</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-copper-400 text-forest-950 rounded-sm hover:bg-copper-500 transition-colors font-medium"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string, timeString: string) => {
    if (!event) return "";
    const date = new Date(dateString);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let formattedTime = timeString;
    if (timeString) {
      const [hourStr, minuteStr] = timeString.split(":");
      if (hourStr && minuteStr) {
        const dateTime = new Date();
        dateTime.setHours(Number(hourStr), Number(minuteStr));
        formattedTime = dateTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
      }
    }
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()} at ${formattedTime}`;
  };

  const eventImageUrl = event?.image_url || "/placeholder.svg";

  return (
    <div className="min-h-screen bg-forest-950 text-stone-300 overflow-x-hidden">
      {/* Custom Cursor */}
      <CustomCursor />
      
      {/* Noise Overlay */}
      <div className="noise-overlay" />
      
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
        <svg width="100%" height="100%">
          <pattern id="payment-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-copper-400" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#payment-grid)" />
        </svg>
      </div>
      
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="max-w-5xl w-full flex flex-col lg:flex-row gap-6 items-stretch">
          {/* Event Card - Left Side (Full Image) */}
          <div className="w-full lg:w-[380px] flex-shrink-0">
            <div className="glass-panel rounded-sm overflow-hidden h-full">
              <div className="relative h-full min-h-[500px]">
                <img
                  src={eventImageUrl}
                  alt={event.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/20 to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6">
                  <h3 className="font-serif text-xl text-stone-100 line-clamp-2">{event.name}</h3>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Event Details + Payment Form */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Event Details Section */}
            <div className="glass-panel rounded-sm p-5">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-copper-400" />
                  <span className="font-medium text-stone-100">{formatDate(event.event_date, event.event_time)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-copper-400" />
                  <span className="font-medium text-stone-100">{event.venue_name || "Maguey Nightclub"}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  {tickets.map((ticket, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-stone-400">{ticket.quantity}x {getTicketDisplayName(ticket.name)}</span>
                      <span className="text-stone-100 font-medium">${((ticket.price + ticket.fee) * ticket.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-stone-400">Subtotal</span>
                    <span className="text-stone-100">${fees.subtotal.toFixed(2)}</span>
                  </div>
                  {fees.xsFees > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-stone-400">Fees</span>
                      <span className="text-stone-100">${(fees.xsFees + fees.processingFees + fees.entertainmentTax).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="text-stone-100">Total</span>
                    <span className="text-copper-400">${fees.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Checkout */}
            <div className="glass-panel rounded-sm p-6 flex-1">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-serif text-lg text-stone-100">Payment Details</h3>
                <div className="text-sm text-stone-400">Amount: <span className="text-copper-400 font-medium">${fees.total.toFixed(2)}</span></div>
              </div>
              
              <p className="text-stone-500 text-sm mb-4">Complete your purchase with our secure payment processing system.</p>

              <Button
                type="button"
                disabled={isLoading}
                className="w-full px-4 py-3 bg-copper-400 hover:bg-copper-500 text-forest-950 rounded-sm transition flex items-center justify-center font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCheckout}
              >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  Pay ${fees.total.toFixed(2)}
                </>
              )}
            </Button>
            
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-stone-500">
                    Need help? <Link to="/support" className="text-copper-400 hover:text-copper-300">Contact support</Link>
                  </p>
                  <div className="flex items-center text-xs text-stone-500">
                    <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                    PCI DSS Compliant
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
