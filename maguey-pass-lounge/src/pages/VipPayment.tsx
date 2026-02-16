// src/pages/VipPayment.tsx
/**
 * VIP Payment Page
 * Step 3 of the VIP reservation flow: Payment
 * Uses embedded Stripe Elements for payment processing on the same page
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Wine,
  Users,
  Calendar,
  MapPin,
  CreditCard,
  Lock,
  Shield,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Sparkles,
  Crown,
  PartyPopper,
  Clock,
  QrCode
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { VipProgressIndicator } from '@/components/vip/VipProgressIndicator';
import { CustomCursor } from '@/components/CustomCursor';
import {
  getStripe,
  createVipPaymentIntent,
  confirmVipPayment,
  type VipReservationConfirmation
} from '@/lib/stripe';
import { toast } from 'sonner';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { handlePaymentError } from '@/lib/payment-errors';

interface BookingData {
  eventId: string;
  tableId: string;
  tableNumber: string;
  tablePrice: string;
  tableTier: string;
  tableCapacity: string;
  bottlesIncluded: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  guestCount: number;
  celebration: string;
  celebrantName: string;
  specialRequests: string;
  bottlePreferences: string;
  estimatedArrival: string;
  agreedToTerms: boolean;
}

// Stripe Elements appearance - forest/copper theme
const stripeAppearance = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#5eead4',
    colorBackground: '#0c1810',
    colorText: '#d6d3d1',
    colorDanger: '#f87171',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    spacingUnit: '4px',
    borderRadius: '2px',
  },
  rules: {
    '.Input': {
      backgroundColor: '#162016',
      border: '1px solid rgba(255,255,255,0.1)',
    },
    '.Input:focus': {
      border: '1px solid #5eead4',
      boxShadow: '0 0 0 1px rgba(94,234,212,0.3)',
    },
    '.Label': {
      color: '#a8a29e',
      fontSize: '14px',
      fontWeight: '500',
    },
    '.Tab': {
      backgroundColor: '#162016',
      border: '1px solid rgba(255,255,255,0.1)',
    },
    '.Tab--selected': {
      backgroundColor: '#5eead4',
      borderColor: '#5eead4',
    },
  },
};

// Payment Form Component (uses Stripe hooks)
function PaymentForm({
  bookingData,
  reservationId,
  paymentIntentId,
  onSuccess,
  onError,
  setProcessing: setParentProcessing,
}: {
  bookingData: BookingData;
  reservationId: string;
  paymentIntentId: string;
  onSuccess: (reservation: VipReservationConfirmation) => void;
  onError: (error: Error | unknown) => void;
  setProcessing: (processing: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!stripe || !elements) {
      onError(new Error('Stripe not loaded. Please refresh the page.'));
      return;
    }

    setProcessing(true);
    setParentProcessing(true);

    try {
      // Confirm the payment with Stripe
      const { error: paymentError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href, // Fallback, but we handle inline
          receipt_email: bookingData.email,
        },
        redirect: 'if_required', // Only redirect if required (3D Secure, etc.)
      });

      if (paymentError) {
        onError(paymentError);
        setProcessing(false);
        setParentProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment successful - confirm with backend
        const result = await confirmVipPayment(paymentIntentId, reservationId, bookingData.email);

        if (result.success && result.reservation) {
          onSuccess(result.reservation);
        } else {
          throw new Error('Failed to confirm reservation');
        }
      } else if (paymentIntent && paymentIntent.status === 'processing') {
        // Payment is processing
        toast.info('Payment is processing. You will receive a confirmation shortly.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      onError(err);
    } finally {
      setProcessing(false);
      setParentProcessing(false);
    }
  }, [stripe, elements, bookingData.email, paymentIntentId, reservationId, onSuccess, onError, setParentProcessing]);

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <PaymentElement
        onReady={() => setIsReady(true)}
        options={{
          layout: 'tabs',
        }}
      />

      {/* Pay Button */}
      <button
        type="submit"
        disabled={!stripe || !elements || processing || !isReady}
        className="w-full mt-6 bg-copper-400 hover:bg-copper-500 text-forest-950 font-semibold py-4 rounded-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-copper-400/20"
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing Payment...
          </>
        ) : !isReady ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading Payment Form...
          </>
        ) : (
          <>
            <Lock className="w-5 h-5" />
            Pay ${bookingData.tablePrice}
          </>
        )}
      </button>
    </form>
  );
}

