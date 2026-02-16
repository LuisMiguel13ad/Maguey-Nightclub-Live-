/**
 * VIP Table Reservation Page
 * Complete flow: table selection → form → payment
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Music, 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  Crown,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { VipTableSelection } from '@/components/vip/VipTableSelection';
import { VipReservationForm, type ReservationFormData } from '@/components/vip/VipReservationForm';
import { 
  type VipTableWithAvailability,
  createTableReservation,
  checkTableAvailability,
} from '@/lib/vip-tables-service';
import { getEventWithTickets, type EventWithTickets } from '@/lib/events-service';
import { createCheckoutSession, redirectToCheckout } from '@/lib/stripe';

type Step = 'select' | 'form' | 'payment';

const VipTableReservation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const eventId = searchParams.get('event');

  // State
  const [event, setEvent] = useState<EventWithTickets | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [selectedTable, setSelectedTable] = useState<VipTableWithAvailability | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load event data
  useEffect(() => {
    if (!eventId) {
      setError('No event selected');
      setEventLoading(false);
      return;
    }

    setEventLoading(true);
    getEventWithTickets(eventId)
      .then((eventData) => {
        if (!eventData) {
          setError('Event not found');
          setEvent(null);
        } else {
          setEvent(eventData);
        }
      })
      .catch((err) => {
        console.error('Error fetching event:', err);
        setError('Failed to load event');
      })
      .finally(() => {
        setEventLoading(false);
      });
  }, [eventId]);

  // Handle table selection
  const handleSelectTable = (table: VipTableWithAvailability) => {
    setSelectedTable(table);
    setCurrentStep('form');
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle form submission and payment
  const handleFormSubmit = async (formData: ReservationFormData) => {
    if (!selectedTable || !eventId || !event) {
      toast.error('Missing reservation details');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Double-check availability before proceeding
      const isStillAvailable = await checkTableAvailability(eventId, selectedTable.id);
      if (!isStillAvailable) {
        toast.error('This table is no longer available. Please select another table.');
        setCurrentStep('select');
        setSelectedTable(null);
        setIsSubmitting(false);
        return;
      }

      // Create the reservation (pending payment)
      const { reservation, guestPasses } = await createTableReservation({
        eventId,
        tableId: selectedTable.id,
        customerFirstName: formData.firstName,
        customerLastName: formData.lastName,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        guestCount: formData.guestCount,
        bottleChoice: formData.bottleChoice,
        specialRequests: formData.specialRequests,
      });

      // Create Stripe Checkout Session
      const checkoutSession = await createCheckoutSession({
        eventId,
        tickets: [{
          ticketType: `vip_table_${selectedTable.tier}`,
          quantity: 1,
          price: selectedTable.price,
          name: `VIP Table - ${selectedTable.table_name}`,
        }],
        customer: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
        },
        total: selectedTable.price,
        tableId: selectedTable.id,
        metadata: {
          reservationId: reservation.id,
          reservationNumber: reservation.reservation_number,
          tableId: selectedTable.id,
          tableName: selectedTable.table_name,
          guestCount: formData.guestCount,
          bottleChoice: formData.bottleChoice || '',
          isVipTable: true,
        },
      });

      toast.success('Redirecting to payment...');

      // Redirect to Stripe Checkout
      if (checkoutSession.url) {
        window.location.href = checkoutSession.url;
      } else if (checkoutSession.sessionId) {
        await redirectToCheckout(checkoutSession.sessionId);
      } else {
        throw new Error('Failed to get checkout URL');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process reservation';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  // Go back handler
  const handleBack = () => {
    if (currentStep === 'form') {
      setCurrentStep('select');
    }
  };

  // Loading state
  if (eventLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state - no event
  if (!event) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Event Not Found</h2>
          <p className="text-muted-foreground mb-4">{error || "The event you're looking for doesn't exist"}</p>
          <Button onClick={() => navigate('/')}>Back to Events</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        {event.image_url && (
          <img
            src={event.image_url}
            alt={event.name}
            className="w-full h-full object-cover opacity-20"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/90 to-black" />
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3">
                <Crown className="w-8 h-8 text-yellow-500" />
                <span className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-300 bg-clip-text text-transparent">
                  VIP TABLES
                </span>
              </Link>
            </div>

            {/* Breadcrumb */}
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className={currentStep === 'select' ? 'text-white' : 'text-muted-foreground'}>
                Select Table
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className={currentStep === 'form' ? 'text-white' : 'text-muted-foreground'}>
                Your Details
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Payment</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        {/* Back Button */}
        {currentStep === 'form' && (
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-6 text-muted-foreground hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Table Selection
          </Button>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step: Table Selection */}
        {currentStep === 'select' && (
          <VipTableSelection
            eventId={eventId!}
            eventName={event.name}
            eventDate={event.event_date}
            onSelectTable={handleSelectTable}
            selectedTableId={selectedTable?.id}
          />
        )}

        {/* Step: Reservation Form */}
        {currentStep === 'form' && selectedTable && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2">
              <VipReservationForm
                table={selectedTable}
                eventName={event.name}
                eventDate={event.event_date}
                onSubmit={handleFormSubmit}
                isSubmitting={isSubmitting}
                defaultValues={{
                  email: user?.email || '',
                  firstName: user?.user_metadata?.first_name || '',
                  lastName: user?.user_metadata?.last_name || '',
                }}
              />
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                {/* Event Card */}
                <Card className="border-primary/20 overflow-hidden">
                  {event.image_url && (
                    <img
                      src={event.image_url}
                      alt={event.name}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-1">{event.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.event_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {event.venue_name} • {event.city}
                    </p>
                  </CardContent>
                </Card>

                {/* Trust Badges */}
                <Card className="border-border/50 bg-black/40">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Shield className="w-5 h-5 text-green-500" />
                      <span>Secure Payment via Stripe</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Crown className="w-5 h-5 text-yellow-500" />
                      <span>QR Codes for All Guests</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Music className="w-5 h-5 text-primary" />
                      <span>Premium VIP Experience</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 border-t border-white/10 mt-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Maguey. All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default VipTableReservation;
