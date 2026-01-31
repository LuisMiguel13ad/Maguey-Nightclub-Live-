import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  CreditCard, Mail, User, Lock, Loader2, AlertCircle,
  Share2, Menu, Plus, Minus,
  Clock, Info, Twitter, Facebook, Instagram,
  ShoppingCart, Wine, Crown, Ticket, ArrowRight
} from "lucide-react";
import { CustomCursor } from "@/components/CustomCursor";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EventCardSkeleton, TicketCardSkeleton } from "@/components/ui/skeleton-card";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { AuthButton } from "@/components/AuthButton";
import {
  getEventWithTicketsAndAvailability,
  getCheckoutUrlForEvent,
  type Event,
  type EventWithTickets,
  type EventAvailability,
} from "@/lib/events-service";
import { useEventsRealtime } from "@/hooks/useEventsRealtime";
import {
  fetchPromotion,
  type Promotion,
} from "@/lib/promotions-service";
import { supabase } from "@/lib/supabase";

// VIP Reservation type for invite code linking
interface VIPInviteReservation {
  id: string;
  purchaser_name: string;
  table_number: number;
  invite_code: string;
  event_vip_tables: {
    capacity: number;
    tier: string;
  } | null;
}

// Form validation schema
const checkoutSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleRecommendedEventClick = async (eventId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const checkoutUrl = await getCheckoutUrlForEvent(eventId);
    if (checkoutUrl) {
      navigate(checkoutUrl);
    } else {
      console.error("No ticket types found for event:", eventId);
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventWithTickets | null>(null);
  const [availability, setAvailability] = useState<EventAvailability | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<Record<string, { name: string; price: number; fee: number; quantity: number }>>({});
  const [subtotal, setSubtotal] = useState(0);
  const [serviceFee, setServiceFee] = useState(0);
  const [total, setTotal] = useState(0);
  const [recommendedEvents, setRecommendedEvents] = useState<Event[]>([]);
  const [highlightedTicketId, setHighlightedTicketId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<Promotion | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Real-time events for recommended events section
  // Events created in dashboard appear within seconds (< 30 second requirement)
  const { events: realtimeEvents, isLive: eventsIsLive } = useEventsRealtime({
    filter: { upcomingOnly: true },
  });

  // VIP invite code state
  const [vipInviteCode, setVipInviteCode] = useState<string | null>(null);
  const [vipReservation, setVipReservation] = useState<VIPInviteReservation | null>(null);
  const [vipLinkedCount, setVipLinkedCount] = useState(0);

  // Get user metadata
  const userFirstName = user?.user_metadata?.first_name || '';
  const userLastName = user?.user_metadata?.last_name || '';
  const userEmail = user?.email || '';

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      firstName: userFirstName,
      lastName: userLastName,
      email: userEmail,
    },
  });

  // Pre-fill form if user is logged in
  useEffect(() => {
    if (user) {
      setValue('firstName', userFirstName);
      setValue('lastName', userLastName);
      setValue('email', userEmail);
    }
  }, [user, userFirstName, userLastName, userEmail, setValue]);

  // Detect VIP invite code from URL
  useEffect(() => {
    const inviteCode = searchParams.get("vip");
    if (!inviteCode) {
      setVipInviteCode(null);
      setVipReservation(null);
      return;
    }

    setVipInviteCode(inviteCode);

    // Fetch VIP reservation details
    const fetchVipReservation = async () => {
      try {
        const { data: reservation, error } = await supabase
          .from('vip_reservations')
          .select('id, purchaser_name, table_number, invite_code, event_vip_tables(capacity, tier)')
          .eq('invite_code', inviteCode)
          .single();

        if (!error && reservation) {
          setVipReservation(reservation);

          // Get linked ticket count
          const { count } = await supabase
            .from('vip_linked_tickets')
            .select('*', { count: 'exact', head: true })
            .eq('vip_reservation_id', reservation.id);

          setVipLinkedCount(count || 0);
        }
      } catch (err) {
        console.error('Error fetching VIP reservation:', err);
      }
    };

    fetchVipReservation();
  }, [searchParams]);

  // Parse order data from URL params and fetch event
  useEffect(() => {
    const eventId = searchParams.get("event");
    const ticketId = searchParams.get("ticket");
    const quantityParam = searchParams.get("quantity");

    if (!eventId) {
      setError("No event selected");
      setEventLoading(false);
      return;
    }

    setEventLoading(true);
    getEventWithTicketsAndAvailability(eventId)
      .then((eventData) => {
        if (!eventData) {
          setError("Event not found");
          setEvent(null);
          setAvailability(null);
          setEventLoading(false);
          return;
        }

        setEvent(eventData);
        setAvailability(eventData.availability || null);
        setSelectedTickets({});

        if (ticketId) {
          const ticket = eventData.ticketTypes.find((t) => t.id === ticketId);
          if (ticket) {
            setHighlightedTicketId(ticketId);
            const qty = parseInt(quantityParam || "", 10);
            if (!Number.isNaN(qty) && qty > 0) {
              setSelectedTickets({
                [ticket.id]: {
                  name: ticket.name,
                  price: ticket.price,
                  fee: ticket.fee,
                  quantity: qty,
                },
              });
            }
          }
        } else {
          // Auto-select default ticket (first ticket, sorted by price)
          if (eventData.ticketTypes && eventData.ticketTypes.length > 0) {
            const defaultTicket = eventData.ticketTypes[0];
            setHighlightedTicketId(defaultTicket.id);
            // Update URL to include ticket ID for proper sharing
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('ticket', defaultTicket.id);
            window.history.replaceState({}, '', newUrl.toString());
          } else {
            setHighlightedTicketId(null);
          }
        }

        setEventLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching event:", err);
        setError("Failed to load event");
        setEvent(null);
        setAvailability(null);
        setEventLoading(false);
      });
  }, [searchParams]);

  // Helper to get availability for a ticket type
  const getTicketAvailability = (ticketCode: string) => {
    if (!availability) return null;
    return availability.ticketTypes.find(t => t.ticketTypeCode === ticketCode);
  };

  const promoAdjustedTotals = useMemo(() => {
    let subtotalAmount = 0;
    let feeAmount = 0;

    Object.values(selectedTickets).forEach((ticket) => {
      if (ticket.quantity > 0) {
        subtotalAmount += ticket.price * ticket.quantity;
        feeAmount += ticket.fee * ticket.quantity;
      }
    });

    let promoDiscount = 0;
    if (promoApplied) {
      if (promoApplied.discount_type === "amount") {
        promoDiscount = promoApplied.amount;
      } else {
        promoDiscount = (subtotalAmount + feeAmount) * (promoApplied.amount / 100);
      }
    }
    promoDiscount = Math.min(promoDiscount, subtotalAmount + feeAmount);

    return {
      subtotal: subtotalAmount,
      fee: feeAmount,
      discount: promoDiscount,
      total: subtotalAmount + feeAmount - promoDiscount,
    };
  }, [selectedTickets, promoApplied]);

  // Update totals when selection or promo changes
  useEffect(() => {
    setSubtotal(promoAdjustedTotals.subtotal);
    setServiceFee(promoAdjustedTotals.fee);
    setTotal(promoAdjustedTotals.total);
  }, [promoAdjustedTotals]);

  // Use real-time events for recommended events (updates within seconds)
  useEffect(() => {
    if (!event || realtimeEvents.length === 0) return;

    // Filter out current event and limit to 6
    const filtered = realtimeEvents
      .filter((ev) => ev.id !== event.id)
      .slice(0, 6);
    setRecommendedEvents(filtered);
  }, [event, realtimeEvents]);

  // Format date for display
  const formatDate = (dateString: string, timeString: string) => {
    if (!event) return { day: '', month: '', dayNum: '', full: '' };
    const date = new Date(dateString);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
    return {
      day: days[date.getDay()],
      month: months[date.getMonth()],
      dayNum: date.getDate(),
      full: `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()} at ${formattedTime}`,
    };
  };

  const dateInfo = event ? formatDate(event.event_date, event.event_time) : { day: '', month: '', dayNum: '', full: '' };
  const eventImageUrl = event?.image_url || "/placeholder.svg";
  const eventVenue = event?.venue_name || "Maguey Nightclub";
  const eventCity = event?.city || "Wilmington, DE";

  const updateQuantity = (ticketId: string, delta: number) => {
    const ticket = event?.ticketTypes.find(t => t.id === ticketId);
    if (!ticket) return;
    
    const currentTicket = selectedTickets[ticketId];
    const currentQuantity = currentTicket?.quantity || 0;
    const max = ticket.limit_per_order ?? 10;
    const newQuantity = Math.max(0, Math.min(currentQuantity + delta, max));
    
    if (newQuantity === 0) {
      // Remove ticket from selection if quantity becomes 0
      const updated = { ...selectedTickets };
      delete updated[ticketId];
      setSelectedTickets(updated);
      if (highlightedTicketId === ticketId) {
        setHighlightedTicketId(null);
      }
    } else {
      // Update or add ticket with new quantity
      setSelectedTickets({
        ...selectedTickets,
        [ticketId]: {
          name: ticket.name,
          price: ticket.price,
          fee: ticket.fee,
          quantity: newQuantity,
        }
      });
    }
  };

  const getTicketQuantity = (ticketId: string) => {
    return selectedTickets[ticketId]?.quantity || 0;
  };

  const selectTicket = (ticketId: string) => {
    const ticket = event?.ticketTypes.find(t => t.id === ticketId);
    if (!ticket) return;
    
    const currentQuantity = selectedTickets[ticketId]?.quantity || 0;
    setSelectedTickets({
      ...selectedTickets,
      [ticketId]: {
        name: ticket.name,
        price: ticket.price,
        fee: ticket.fee,
        quantity: currentQuantity > 0 ? currentQuantity : 1,
      }
    });
    if (highlightedTicketId === ticketId) {
      setHighlightedTicketId(null);
    }
  };

  const handleApplyPromo = async () => {
    setPromoError(null);
    if (!promoCode.trim()) {
      setPromoApplied(null);
      return;
    }

    setIsApplyingPromo(true);
    try {
      const promotion = await fetchPromotion(promoCode);
      if (!promotion) {
        setPromoApplied(null);
        setPromoError("This promo code is invalid or expired.");
        return;
      }
      setPromoApplied(promotion);
      setPromoError(null);
      toast.success(`Promo ${promotion.code} applied.`);
    } catch (err) {
      console.error("Apply promo error:", err);
      setPromoApplied(null);
      setPromoError("Failed to validate promo code.");
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const resetPromo = () => {
    setPromoApplied(null);
    setPromoCode("");
    setPromoError(null);
  };

  const getTicketDisplayName = (ticketName: string) => {
    if (ticketName.toLowerCase().includes('female')) {
      return 'Female - General Admission';
    }
    if (ticketName.toLowerCase().includes('male')) {
      return 'Male - General Admission';
    }
    if (ticketName.toLowerCase().includes('expedited')) {
      return 'Expedited Entry Admission';
    }
    if (ticketName.toLowerCase().includes('vip')) {
      return 'VIP - General Admission';
    }
    return ticketName;
  };

  const handleCheckout = async () => {
    const ticketsWithQuantity = Object.entries(selectedTickets).filter(([_, ticket]) => ticket.quantity > 0);
    
    if (ticketsWithQuantity.length === 0 || !event) {
      setError("Please select at least one ticket");
      toast.error("Please select at least one ticket");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const eventId = searchParams.get("event") || "";
      
      const ticketsData = ticketsWithQuantity.map(([ticketId, ticket]) => ({
        id: ticketId,
        name: ticket.name,
        quantity: ticket.quantity,
        price: ticket.price,
        fee: ticket.fee,
      }));

      // Check availability before proceeding to payment (non-blocking)
      const scannerApiUrl = import.meta.env.VITE_SCANNER_API_URL || import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (scannerApiUrl && supabaseAnonKey) {
        try {
          const checkAvailabilityUrl = `${scannerApiUrl}/functions/v1/check-availability`;
          
          const availabilityResponse = await fetch(checkAvailabilityUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              eventId,
              ticketRequests: ticketsData.map(t => ({
                ticketTypeId: t.id,
                quantity: t.quantity,
              })),
            }),
          });

          if (availabilityResponse.ok) {
            const availabilityResult = await availabilityResponse.json();
            
            if (!availabilityResult.available) {
              const errorMsg = availabilityResult.errors?.join(', ') || 'Tickets are no longer available';
              console.warn('Availability check indicates tickets unavailable:', errorMsg);
              // Show warning but don't block - let payment page handle it
              toast.warning(errorMsg);
              // Continue to payment page anyway
            }
          } else {
            // Log but don't block navigation if availability check fails
            console.warn('Availability check failed, proceeding anyway:', availabilityResponse.status);
          }
        } catch (availabilityError) {
          // Log but don't block navigation if availability check errors
          console.warn('Availability check error, proceeding anyway:', availabilityError);
        }
      }

      // Encode tickets data for URL
      const ticketsParam = encodeURIComponent(JSON.stringify(ticketsData));
      
      // Redirect to payment page
      const params = new URLSearchParams({
        event: eventId,
        tickets: ticketsParam,
      });

      if (promoApplied) {
        params.set("promoCode", promoApplied.code);
      }

      // Add VIP invite code if present
      if (vipInviteCode) {
        params.set("vipInviteCode", vipInviteCode);
      }

      const paymentUrl = `/payment?${params.toString()}`;

      // Reset loading state before navigation
      setIsLoading(false);
      
      // Navigate to payment page
      navigate(paymentUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process checkout";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsLoading(false);
      console.error('Checkout error:', err);
    }
  };

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-forest-950 text-stone-300 overflow-x-hidden">
        <CustomCursor />
        <div className="noise-overlay" />
        <header className="relative z-50 border-b border-white/5 bg-forest-950/80 backdrop-blur-md sticky top-0">
          <div className="container mx-auto px-4 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="font-mono text-xs tracking-[0.2em] uppercase group">
                MAGUEY <span className="text-copper-400">/</span> DE
              </Link>
            </div>
          </div>
        </header>
        <section className="relative z-10 py-12 lg:py-20">
          <div className="container mx-auto px-4 lg:px-8 max-w-7xl">
            <div className="grid lg:grid-cols-[42%_58%] gap-8 lg:gap-12 items-start">
              <div className="relative">
                <div className="aspect-[3/4] relative overflow-hidden rounded-sm glass-panel p-2">
                  <div className="w-full h-full bg-stone-800/50 rounded-sm animate-pulse" />
                </div>
              </div>
              <div className="space-y-6">
                <EventCardSkeleton />
                <div className="glass-panel rounded-sm p-4 space-y-4">
                  <TicketCardSkeleton />
                  <TicketCardSkeleton />
                  <TicketCardSkeleton />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="font-serif text-2xl text-stone-100 mb-2">Event Not Found</h2>
          <p className="text-stone-400 mb-4">{error || "The event you're looking for doesn't exist"}</p>
          <Button onClick={() => navigate('/')} className="bg-copper-400 hover:bg-copper-500 text-forest-950">Back to Events</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest-950 text-stone-300 overflow-x-hidden">
      <h1 className="sr-only">Checkout</h1>
      
      {/* Custom Cursor */}
      <CustomCursor />
      
      {/* Noise Overlay */}
      <div className="noise-overlay" />
      
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
        <svg width="100%" height="100%">
          <pattern id="checkout-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-copper-400" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#checkout-grid)" />
        </svg>
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-white/5 bg-forest-950/80 backdrop-blur-md sticky top-0">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="font-mono text-xs tracking-[0.2em] uppercase group">
              MAGUEY <span className="text-copper-400">/</span> DE
            </Link>
            <div className="flex items-center gap-4">
              <AuthButton />
            </div>
          </div>
        </div>
      </header>

      {/* VIP Invite Banner */}
      {vipReservation && (
        <div className="relative z-20 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-purple-600/20 border-b border-purple-500/30">
          <div className="container mx-auto px-4 lg:px-8 max-w-7xl py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-stone-100 font-medium">
                    You're invited to {vipReservation.purchaser_name}'s VIP Table!
                  </p>
                  <p className="text-sm text-stone-400">
                    Table {vipReservation.table_number} • {vipLinkedCount}/{vipReservation.event_vip_tables?.capacity || 6} guests confirmed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-purple-300">
                <Wine className="w-4 h-4" />
                <span>Purchase your ticket to join the party!</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Hero Section */}
      <section className="relative z-10 py-12 lg:py-20">
        <div className="container mx-auto px-4 lg:px-8 max-w-7xl">
          <div className="grid lg:grid-cols-[42%_58%] gap-8 lg:gap-12 items-start">
            {/* Event Poster - Left Side (~42% width) */}
            <div className="relative">
              <div className="aspect-[3/4] relative overflow-hidden rounded-sm glass-panel p-2">
                <img
                  src={eventImageUrl}
                  alt={event.name}
                  className="w-full h-full object-contain rounded-sm"
                />
              </div>
            </div>

            {/* Event Details and Ticket Selection - Right Side */}
            <div className="space-y-6">
              {/* Event Header */}
              <div>
                <h1 className="font-serif text-4xl lg:text-5xl mb-4 text-stone-100">
                  {event.name.toUpperCase()}
                </h1>
                <p className="text-lg text-copper-400 mb-2">
                  {dateInfo.full}
                </p>
                <p className="text-stone-400">
                  at {eventVenue}
                </p>
              </div>

              {/* Ticket Selection Card - Glass Panel Style */}
              <div className="glass-panel rounded-sm p-4 space-y-0">
                {(() => {
                  // Group tickets by category
                  const groupedTickets = event.ticketTypes.reduce((acc, ticket) => {
                    const category = ticket.category || 'general';
                    if (!acc[category]) {
                      acc[category] = [];
                    }
                    acc[category].push(ticket);
                    return acc;
                  }, {} as Record<string, typeof event.ticketTypes>);

                  // Category order and badge styles
                  const categoryConfig: Record<string, { label: string; badgeClass: string }> = {
                    vip: { label: 'VIP', badgeClass: 'bg-copper-400/20 text-copper-400 border-copper-400/30' },
                    service: { label: 'Service', badgeClass: 'bg-purple-400/20 text-purple-400 border-purple-400/30' },
                    section: { label: 'Section', badgeClass: 'bg-blue-400/20 text-blue-400 border-blue-400/30' },
                    general: { label: 'General', badgeClass: 'bg-stone-400/20 text-stone-400 border-stone-400/30' },
                  };

                  const categoryOrder = ['vip', 'service', 'section', 'general'];

                  return categoryOrder.map((categoryKey) => {
                    const tickets = groupedTickets[categoryKey];
                    if (!tickets || tickets.length === 0) return null;

                    // Filter out VIP ticket types - they're handled by VIP Table reservations
                    const regularTickets = tickets.filter(ticket => {
                      const nameLower = ticket.name.toLowerCase();
                      const isVipTicket = nameLower.includes('vip') && !nameLower.includes('expedited');
                      return !isVipTicket;
                    });

                    if (regularTickets.length === 0) return null;

                    const categoryInfo = categoryConfig[categoryKey];
                    const sortedTickets = [...regularTickets].sort((a, b) => 
                      (a.display_order || 0) - (b.display_order || 0)
                    );

                    return (
                      <div key={categoryKey} className="mb-4 last:mb-0">
                        {categoryKey !== 'general' && (
                          <div className="mb-2 px-2">
                            <Badge className={categoryInfo.badgeClass + ' text-xs'}>
                              {categoryInfo.label}
                            </Badge>
                          </div>
                        )}
                        {sortedTickets.map((ticket, index) => {
                  const ticketQuantity = getTicketQuantity(ticket.id);
                  const isSelected = ticketQuantity > 0;
                  const totalPrice = ticket.price + ticket.fee;
                  const maxQuantity = ticket.limit_per_order ?? 10;
                          const ticketAvail = getTicketAvailability(ticket.code);
                          const isSoldOut = ticketAvail ? ticketAvail.available <= 0 : false;
                          const isLowStock = ticketAvail ? ticketAvail.available > 0 && ticketAvail.available <= 5 : false;
                          const effectiveMaxQuantity = ticketAvail 
                            ? Math.min(maxQuantity, ticketAvail.available)
                            : maxQuantity;
                  
                  const isHighlighted = highlightedTicketId === ticket.id && !isSelected;
                  return (
                    <div key={ticket.id}>
                      {/* Ticket Row */}
                              <div className={`flex items-center justify-between py-3 transition-colors ${isHighlighted ? "bg-copper-400/10 rounded-sm px-2 -mx-2" : ""} ${isSoldOut ? 'opacity-60' : ''}`}>
                        <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-medium text-stone-100">
                              {getTicketDisplayName(ticket.name)}
                            </h3>
                                    {ticket.section_name && (
                                      <Badge variant="outline" className="text-xs border-white/20 text-stone-300">
                                        {ticket.section_name}
                                      </Badge>
                                    )}
                                    {isSoldOut && (
                                      <Badge className="bg-red-500/20 text-red-400 border-red-500/50 text-xs">
                                        Sold Out
                                      </Badge>
                                    )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-4 h-4 text-stone-500 hover:text-stone-300 p-0"
                            >
                              <Info className="w-3 h-3" />
                            </Button>
                          </div>
                                  {ticket.section_description && (
                                    <p className="text-xs text-stone-400 mt-0.5">
                                      {ticket.section_description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-xs text-stone-500">
                            (Includes fees & taxes)
                          </p>
                                    {ticketAvail && ticketAvail.total > 0 && (
                                      <p className="text-xs text-stone-500">
                                        • {ticketAvail.sold}/{ticketAvail.total} sold
                                      </p>
                                    )}
                                  </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-base font-semibold text-stone-100">
                              ${totalPrice.toFixed(0)}
                            </p>
                          </div>
                          {!isSelected && (
                            <Button
                              type="button"
                              size="icon"
                              className="w-9 h-9 rounded-full bg-copper-400 hover:bg-copper-500 text-forest-950 p-0 flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => selectTicket(ticket.id)}
                              disabled={isSoldOut}
                              aria-label={`Add ${getTicketDisplayName(ticket.name)}`}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                          {isSelected && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="w-7 h-7 border-white/20 hover:bg-white/10"
                                onClick={() => updateQuantity(ticket.id, -1)}
                                aria-label={`Remove ${getTicketDisplayName(ticket.name)}`}
                                disabled={ticketQuantity <= 0}
                              >
                                <Minus className="w-3.5 h-3.5 text-stone-300" />
                              </Button>
                              <span className="text-stone-100 font-semibold w-5 text-center text-sm">{ticketQuantity}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="w-7 h-7 border-white/20 hover:bg-white/10"
                                onClick={() => updateQuantity(ticket.id, 1)}
                                aria-label={`Add ${getTicketDisplayName(ticket.name)}`}
                                disabled={ticketQuantity >= effectiveMaxQuantity || isSoldOut}
                              >
                                <Plus className="w-3.5 h-3.5 text-stone-300" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Separator line between tickets */}
                              {index < sortedTickets.length - 1 && (
                        <div className="border-t border-white/10"></div>
                      )}
                    </div>
                  );
                })}
                      </div>
                    );
                  });
                })()}

                {/* VIP Table Reservation CTA */}
                {event?.id && (
                  <div className="mt-6 relative overflow-hidden rounded-sm glass-panel border border-copper-400/20">
                    {/* Subtle shimmer accent */}
                    <div className="absolute inset-0 bg-gradient-to-r from-copper-400/5 via-transparent to-copper-400/5" />
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-copper-400/50 to-transparent" />
                    
                    <div className="relative p-6">
                      <div className="flex items-start gap-4">
                        {/* Icon container */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-sm bg-copper-400/10 border border-copper-400/20 flex items-center justify-center">
                          <Crown className="w-6 h-6 text-copper-400" />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-serif text-lg text-stone-100">VIP Experience</h3>
                            <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-copper-400/20 text-copper-400 rounded-full border border-copper-400/30">
                              Premium
                            </span>
                          </div>
                          <p className="text-stone-400 text-sm mb-4">
                            Elevate your night with bottle service • Tables from $600
                          </p>
                          
                          <Link 
                            to={`/events/${event.id}/vip-tables`}
                            className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-copper-400 hover:bg-copper-500 text-forest-950 font-semibold rounded-sm transition-all duration-200 group"
                          >
                            <span>Reserve Your Table</span>
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </Link>
                        </div>
                      </div>
                      
                      <p className="mt-4 text-stone-500 text-xs text-center border-t border-white/5 pt-4">
                        Table reservation does not include event entry. All guests must purchase GA tickets.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
            </div>
          </div>
        </div>
      </section>

      {/* Floating Checkout Summary - Bottom Right */}
      {(() => {
        const totalQuantity = Object.values(selectedTickets).reduce((sum, ticket) => sum + ticket.quantity, 0);
        return totalQuantity >= 1 && (
          <div className="fixed bottom-0 right-0 left-0 lg:left-auto lg:right-8 lg:bottom-8 z-50 p-4 lg:p-0">
            <div className="bg-forest-900/95 backdrop-blur-md rounded-sm shadow-2xl border border-white/10 p-4 max-w-md mx-auto lg:mx-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative">
                    <Ticket className="w-6 h-6 text-copper-400" />
                    <div className="absolute -top-2 -right-2 bg-copper-400 text-forest-950 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {totalQuantity}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-stone-400">Total due</p>
                    <p className="text-2xl font-semibold text-stone-100">${total.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-stone-400">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fees</span>
                    <span>${serviceFee.toFixed(2)}</span>
                  </div>
                  {promoApplied && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Promo ({promoApplied.code})</span>
                      <span>- ${promoAdjustedTotals.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Promo code"
                        className="bg-forest-950 border-white/10 text-stone-100 placeholder:text-stone-600 sm:flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/20 text-stone-300 hover:bg-white/10"
                        onClick={handleApplyPromo}
                        disabled={isApplyingPromo || isLoading}
                      >
                        {isApplyingPromo ? "Checking..." : "Apply"}
                      </Button>
                      {promoApplied && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-stone-500 hover:text-stone-300"
                          onClick={resetPromo}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    {promoError && (
                      <p className="text-xs text-red-400">{promoError}</p>
                    )}
                  </div>
                </div>

                <LoadingButton
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCheckout();
                  }}
                  isLoading={isLoading}
                  loadingText="Processing payment..."
                  disabled={totalQuantity === 0}
                  className="w-full bg-copper-400 hover:bg-copper-500 text-forest-950 font-semibold py-3 px-6 rounded-sm flex items-center justify-between disabled:opacity-50"
                >
                  <span>Checkout</span>
                  <span className="font-bold">${total.toFixed(2)}</span>
                </LoadingButton>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Events You May Like */}
      {recommendedEvents.length > 0 && (
        <section className="relative z-10 py-16 border-t border-white/5">
          <div className="container mx-auto px-4 lg:px-8 max-w-6xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-serif text-2xl lg:text-3xl text-stone-100">
                    More <span className="italic text-copper-400">Events</span>
                  </h2>
                  {/* Live indicator for real-time event updates */}
                  {eventsIsLive && (
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                      <span className="text-xs text-stone-500">Live</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-stone-500 mt-1">Discover more experiences tailored for you</p>
              </div>
              <Link to="/" className="font-mono text-xs uppercase tracking-widest text-copper-400 hover:text-copper-300">
                View All
              </Link>
            </div>
            <div className="relative overflow-hidden">
              <style>{`
                @keyframes marquee {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-50%); }
                }
                .events-marquee { animation: marquee 35s linear infinite; }
                .events-marquee:hover { animation-play-state: paused; }
              `}</style>
              <div
                className="flex gap-6 events-marquee"
              >
                {[...recommendedEvents, ...recommendedEvents].map((recEvent, idx) => (
                  <div
                    key={`${recEvent.id}-${idx}`}
                    onClick={(e) => handleRecommendedEventClick(recEvent.id, e)}
                    className="w-64 flex-shrink-0 glass-panel rounded-sm overflow-hidden hover:border-copper-400/30 transition cursor-pointer"
                  >
                    <div className="relative h-44 overflow-hidden">
                      <img
                        src={recEvent.image_url || "/placeholder.svg"}
                        alt={recEvent.name}
                        className="w-full h-full object-contain transition-transform duration-500 hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-serif text-lg text-stone-100 line-clamp-2">
                          {recEvent.name}
                        </h3>
                        <p className="text-xs text-stone-400 mt-1">
                          {new Date(recEvent.event_date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                          {" "}•{" "}
                          {(() => {
                            if (!recEvent.event_time) return "10:00 PM";
                            const [hourStr, minuteStr] = recEvent.event_time.split(":");
                            if (!hourStr || !minuteStr) return recEvent.event_time;
                            const time = new Date();
                            time.setHours(Number(hourStr), Number(minuteStr));
                            return time.toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            });
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="text-sm text-stone-400">
                        {recEvent.venue_name || "Maguey Nightclub"}, {recEvent.city || "Wilmington"}
                      </div>
                      <div className="inline-flex w-full items-center justify-center bg-copper-400 hover:bg-copper-500 text-forest-950 text-sm font-semibold py-2 rounded-sm transition">
                        View Event
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-white/5">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-mono text-xs tracking-[0.2em] uppercase mb-4">
                MAGUEY <span className="text-copper-400">/</span> DE
              </h3>
              <p className="text-stone-500 text-sm mb-4">
                Wilmington's Premier Latin Nightlife Experience
              </p>
              <div className="flex gap-3">
                <a href="https://instagram.com/magueynightclub" target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-copper-400 transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="https://facebook.com/magueynightclub" target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-copper-400 transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-stone-300 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-stone-500">
                <li><Link to="/about" className="hover:text-copper-400 transition-colors">About</Link></li>
                <li><Link to="/blog" className="hover:text-copper-400 transition-colors">Blog</Link></li>
                <li><Link to="/" className="hover:text-copper-400 transition-colors">Discover</Link></li>
                <li><Link to="/support" className="hover:text-copper-400 transition-colors">Fan Support</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-stone-300 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-stone-500">
                <li><Link to="/privacy" className="hover:text-copper-400 transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-copper-400 transition-colors">Terms</Link></li>
                <li><Link to="/cookies" className="hover:text-copper-400 transition-colors">Cookie Policy</Link></li>
                <li><Link to="/manage-cookies" className="hover:text-copper-400 transition-colors">Manage Cookies</Link></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 border-t border-white/5 text-center text-sm text-stone-600">
            <p>&copy; {new Date().getFullYear()} Maguey. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Checkout;