// Confirmation Section Component
function ConfirmationSection({ 
  reservation, 
  eventId 
}: { 
  reservation: VipReservationConfirmation;
  eventId: string;
}) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTier = (tier: string) => {
    return tier?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Standard';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Success Header */}
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-emerald-500/30">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-light text-white mb-2" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
          Reservation Confirmed!
        </h1>
        <p className="text-copper-400/70">Your VIP table has been successfully reserved</p>
        <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
          <span className="text-emerald-400 font-mono text-lg tracking-wider">
            {reservation.reservationNumber}
          </span>
        </div>
      </div>

      {/* Celebration Effect */}
      <div className="flex justify-center gap-2 text-4xl">
        <PartyPopper className="w-8 h-8 text-amber-400 animate-bounce" />
        <Sparkles className="w-8 h-8 text-copper-400 animate-pulse" />
        <Crown className="w-8 h-8 text-purple-400 animate-bounce delay-100" />
      </div>

      {/* Reservation Details Card */}
      <div className="bg-white/[0.02] backdrop-blur-sm rounded-2xl p-6 border border-white/5">
        {/* Event Info */}
        <div className="flex items-start gap-4 pb-6 border-b border-white/5">
          {reservation.event.flyer_url ? (
            <img 
              src={reservation.event.flyer_url} 
              alt={reservation.event.name}
              className="w-20 h-20 rounded-xl object-cover"
            />
          ) : (
            <div className="w-20 h-20 bg-copper-400/20 rounded-xl flex items-center justify-center">
              <Wine className="w-8 h-8 text-copper-400" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-medium text-white">{reservation.event.name}</h2>
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-sm text-copper-400/70 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(reservation.event.event_date)}
              </p>
              <p className="text-sm text-copper-400/70 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {reservation.event.venue_name || 'Maguey Delaware'}
              </p>
            </div>
          </div>
        </div>

        {/* Table Details */}
        <div className="py-6 border-b border-white/5">
          <h3 className="text-sm text-copper-400 uppercase tracking-wider mb-3">Your Table</h3>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl ${
              reservation.table.tier === 'premium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              reservation.table.tier === 'front_row' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
              'bg-copper-400/20 text-copper-400 border border-copper-400/30'
            }`}>
              {reservation.table.table_number}
            </div>
            <div>
              <p className="text-white font-medium text-lg">Table {reservation.table.table_number}</p>
              <p className={`text-sm ${
                reservation.table.tier === 'premium' ? 'text-amber-400' :
                reservation.table.tier === 'front_row' ? 'text-purple-400' :
                'text-copper-400'
              }`}>
                {formatTier(reservation.table.tier)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-forest-900 rounded-lg p-3 text-center">
              <Users className="w-5 h-5 text-copper-400 mx-auto mb-1" />
              <p className="text-white font-medium">{reservation.guestCount}</p>
              <p className="text-xs text-copper-400/60">Guests</p>
            </div>
            <div className="bg-forest-900 rounded-lg p-3 text-center">
              <Wine className="w-5 h-5 text-copper-400 mx-auto mb-1" />
              <p className="text-white font-medium">{reservation.table.bottles_included}</p>
              <p className="text-xs text-copper-400/60">Bottles</p>
            </div>
            <div className="bg-forest-900 rounded-lg p-3 text-center">
              <Clock className="w-5 h-5 text-copper-400 mx-auto mb-1" />
              <p className="text-white font-medium text-sm">{reservation.estimatedArrival || 'TBD'}</p>
              <p className="text-xs text-copper-400/60">Arrival</p>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="py-6 border-b border-white/5">
          <h3 className="text-sm text-copper-400 uppercase tracking-wider mb-3">Reservation Details</h3>
          <div className="space-y-2">
            <p className="text-white">{reservation.customerName}</p>
            <p className="text-copper-400/70 text-sm">{reservation.email}</p>
            {reservation.phone && (
              <p className="text-copper-400/70 text-sm">{reservation.phone}</p>
            )}
          </div>
        </div>

        {/* Payment Info */}
        <div className="pt-6">
          <div className="flex justify-between items-center">
            <span className="text-copper-400/70">Total Paid</span>
            <span className="text-2xl font-bold text-white">${reservation.amount}</span>
          </div>
          <p className="text-xs text-stone-600 mt-1 text-right">+ tax & gratuity at venue</p>
        </div>
      </div>

      {/* QR Code Note */}
      <div className="bg-copper-400/10 border border-copper-400/20 rounded-sm p-4 flex items-start gap-3">
        <QrCode className="w-6 h-6 text-copper-400 flex-shrink-0" />
        <div>
          <p className="text-stone-300 font-medium">Guest Passes</p>
          <p className="text-sm text-copper-400/70">
            QR passes for your party will be available in your account dashboard. 
            Share them with your guests for easy check-in.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link 
          to="/account" 
          className="flex-1 bg-copper-400 hover:bg-copper-500 text-forest-950 font-semibold py-3 rounded-sm transition-all flex items-center justify-center gap-2"
        >
          <QrCode className="w-5 h-5" />
          View Guest Passes
        </Link>
        <Link 
          to={`/events/${eventId}`}
          className="flex-1 bg-[#0d1f1f] border border-white/5 text-stone-300 font-medium py-3 rounded-xl hover:bg-copper-400/5 transition-all flex items-center justify-center gap-2"
        >
          Buy GA Tickets
        </Link>
      </div>

      {/* Important Notice */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <p className="text-amber-400 font-medium text-sm mb-2">⚠️ Important Reminders</p>
        <ul className="text-xs text-amber-300/70 space-y-1">
          <li>• All guests need General Admission tickets for event entry</li>
          <li>• VIP table is held for 30 minutes past your arrival time</li>
          <li>• Tax and gratuity for bottle service paid at venue</li>
          <li>• A confirmation email has been sent to {reservation.email}</li>
        </ul>
      </div>
    </div>
  );
}

// Main VipPayment Component
export default function VipPayment() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const tableId = searchParams.get('tableId');
  
  const [event, setEvent] = useState<any>(null);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);

  // Stripe state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [initializingPayment, setInitializingPayment] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Confirmation state
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [confirmedReservation, setConfirmedReservation] = useState<VipReservationConfirmation | null>(null);

  // Ref for retry callback - will be set by PaymentForm
  const retryPaymentRef = useRef<(() => void) | null>(null);

  // Get Stripe promise
  const stripePromise = getStripe();

  useEffect(() => {
    loadData();
  }, [eventId, tableId]);

  const loadData = async () => {
    // Payment is now integrated into the booking form
    // Redirect users to the booking form if they land here directly
    const storedData = sessionStorage.getItem('vipBookingData');
    if (!storedData) {
      // No booking data - redirect to table selection
      navigate(`/events/${eventId}/vip-tables`);
      return;
    }
    
    // If user has booking data but lands here, redirect to booking form
    // Payment is now handled there
    const parsedData = JSON.parse(storedData) as BookingData;
    if (parsedData.tableId) {
      navigate(`/events/${eventId}/vip-booking?tableId=${parsedData.tableId}&tableNumber=${parsedData.tableNumber}&price=${parsedData.tablePrice}&tier=${parsedData.tableTier}&capacity=${parsedData.tableCapacity}&bottles=${parsedData.bottlesIncluded}`);
      return;
    }
    
    setBookingData(parsedData);
    
    // Load event data
    if (eventId) {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (data) setEvent(data);
    }
    
    setLoading(false);
  };

  // Initialize payment intent when booking data is ready
  useEffect(() => {
    if (bookingData && !clientSecret && !initializingPayment && !paymentComplete) {
      initializePayment();
    }
  }, [bookingData, clientSecret, initializingPayment, paymentComplete]);

  const initializePayment = async () => {
    if (!bookingData || !eventId || !tableId) return;
    
    setInitializingPayment(true);
    setError('');
    
    try {
      const result = await createVipPaymentIntent({
        eventId,
        tableId,
        tableNumber: bookingData.tableNumber,
        tableTier: bookingData.tableTier,
        tablePrice: bookingData.tablePrice,
        tableCapacity: bookingData.tableCapacity,
        bottlesIncluded: bookingData.bottlesIncluded,
        customerEmail: bookingData.email,
        customerName: `${bookingData.firstName} ${bookingData.lastName}`,
        customerPhone: bookingData.phone,
        guestCount: bookingData.guestCount,
        celebration: bookingData.celebration,
        celebrantName: bookingData.celebrantName,
        specialRequests: bookingData.specialRequests,
        bottlePreferences: bookingData.bottlePreferences,
        estimatedArrival: bookingData.estimatedArrival,
      });
      
      setClientSecret(result.clientSecret);
      setPaymentIntentId(result.paymentIntentId);
      setReservationId(result.reservationId);
    } catch (err) {
      console.error('Payment initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize payment');
    } finally {
      setInitializingPayment(false);
    }
  };

  const handlePaymentSuccess = (reservation: VipReservationConfirmation) => {
    // Clear session storage
    sessionStorage.removeItem('vipBookingData');

    // Update state to show confirmation
    setConfirmedReservation(reservation);
    setPaymentComplete(true);

    toast.success('Payment successful! Your reservation is confirmed.');
  };

  // Wrapper for error handler - uses shared utility for consistent UX
  const handlePaymentErrorCallback = useCallback((error: Error | unknown) => {
    handlePaymentError(error, {
      onRetry: () => {
        // Scroll to payment form and focus - user can click Pay again
        const paymentSection = document.querySelector('[data-payment-form]');
        if (paymentSection) {
          paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Toast already dismissed, just focus the form
        setProcessingPayment(false);
      },
      setIsLoading: setProcessingPayment,
      customerEmail: bookingData?.email,
      paymentType: 'vip_reservation',
      eventId: eventId || undefined,
    });
  }, [bookingData?.email, eventId]);

  const formatTier = (tier: string) => {
    return tier?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Standard';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // Check for canceled payment
  useEffect(() => {
    if (searchParams.get('canceled') === 'true') {
      toast.error('Payment was canceled. Please try again.');
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-copper-400" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Loading Payment...
        </p>
      </div>
    );
  }

  if (!bookingData) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Booking Not Found</h2>
          <p className="text-stone-500 mb-4">Please start your reservation again.</p>
          <button
            onClick={() => navigate(`/events/${eventId}/vip-tables`)}
            className="px-6 py-2 bg-copper-400 text-forest-950 rounded-sm hover:bg-copper-500 transition-colors"
          >
            Back to Table Selection
          </button>
        </div>
      </div>
    );
  }

  // Show confirmation after successful payment
  if (paymentComplete && confirmedReservation) {
    return (
      <div className="min-h-screen bg-forest-950 text-stone-300 overflow-x-hidden">
        {/* Custom Cursor */}
        <CustomCursor />
        
        {/* Noise Overlay */}
        <div className="noise-overlay" />
        
        {/* Grid Background */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
          <svg width="100%" height="100%">
            <pattern id="confirm-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-copper-400" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#confirm-grid)" />
          </svg>
        </div>

        {/* Header */}
        <header className="bg-forest-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg font-light text-stone-100 tracking-wide" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                  Reservation <span className="italic text-copper-400">Confirmed</span>
                </h1>
                <p className="text-sm text-stone-500">{event?.name}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Progress Indicator */}
        <div className="w-full bg-forest-900/50 border-b border-white/5 py-4 px-4">
          <div className="max-w-4xl mx-auto">
            <VipProgressIndicator currentStep="confirmation" />
          </div>
        </div>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 relative z-10">
          <ConfirmationSection 
            reservation={confirmedReservation} 
            eventId={eventId || ''} 
          />
        </main>
      </div>
    );
  }

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

      {/* Header */}
      <header className="bg-forest-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="text-copper-400/70 hover:text-copper-400 p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-light text-stone-100 tracking-wide" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>Complete <span className="italic text-copper-400">Payment</span></h1>
              <p className="text-sm text-stone-500">{event?.name}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
              <Calendar className="w-3.5 h-3.5 text-copper-400" />
              <span className="text-stone-300 text-xs font-medium">{formatDate(event?.event_date)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="w-full bg-forest-900/50 border-b border-white/5 py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <VipProgressIndicator currentStep="payment" />
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Payment Section - 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Order Review */}
            <div className="bg-white/[0.02] backdrop-blur-sm rounded-2xl p-6 border border-white/5">
              <h2 className="text-lg text-stone-100 mb-4 flex items-center gap-3" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                <div className="w-8 h-8 rounded-full bg-copper-400/10 border border-copper-400/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-copper-400" />
                </div>
                <span className="font-light tracking-wide">Review Your Order</span>
              </h2>
              
              {/* Table Summary Card */}
              <div className="bg-forest-900 rounded-xl p-4 border border-white/10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-2xl ${
                      bookingData.tableTier === 'premium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      bookingData.tableTier === 'front_row' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                      'bg-copper-400/20 text-copper-400 border border-copper-400/30'
                    }`}>
                      {bookingData.tableNumber}
                    </div>
                    <div>
                      <p className="font-medium text-stone-100 text-lg">Table {bookingData.tableNumber}</p>
                      <p className={`text-sm ${
                        bookingData.tableTier === 'premium' ? 'text-amber-400' :
                        bookingData.tableTier === 'front_row' ? 'text-purple-400' :
                        'text-copper-400'
                      }`}>
                        {formatTier(bookingData.tableTier)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">${bookingData.tablePrice}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 text-sm text-copper-400/60">
                    <Users className="w-4 h-4" />
                    <span><strong className="text-stone-300">{bookingData.guestCount}</strong> Guests</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-copper-400/60">
                    <Wine className="w-4 h-4" />
                    <span><strong className="text-stone-300">{bookingData.bottlesIncluded}</strong> Bottle{parseInt(bookingData.bottlesIncluded) > 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
              
              {/* Customer Info */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-copper-400 uppercase tracking-wider mb-2">Reservation For</p>
                <p className="text-stone-100 font-medium">{bookingData.firstName} {bookingData.lastName}</p>
                <p className="text-copper-400/60 text-sm">{bookingData.email}</p>
                <p className="text-copper-400/60 text-sm">{bookingData.phone}</p>
              </div>
              
              {/* Special Requests Summary */}
              {(bookingData.celebration || bookingData.bottlePreferences || bookingData.specialRequests) && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-copper-400 uppercase tracking-wider mb-2">Special Requests</p>
                  {bookingData.celebration && (
                    <p className="text-stone-300 text-sm">
                      <span className="text-copper-400/60">Occasion:</span> {bookingData.celebration.replace('_', ' ')}
                      {bookingData.celebrantName && ` - ${bookingData.celebrantName}`}
                    </p>
                  )}
                  {bookingData.bottlePreferences && (
                    <p className="text-stone-300 text-sm">
                      <span className="text-copper-400/60">Bottle Preference:</span> {bookingData.bottlePreferences}
                    </p>
                  )}
                  {bookingData.specialRequests && (
                    <p className="text-stone-300 text-sm">
                      <span className="text-copper-400/60">Notes:</span> {bookingData.specialRequests}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Payment Form */}
            <div className="bg-white/[0.02] backdrop-blur-sm rounded-2xl p-6 border border-white/5">
              <h2 className="text-lg text-stone-100 mb-4 flex items-center gap-3" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                <div className="w-8 h-8 rounded-full bg-copper-400/10 border border-copper-400/20 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-copper-400" />
                </div>
                <span className="font-light tracking-wide">Payment Details</span>
              </h2>
              
              {/* Trust Badges */}
              <div className="flex flex-wrap gap-4 mb-6 p-4 bg-copper-400/5 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 text-sm text-stone-300/70">
                  <Lock className="w-4 h-4 text-green-400" />
                  <span>256-bit SSL Encryption</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-stone-300/70">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span>PCI DSS Compliant</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-stone-300/70">
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  <span>Powered by Stripe</span>
                </div>
              </div>

              {/* Stripe Elements */}
              {initializingPayment ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-copper-400 mx-auto mb-3" />
                    <p className="text-copper-400/70">Initializing secure payment...</p>
                  </div>
                </div>
              ) : clientSecret && paymentIntentId && reservationId ? (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: stripeAppearance,
                  }}
                >
                  <div data-payment-form>
                    <PaymentForm
                      bookingData={bookingData}
                      reservationId={reservationId}
                      paymentIntentId={paymentIntentId}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentErrorCallback}
                      setProcessing={setProcessingPayment}
                    />
                  </div>
                </Elements>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                    <p className="text-red-400/70">Failed to load payment form</p>
                    <button 
                      onClick={initializePayment}
                      className="mt-4 px-4 py-2 bg-copper-400 text-forest-950 rounded-sm hover:bg-copper-500 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
              
              <p className="text-center text-xs text-stone-600 mt-4">
                Your payment information is encrypted and secure
              </p>
            </div>
          </div>

          {/* Order Summary Sidebar - 2 columns */}
          <div className="lg:col-span-2">
            <div className="bg-white/[0.02] backdrop-blur-sm rounded-2xl p-6 border border-white/5 sticky top-32">
              <h2 className="text-lg text-stone-100 mb-4 font-light tracking-wide" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>Order Summary</h2>
              
              {/* Event Info */}
              <div className="mb-4 pb-4 border-b border-white/5">
                <p className="text-[10px] text-copper-400 mb-1 uppercase tracking-[0.15em] font-medium">Event</p>
                <p className="font-medium text-stone-100">{event?.name}</p>
                <div className="flex flex-col gap-1.5 mt-2">
                  <p className="text-sm text-copper-400/60 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDate(event?.event_date)}
                  </p>
                  <p className="text-sm text-copper-400/60 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    3320 Old Capitol Trail
                  </p>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-3 mb-4 pb-4 border-b border-white/5">
                <div className="flex justify-between text-sm">
                  <span className="text-copper-400/70">Table Reservation</span>
                  <span className="text-stone-300">${bookingData.tablePrice}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-copper-400/70">Service Fee</span>
                  <span className="text-stone-300">$0.00</span>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center">
                <span className="text-copper-400/70 font-medium">Total</span>
                <span className="text-3xl font-bold text-white">${bookingData.tablePrice}</span>
              </div>
              <p className="text-xs text-stone-600 mt-1 text-right">+ tax & gratuity at venue</p>
              
              {/* What's Included */}
              <div className="mt-6 pt-4 border-t border-white/5">
                <p className="text-xs text-copper-400 uppercase tracking-wider mb-3">What's Included</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-stone-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Reserved VIP Table
                  </li>
                  <li className="flex items-center gap-2 text-sm text-stone-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {bookingData.bottlesIncluded} Premium Bottle{parseInt(bookingData.bottlesIncluded) > 1 ? 's' : ''}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-stone-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Dedicated VIP Host
                  </li>
                  <li className="flex items-center gap-2 text-sm text-stone-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    QR Passes for {bookingData.guestCount} Guests
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
