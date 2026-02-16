/**
 * VIP Purchase Flow Component
 * Complete purchase flow for VIP table reservations
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { VIPTableMap } from './VIPTableMap';
import { VipReservationForm, type ReservationFormData } from './VipReservationForm';
import { 
  type VipTableWithAvailability,
  createTableReservation,
  checkTableAvailability,
  getAvailableTablesForEvent,
} from '@/services/vip-table-service';
import { createCheckoutSession, redirectToCheckout } from '@/lib/stripe';

interface VIPPurchaseFlowProps {
  eventId: string;
  eventName: string;
  eventDate: string;
  onComplete?: (reservationId: string) => void;
}

type Step = 'select' | 'form' | 'processing';

export function VIPPurchaseFlow({
  eventId,
  eventName,
  eventDate,
  onComplete,
}: VIPPurchaseFlowProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [selectedTable, setSelectedTable] = useState<VipTableWithAvailability | null>(null);
  const [tables, setTables] = useState<VipTableWithAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tables
  useEffect(() => {
    const loadTables = async () => {
      try {
        setIsLoading(true);
        const availableTables = await getAvailableTablesForEvent(eventId);
        setTables(availableTables);
      } catch (err) {
        console.error('Error loading VIP tables:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tables');
      } finally {
        setIsLoading(false);
      }
    };

    if (eventId) {
      loadTables();
    } else {
      setError('Event ID is required');
      setIsLoading(false);
    }
  }, [eventId]);

  const handleSelectTable = async (table: VipTableWithAvailability) => {
    if (!table.is_available) {
      toast.error('This table is no longer available');
      return;
    }

    // Double-check availability
    try {
      const isAvailable = await checkTableAvailability(eventId, table.id);
      if (!isAvailable) {
        toast.error('This table was just reserved. Please select another.');
        // Refresh tables
        const { getAvailableTablesForEvent } = await import('@/services/vip-table-service');
        const updatedTables = await getAvailableTablesForEvent(eventId);
        setTables(updatedTables);
        return;
      }

      setSelectedTable(table);
      setCurrentStep('form');
    } catch (err) {
      toast.error('Error checking availability');
      console.error(err);
    }
  };

  const handleFormSubmit = async (formData: ReservationFormData) => {
    if (!selectedTable) {
      toast.error('Please select a table first');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create reservation
      const { reservation } = await createTableReservation({
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

      // Create Stripe checkout session for VIP table
      const sessionId = await createCheckoutSession({
        eventId,
        tickets: [],
        customer: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
        },
        total: selectedTable.price,
        tableId: reservation.id,
        metadata: {
          type: 'vip_table',
          reservationId: reservation.id,
          reservationNumber: reservation.reservation_number,
        },
      });

      // Redirect to Stripe Checkout
      await redirectToCheckout(sessionId);

      if (onComplete) {
        onComplete(reservation.id);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create reservation';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 'form') {
      setCurrentStep('select');
      setSelectedTable(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading VIP tables...</p>
        </CardContent>
      </Card>
    );
  }

  if (error && currentStep === 'select') {
    return (
      <Card>
        <CardContent className="p-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Reserve VIP Table</h2>
          <p className="text-muted-foreground">{eventName} • {eventDate}</p>
        </div>
        {currentStep === 'form' && (
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Selection
          </Button>
        )}
      </div>

      {/* Steps */}
      <div className="flex items-center gap-4 mb-6">
        <div className={cn(
          'flex items-center gap-2',
          currentStep === 'select' ? 'text-primary font-semibold' : 'text-muted-foreground'
        )}>
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            currentStep === 'select' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}>
            1
          </div>
          <span>Select Table</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className={cn(
          'flex items-center gap-2',
          currentStep === 'form' ? 'text-primary font-semibold' : 'text-muted-foreground'
        )}>
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            currentStep === 'form' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}>
            2
          </div>
          <span>Reservation Details</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className={cn(
          'flex items-center gap-2',
          currentStep === 'processing' ? 'text-primary font-semibold' : 'text-muted-foreground'
        )}>
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            currentStep === 'processing' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}>
            3
          </div>
          <span>Payment</span>
        </div>
      </div>

      {/* Content */}
      {currentStep === 'select' && (
        <VIPTableMap
          tables={tables}
          selectedTableId={selectedTable?.id}
          onSelectTable={handleSelectTable}
          eventId={eventId}
          eventName={eventName}
        />
      )}

      {currentStep === 'form' && selectedTable && (
        <div className="space-y-6">
          {/* Selected Table Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Selected Table</CardTitle>
              <CardDescription>{selectedTable.table_name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Capacity</p>
                  <p className="font-semibold">{selectedTable.guest_capacity} guests</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Price</p>
                  <p className="text-2xl font-bold text-primary">
                    ${selectedTable.price.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reservation Form */}
          <VipReservationForm
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
            maxGuests={selectedTable.guest_capacity}
            tablePrice={selectedTable.price}
          />

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {currentStep === 'processing' && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Processing your reservation...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

