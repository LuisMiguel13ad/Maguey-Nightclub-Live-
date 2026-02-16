// src/pages/VIPBookingForm.tsx

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Wine, Users, Calendar, Phone, Mail, User, PartyPopper, MessageSquare, CreditCard, MapPin, Clock, Sparkles, ChevronDown, Check, Loader2, Lock, Shield, AlertCircle, CheckCircle2, Crown, QrCode } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { VipProgressIndicator } from '@/components/vip/VipProgressIndicator';
import { CustomCursor } from '@/components/CustomCursor';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe, createVipPaymentIntent, confirmVipPayment, type VipReservationConfirmation } from '@/lib/stripe';
import { toast } from 'sonner';

// Custom VIP-styled Select Component
interface VIPSelectOption {
  value: string | number;
  label: string;
}

interface VIPSelectProps {
  options: VIPSelectOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  className?: string;
  hasIcon?: boolean;
}

const VIPSelect = ({ options, value, onChange, placeholder, className = '', hasIcon = false }: VIPSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find(opt => opt.value === value);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div ref={ref} className={`relative ${className}`} style={{ zIndex: isOpen ? 9999 : 'auto' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-forest-900 border border-white/10 rounded-sm ${hasIcon ? 'pl-10' : 'px-4'} pr-10 py-3 text-left text-stone-100 focus:border-copper-400/50 focus:outline-none focus:ring-1 focus:ring-copper-400/30 transition-all`}
        style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
      >
        <span className={selectedOption?.value ? 'text-stone-100' : 'text-stone-600'}>
          {selectedOption?.label || placeholder || 'Select...'}
        </span>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-copper-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div 
          className="absolute left-0 right-0 mt-2 bg-forest-900 border border-white/10 rounded-sm shadow-2xl shadow-black/60"
          style={{ zIndex: 99999 }}
        >
          <div className="max-h-80 overflow-y-auto overflow-x-hidden">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left transition-all flex items-center justify-between group
                  ${option.value === value 
                    ? 'bg-copper-400/10 text-stone-100' 
                    : 'text-stone-400 hover:bg-white/5 hover:text-stone-200'
                  }`}
                style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
              >
                <span className="font-light tracking-wide">{option.label}</span>
                {option.value === value && (
                  <Check className="w-4 h-4 text-copper-400" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface BookingFormData {
  // Contact Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // Party Details
  guestCount: number;
  celebration: string; // birthday, bachelor, bachelorette, anniversary, corporate, other
  celebrantName: string; // Name of person being celebrated (if applicable)
  
  // Special Requests
  specialRequests: string;
  
  // Bottle Preferences (optional)
  bottlePreferences: string;
  
  // Arrival Time
  estimatedArrival: string;
  
  // Terms
  agreedToTerms: boolean;
}

const celebrationOptions = [
  { value: '', label: 'Select occasion (optional)' },
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'bachelor', label: '🎉 Bachelor Party' },
  { value: 'bachelorette', label: '👰 Bachelorette Party' },
  { value: 'anniversary', label: '💕 Anniversary' },
  { value: 'corporate', label: '💼 Corporate Event' },
  { value: 'girls_night', label: '👯 Girls Night Out' },
  { value: 'guys_night', label: '🍻 Guys Night Out' },
  { value: 'promotion', label: '🎊 Promotion/Celebration' },
  { value: 'other', label: '✨ Other' },
];

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
  },
};

// Preload Stripe immediately
const stripePromise = getStripe();

// Embedded Payment Form Component
function EmbeddedPaymentForm({
  onSuccess,
  onError,
  amount,
  reservationId,
  paymentIntentId,
  customerEmail,
}: {
  onSuccess: (reservation: VipReservationConfirmation) => void;
  onError: (error: string) => void;
  amount: string;
  reservationId: string;
  paymentIntentId: string;
  customerEmail: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      onError('Stripe not loaded. Please refresh the page.');
      return;
    }

    setProcessing(true);

    try {
      const { error: paymentError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (paymentError) {
        onError(paymentError.message || 'Payment failed. Please try again.');
        setProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        const result = await confirmVipPayment(paymentIntentId, reservationId, customerEmail);
        if (result.success && result.reservation) {
          onSuccess(result.reservation);
        } else {
          throw new Error('Failed to confirm reservation');
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      onError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        onReady={() => setIsReady(true)}
        options={{ layout: 'tabs' }}
      />

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
            Pay ${amount}
          </>
        )}
      </button>
    </form>
  );
}

export default function VIPBookingForm() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tableId = searchParams.get('tableId');
  const tableNumber = searchParams.get('tableNumber');
  const tablePrice = searchParams.get('price');
  const tableTier = searchParams.get('tier');
  const tableCapacity = searchParams.get('capacity');
  const bottlesIncluded = searchParams.get('bottles') || '1';

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Payment state
  const [showPayment, setShowPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [initializingPayment, setInitializingPayment] = useState(false);

  // Confirmation state
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [confirmedReservation, setConfirmedReservation] = useState<VipReservationConfirmation | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  // GA Ticket state (REQUIRED for VIP checkout)
  const [selectedTicketTier, setSelectedTicketTier] = useState<string | null>(null);
  const [ticketTiers, setTicketTiers] = useState<Array<{id: string; name: string; price: number}>>([]);

  const [formData, setFormData] = useState<BookingFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    guestCount: parseInt(tableCapacity || '6'),
    celebration: '',
    celebrantName: '',
    specialRequests: '',
    bottlePreferences: '',
    estimatedArrival: '10:00 PM',
    agreedToTerms: false,
  });

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  // Fetch GA ticket tiers from ticket_types
  useEffect(() => {
    const fetchTicketTiers = async () => {
      if (!eventId) return;

      try {
        const { data: tiers, error } = await supabase
          .from('ticket_types')
          .select('id, name, price')
          .eq('event_id', eventId)
          .order('price', { ascending: true });

        if (tiers && tiers.length > 0) {
          setTicketTiers(tiers);
          // Auto-select first tier as default
          setSelectedTicketTier(tiers[0].id);
        } else {
          console.warn('No ticket tiers found for event:', eventId);
        }
      } catch (err) {
        console.error('Error fetching ticket tiers:', err);
      }
    };

    fetchTicketTiers();
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) return;
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();
    
    if (data) setEvent(data);
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      setError('Please fill in all required fields');
      return;
    }

    if (!formData.agreedToTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }

    if (formData.guestCount > parseInt(tableCapacity || '8')) {
      setError(`Maximum capacity for this table is ${tableCapacity} guests`);
      return;
    }

    if (!selectedTicketTier) {
      setError('Please select an entry ticket tier');
      return;
    }

    // Initialize payment instead of navigating
    await initializePayment();
  };

  const initializePayment = async () => {
    if (!eventId || !tableId || !tablePrice || !selectedTicketTier) return;

    // Prevent duplicate initialization
    if (clientSecret && paymentIntentId && reservationId) {
      setShowPayment(true);
      return;
    }

    setInitializingPayment(true);
    setError('');

    try {
      // Get selected ticket tier details
      const selectedTier = ticketTiers.find(t => t.id === selectedTicketTier);
      if (!selectedTier) {
        throw new Error('Selected ticket tier not found');
      }

      // Calculate total amount: VIP table + GA ticket
      const vipPrice = parseFloat(tablePrice);
      const ticketPrice = selectedTier.price;
      const totalAmount = vipPrice + ticketPrice;

      const result = await createVipPaymentIntent({
        eventId,
        tableId,
        tableNumber: tableNumber || '',
        tableTier: tableTier || 'standard',
        tablePrice: vipPrice.toString(), // Just VIP table price
        tableCapacity: tableCapacity || '6',
        bottlesIncluded: bottlesIncluded,
        customerEmail: formData.email,
        customerName: `${formData.firstName} ${formData.lastName}`,
        customerPhone: formData.phone,
        guestCount: formData.guestCount,
        celebration: formData.celebration,
        celebrantName: formData.celebrantName,
        specialRequests: formData.specialRequests,
        bottlePreferences: formData.bottlePreferences,
        estimatedArrival: formData.estimatedArrival,
        // GA ticket data (REQUIRED)
        ticketTierId: selectedTier.id,
        ticketTierName: selectedTier.name,
        ticketPriceCents: Math.round(ticketPrice * 100),
      });

      setClientSecret(result.clientSecret);
      setPaymentIntentId(result.paymentIntentId);
      setReservationId(result.reservationId);
      setShowPayment(true);
    } catch (err) {
      console.error('Payment initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize payment. Please try again.');
      toast.error('Failed to initialize payment');
    } finally {
      setInitializingPayment(false);
    }
  };

  const handlePaymentSuccess = async (reservation: VipReservationConfirmation) => {
    setConfirmedReservation(reservation);
    setPaymentComplete(true);
    toast.success('Payment successful! Your reservation is confirmed.');

    // Fetch the invite code (may take a moment to be generated by webhook)
    const fetchInviteCode = async (attempts = 0) => {
      const { data } = await supabase
        .from('vip_reservations')
        .select('invite_code')
        .eq('id', reservation.id)
        .single();

      if (data?.invite_code) {
        setInviteCode(data.invite_code);
      } else if (attempts < 5) {
        // Retry after a short delay (webhook may still be processing)
        setTimeout(() => fetchInviteCode(attempts + 1), 1000);
      }
    };

    fetchInviteCode();
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
    toast.error(errorMessage);
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-copper-400" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Loading Reservation Form...
        </p>
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
          <pattern
            id="booking-grid"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-copper-400"
            />
          </pattern>
          <rect width="100%" height="100%" fill="url(#booking-grid)" />
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
              <h1 className="text-lg font-light text-stone-100 tracking-wide" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>Complete Your <span className="italic text-copper-400">Reservation</span></h1>
              <p className="text-sm text-stone-500">{event?.name}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
              <Calendar className="w-3.5 h-3.5 text-copper-400" />
              <span className="text-stone-300 text-xs font-medium">{formatDate(event?.event_date)}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
              <MapPin className="w-3.5 h-3.5 text-copper-400" />
              <span className="text-stone-300 text-xs font-medium">3320 Old Capitol Trail</span>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="w-full bg-forest-900/50 border-b border-white/5 py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <VipProgressIndicator currentStep={paymentComplete ? "confirmation" : showPayment ? "payment" : "details"} />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 relative z-10">

        {/* Confirmation View */}
        {paymentComplete && confirmedReservation ? (
          <div className="max-w-2xl mx-auto">
            {/* Success Header */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h1 className="text-3xl font-light text-stone-100 mb-2" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                Reservation <span className="italic text-copper-400">Confirmed!</span>
              </h1>
              <p className="text-stone-400">Your VIP table has been successfully reserved.</p>
            </div>

            {/* Confirmation Card */}
            <div className="bg-white/[0.02] backdrop-blur-sm rounded-sm border border-white/10 overflow-hidden mb-6">
              {/* Header with Crown */}
              <div className="bg-gradient-to-r from-copper-400/20 via-copper-400/10 to-transparent p-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-copper-400/20 border border-copper-400/30 flex items-center justify-center">
                    <Crown className="w-7 h-7 text-copper-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-copper-400 uppercase tracking-[0.2em] font-medium">VIP Reservation</p>
                    <p className="text-xl font-light text-stone-100" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                      Table {tableNumber} • {formatTier(tableTier || '')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reservation Details */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Confirmation #</p>
                    <p className="text-stone-100 font-mono text-sm">{confirmedReservation.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Guest Name</p>
                    <p className="text-stone-100">{formData.firstName} {formData.lastName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Event</p>
                    <p className="text-stone-100">{event?.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Date</p>
                    <p className="text-stone-100">{formatDate(event?.event_date)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Guests</p>
                    <p className="text-stone-100">{formData.guestCount} people</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Arrival</p>
                    <p className="text-stone-100">{formData.estimatedArrival}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">Amount Paid</span>
                    <span className="text-2xl font-semibold text-copper-400">${tablePrice}</span>
                  </div>
                </div>
              </div>

              {/* QR Code Section */}
              <div className="bg-forest-900/50 p-6 border-t border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-white rounded-sm p-2 flex items-center justify-center">
                    <QrCode className="w-full h-full text-forest-950" />
                  </div>
                  <div>
                    <p className="text-sm text-stone-300 font-medium mb-1">Show this at check-in</p>
                    <p className="text-xs text-stone-500">A confirmation email with your QR code has been sent to {formData.email}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Invite Link Section */}
            {inviteCode && (
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-sm p-6 mb-6">
                <h3 className="font-semibold text-stone-200 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  Invite Your Guests
                </h3>
                <p className="text-sm text-stone-400 mb-4">
                  Share this link with your guests so they can purchase their GA tickets and be linked to your VIP table.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/checkout?event=${eventId}&vip=${inviteCode}`}
                    className="flex-1 bg-forest-900 border border-white/10 rounded-sm px-4 py-3 text-stone-300 text-sm font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/checkout?event=${eventId}&vip=${inviteCode}`);
                      setInviteLinkCopied(true);
                      toast.success('Invite link copied to clipboard!');
                      setTimeout(() => setInviteLinkCopied(false), 2000);
                    }}
                    className="px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-sm transition-colors flex items-center gap-2"
                  >
                    {inviteLinkCopied ? <Check className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
                    {inviteLinkCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-stone-500 mt-3">
                  Table capacity: {tableCapacity} guests • Share this link for guests to purchase their tickets
                </p>
              </div>
            )}

            {/* What's Next */}
            <div className="bg-copper-400/5 border border-copper-400/20 rounded-sm p-6 mb-6">
              <h3 className="font-semibold text-stone-200 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-copper-400" />
                What's Next?
              </h3>
              <ul className="text-sm text-stone-400 space-y-2">
                <li className="flex gap-2"><span className="text-copper-400">1.</span> Check your email for the confirmation with QR code</li>
                <li className="flex gap-2"><span className="text-copper-400">2.</span> Your QR code grants you entry and identifies you as VIP host for Table {tableNumber}</li>
                <li className="flex gap-2"><span className="text-copper-400">3.</span> Share the invite link above for your guests to purchase tickets</li>
                <li className="flex gap-2"><span className="text-copper-400">4.</span> Arrive by {formData.estimatedArrival} and show your QR code at check-in</li>
                <li className="flex gap-2"><span className="text-copper-400">5.</span> Enjoy your premium VIP experience!</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {confirmedReservation && (
                <Link
                  to={`/vip/dashboard/${confirmedReservation.id}`}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-sm transition-all flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  View Guest List
                </Link>
              )}
              <Link
                to={`/event/${eventId}${inviteCode ? `?vip=${inviteCode}` : ''}`}
                className="flex-1 bg-copper-400 hover:bg-copper-500 text-forest-950 font-semibold py-3 rounded-sm transition-all flex items-center justify-center gap-2"
              >
                Buy More GA Tickets
              </Link>
              <Link
                to="/"
                className="flex-1 bg-white/5 hover:bg-white/10 text-stone-300 font-medium py-3 rounded-sm transition-all flex items-center justify-center gap-2 border border-white/10"
              >
                Back to Events
              </Link>
            </div>
          </div>
        ) : (
        <>
        {/* Event Banner */}
        <section className="mb-8">
          <p className="text-[10px] font-medium text-copper-400 uppercase tracking-[0.2em] mb-3">Featured Event</p>
          
          <div className="relative w-full h-40 sm:h-48 rounded-sm overflow-hidden border border-white/5 bg-forest-900 group">
            {/* Event Image */}
            {event?.image_url && (
              <img 
                src={event.image_url} 
                alt={event?.name} 
                className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 group-hover:scale-105 transition-all duration-[2s]"
              />
            )}
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-forest-950/95 via-forest-950/70 to-transparent z-10" />
            
            {/* Content */}
            <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-center z-20">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-copper-400/10 border border-copper-400/30 text-copper-400 text-[9px] sm:text-[10px] font-medium tracking-widest uppercase rounded-full">
                  VIP Tables
                </span>
                <span className="text-stone-500 text-[9px] sm:text-[10px] font-medium tracking-widest uppercase">
                  {formatDate(event?.event_date)}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-light text-stone-100 tracking-tight" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                <span className="italic">{event?.name?.split(' - ')[0] || event?.name}</span>
              </h2>
              <p className="text-stone-500 text-xs mt-1.5 max-w-md font-light tracking-wide">
                Experience the exclusive VIP treatment at Delaware's premier nightlife destination.
              </p>
            </div>
            
            {/* Live Performance Badge */}
            <div className="absolute top-4 right-4 z-30">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-forest-950/80 backdrop-blur-sm border border-white/10 rounded-full">
                <span className="w-1.5 h-1.5 bg-copper-400 rounded-full animate-pulse" />
                <span className="text-[9px] sm:text-[10px] font-medium text-stone-300 tracking-wider uppercase">
                  Live Performance
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Booking Form - 2 columns */}
          <div className="lg:col-span-2 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-5" style={{ overflow: 'visible' }}>
              
              {/* Contact Information */}
              <div className="bg-white/[0.02] backdrop-blur-sm rounded-sm p-6 border border-white/5">
                <h2 className="text-lg text-stone-100 mb-4 flex items-center gap-3" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                  <div className="w-8 h-8 rounded-full bg-copper-400/10 border border-copper-400/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-copper-400" />
                  </div>
                  <span className="font-light tracking-wide">Contact Information</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-stone-400 mb-1.5 block font-medium">First Name *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      className="w-full bg-forest-900 border border-white/10 rounded-sm px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-copper-400/50 focus:outline-none focus:ring-1 focus:ring-copper-400/30 transition-all"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-stone-400 mb-1.5 block font-medium">Last Name *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      className="w-full bg-forest-900 border border-white/10 rounded-sm px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-copper-400/50 focus:outline-none focus:ring-1 focus:ring-copper-400/30 transition-all"
                      placeholder="Doe"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-stone-400 mb-1.5 block font-medium">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full bg-forest-900 border border-white/10 rounded-sm pl-10 pr-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-copper-400/50 focus:outline-none focus:ring-1 focus:ring-copper-400/30 transition-all"
                        placeholder="you@email.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-stone-400 mb-1.5 block font-medium">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        className="w-full bg-forest-900 border border-white/10 rounded-sm pl-10 pr-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-copper-400/50 focus:outline-none focus:ring-1 focus:ring-copper-400/30 transition-all"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Party Details */}
              <div className="bg-white/[0.02] backdrop-blur-sm rounded-sm p-6 border border-white/5 overflow-visible relative" style={{ zIndex: 10 }}>
                <h2 className="text-lg text-stone-100 mb-4 flex items-center gap-3" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                  <div className="w-8 h-8 rounded-full bg-copper-400/10 border border-copper-400/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-copper-400" />
                  </div>
                  <span className="font-light tracking-wide">Party Details</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ overflow: 'visible' }}>
                  <div>
                    <label className="text-sm text-stone-400 mb-1.5 block font-medium">Number of Guests *</label>
                    <VIPSelect
                      options={Array.from({ length: parseInt(tableCapacity || '8') }, (_, i) => ({
                        value: i + 1,
                        label: `${i + 1} ${i === 0 ? 'Guest' : 'Guests'}`
                      }))}
                      value={formData.guestCount}
                      onChange={(val) => setFormData(prev => ({ ...prev, guestCount: Number(val) }))}
                    />
                    <p className="text-xs text-stone-600 mt-1.5">Max capacity: {tableCapacity} guests</p>
                  </div>
                  <div>
                    <label className="text-sm text-stone-400 mb-1.5 block font-medium">Estimated Arrival</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 z-10 pointer-events-none" />
                      <VIPSelect
                        options={[
                          { value: '9:00 PM', label: '9:00 PM' },
                          { value: '9:30 PM', label: '9:30 PM' },
                          { value: '10:00 PM', label: '10:00 PM' },
                          { value: '10:30 PM', label: '10:30 PM' },
                          { value: '11:00 PM', label: '11:00 PM' },
                          { value: '11:30 PM', label: '11:30 PM' },
                          { value: '12:00 AM', label: '12:00 AM' },
                        ]}
                        value={formData.estimatedArrival}
                        onChange={(val) => setFormData(prev => ({ ...prev, estimatedArrival: String(val) }))}
                        hasIcon={true}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2 relative" style={{ zIndex: 100 }}>
                    <label className="text-sm text-stone-400 mb-1.5 block font-medium">What's the Occasion?</label>
                    <VIPSelect
                      options={celebrationOptions}
                      value={formData.celebration}
                      onChange={(val) => setFormData(prev => ({ ...prev, celebration: String(val) }))}
                      placeholder="Select occasion (optional)"
                    />
                  </div>
                  {formData.celebration && formData.celebration !== 'corporate' && formData.celebration !== 'girls_night' && formData.celebration !== 'guys_night' && (
                    <div className="md:col-span-2">
                      <label className="text-sm text-stone-400 mb-1.5 block font-medium">
                        <PartyPopper className="w-4 h-4 inline mr-1 text-copper-400" />
                        Who are we celebrating? (Optional)
                      </label>
                      <input
                        type="text"
                        name="celebrantName"
                        value={formData.celebrantName}
                        onChange={handleChange}
                        className="w-full bg-forest-900 border border-white/10 rounded-sm px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-copper-400/50 focus:outline-none focus:ring-1 focus:ring-copper-400/30 transition-all"
                        placeholder="Name of birthday person, couple, etc."
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Special Requests */}
              <div className="bg-white/[0.02] backdrop-blur-sm rounded-sm p-6 border border-white/5 relative" style={{ zIndex: 1 }}>
                <h2 className="text-lg text-stone-100 mb-4 flex items-center gap-3" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                  <div className="w-8 h-8 rounded-full bg-copper-400/10 border border-copper-400/20 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-copper-400" />
                  </div>
                  <span className="font-light tracking-wide">Special Requests</span>
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-stone-400 mb-1.5 block font-medium">Bottle Preferences (Optional)</label>
                    <input
                      type="text"
                      name="bottlePreferences"
                      value={formData.bottlePreferences}
                      onChange={handleChange}
                      className="w-full bg-forest-900 border border-white/10 rounded-sm px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-copper-400/50 focus:outline-none focus:ring-1 focus:ring-copper-400/30 transition-all"
                      placeholder="e.g., Hennessy, Don Julio, Grey Goose..."
                    />
                    <p className="text-xs text-stone-600 mt-1.5">{bottlesIncluded} bottle(s) included with your reservation</p>
                  </div>
                  <div>
                    <label className="text-sm text-stone-400 mb-1.5 block font-medium">Additional Requests (Optional)</label>
                    <textarea
                      name="specialRequests"
                      value={formData.specialRequests}
                      onChange={handleChange}
                      rows={3}
                      className="w-full bg-forest-900 border border-white/10 rounded-sm px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-copper-400/50 focus:outline-none focus:ring-1 focus:ring-copper-400/30 transition-all resize-none"
                      placeholder="Decorations, specific seating arrangements, cake, sparklers, etc."
                    />
                  </div>
                </div>
              </div>

              {/* Entry Ticket Selection - REQUIRED */}
              <div className="bg-white/[0.02] backdrop-blur-sm rounded-sm p-6 border border-white/5">
                <h2 className="text-lg text-stone-100 mb-4 flex items-center gap-3" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                  <div className="w-8 h-8 rounded-full bg-copper-400/10 border border-copper-400/20 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-copper-400" />
                  </div>
                  <span className="font-light tracking-wide">Entry Ticket</span>
                  <span className="text-xs text-red-400 font-semibold">*REQUIRED</span>
                </h2>

                <div className="bg-copper-400/5 border border-copper-400/20 rounded-sm p-4 mb-4">
                  <p className="text-sm text-stone-300 font-medium mb-2">
                    VIP table reservation includes bottle service only — entry ticket required.
                  </p>
                  <p className="text-xs text-stone-500">
                    Your unified QR code will grant you entry and identify you as the VIP host for Table {tableNumber}.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm text-stone-400 mb-2 block font-medium">Select Your Entry Ticket *</label>
                  {ticketTiers.length === 0 ? (
                    <div className="text-sm text-stone-500 italic">Loading ticket options...</div>
                  ) : (
                    ticketTiers.map((tier) => (
                      <label
                        key={tier.id}
                        className={`flex items-center justify-between p-4 rounded-sm border cursor-pointer transition-all ${
                          selectedTicketTier === tier.id
                            ? 'bg-copper-400/10 border-copper-400/50'
                            : 'bg-forest-900 border-white/10 hover:border-copper-400/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="ticketTier"
                            value={tier.id}
                            checked={selectedTicketTier === tier.id}
                            onChange={(e) => setSelectedTicketTier(e.target.value)}
                            className="w-5 h-5 text-copper-400 bg-forest-900 border-white/20 focus:ring-copper-400/50"
                          />
                          <div>
                            <p className="font-medium text-stone-100">{tier.name}</p>
                            <p className="text-xs text-stone-500">Includes event entry</p>
                          </div>
                        </div>
                        <span className="text-lg font-semibold text-copper-400">${tier.price.toFixed(2)}</span>
                      </label>
                    ))
                  )}
                </div>

                {selectedTicketTier && (
                  <div className="mt-4 flex justify-between items-center p-3 bg-copper-400/10 border border-copper-400/20 rounded-sm">
                    <span className="text-stone-300">1 × {ticketTiers.find(t => t.id === selectedTicketTier)?.name}</span>
                    <span className="font-semibold text-copper-400">${ticketTiers.find(t => t.id === selectedTicketTier)?.price.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Terms & Conditions */}
              <div className="bg-copper-400/5 border border-copper-400/20 rounded-sm p-6">
                <h3 className="font-semibold text-stone-200 mb-3">Important Information</h3>
                <ul className="text-sm text-stone-400 space-y-2 mb-4">
                  <li className="flex gap-2"><span className="text-copper-400">•</span> Table reservation is for <strong className="text-stone-200">bottle service only</strong> and does not include event entry.</li>
                  <li className="flex gap-2"><span className="text-copper-400">•</span> All guests must purchase separate General Admission tickets.</li>
                  <li className="flex gap-2"><span className="text-copper-400">•</span> Price does not include tax and gratuity (paid at venue).</li>
                  <li className="flex gap-2"><span className="text-copper-400">•</span> Tables are held for 30 minutes past estimated arrival time.</li>
                  <li className="flex gap-2"><span className="text-copper-400">•</span> Cancellations must be made 48 hours in advance for a full refund.</li>
                </ul>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    name="agreedToTerms"
                    checked={formData.agreedToTerms}
                    onChange={handleChange}
                    className="mt-1 w-5 h-5 rounded bg-forest-900 border-white/20 text-copper-400 focus:ring-copper-400/50 cursor-pointer"
                  />
                  <span className="text-sm text-stone-400 group-hover:text-stone-200 transition-colors">
                    I understand and agree to the reservation terms and conditions *
                  </span>
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Payment Section - Shows after form validation */}
              {showPayment && clientSecret && paymentIntentId && reservationId ? (
                <div className="bg-white/[0.02] backdrop-blur-sm rounded-sm p-6 border border-white/5">
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
                      <span>256-bit SSL</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-stone-300/70">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span>PCI Compliant</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-stone-300/70">
                      <CreditCard className="w-4 h-4 text-purple-400" />
                      <span>Powered by Stripe</span>
                    </div>
                  </div>

                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: stripeAppearance,
                    }}
                  >
                    <EmbeddedPaymentForm
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      amount={(parseFloat(tablePrice || '0') + (ticketTiers.find(t => t.id === selectedTicketTier)?.price || 0)).toFixed(2)}
                      reservationId={reservationId}
                      paymentIntentId={paymentIntentId}
                      customerEmail={formData.email}
                    />
                  </Elements>

                  <p className="text-center text-xs text-stone-600 mt-4">
                    Your payment information is encrypted and secure
                  </p>
                </div>
              ) : (
                /* Submit Button - Shows before payment */
                <button
                  type="submit"
                  disabled={submitting || initializingPayment || !selectedTicketTier}
                  className="w-full bg-copper-400 hover:bg-copper-500 text-forest-950 font-semibold py-4 rounded-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-copper-400/20"
                >
                  {initializingPayment ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Preparing Payment...
                    </>
                  ) : submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : !selectedTicketTier ? (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Select Entry Ticket to Continue
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Continue to Payment
                    </>
                  )}
                </button>
              )}
            </form>
          </div>

          {/* Order Summary - 1 column */}
          <div className="lg:col-span-1">
            <div className="bg-white/[0.02] backdrop-blur-sm rounded-sm p-6 border border-white/5 sticky top-24">
              <h2 className="text-lg text-stone-100 mb-4 font-light tracking-wide" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>Reservation Summary</h2>
              
              {/* Table Info */}
              <div className="bg-forest-900 rounded-sm p-4 mb-4 border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-sm flex items-center justify-center font-bold text-xl ${
                    tableTier === 'premium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    tableTier === 'front_row' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                    'bg-copper-400/20 text-copper-400 border border-copper-400/30'
                  }`}>
                    {tableNumber}
                  </div>
                  <div>
                    <p className="font-medium text-stone-100">Table {tableNumber}</p>
                    <p className={`text-sm ${
                      tableTier === 'premium' ? 'text-amber-400' :
                      tableTier === 'front_row' ? 'text-purple-400' :
                      'text-copper-400'
                    }`}>
                      {formatTier(tableTier || '')}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between text-stone-500">
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4" /> Capacity
                    </span>
                    <span className="text-stone-300 font-medium">{tableCapacity} guests</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span className="flex items-center gap-2">
                      <Wine className="w-4 h-4" /> Bottles Included
                    </span>
                    <span className="text-stone-300 font-medium">{bottlesIncluded}</span>
                  </div>
                </div>
              </div>

              {/* Event Info */}
              <div className="mb-4 pb-4 border-b border-white/5">
                <p className="text-[10px] text-copper-400 mb-1 uppercase tracking-[0.15em] font-medium">Event</p>
                <p className="font-medium text-stone-100">{event?.name}</p>
                <div className="flex flex-col gap-1.5 mt-2">
                  <p className="text-sm text-stone-500 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {formatDate(event?.event_date)}
                  </p>
                  <p className="text-sm text-stone-500 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    3320 Old Capitol Trail
                  </p>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-500">VIP Table {tableNumber}</span>
                  <span className="text-stone-300">${tablePrice}</span>
                </div>

                {selectedTicketTier && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-500">Entry Ticket (Host)</span>
                    <span className="text-stone-300">${ticketTiers.find(t => t.id === selectedTicketTier)?.price.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-stone-400 font-medium">Total</span>
                  <span className="text-2xl font-semibold text-stone-100">
                    ${(parseFloat(tablePrice || '0') + (ticketTiers.find(t => t.id === selectedTicketTier)?.price || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-stone-600 mt-1">+ tax & gratuity at venue</p>
            </div>
          </div>
        </div>
        </>
        )}
      </main>
    </div>
  );
}

