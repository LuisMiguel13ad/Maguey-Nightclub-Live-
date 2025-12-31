// src/pages/VipCheckoutSuccess.tsx
/**
 * VIP Checkout Success Page
 * Handles post-payment flow: creates reservation and shows confirmation
 */

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Crown,
  CheckCircle2,
  Mail,
  Users,
  Wine,
  MapPin,
  Calendar,
  Loader2,
  AlertCircle,
  QrCode,
  Download,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VipProgressIndicator } from '@/components/vip/VipProgressIndicator';
import { supabase } from '@/lib/supabase';
import QRCode from 'qrcode';

interface ReservationDetails {
  id: string;
  reservationNumber: string;
  eventName: string;
  eventDate: string;
  tableName: string;
  tableNumber: string;
  tier: string;
  price: number;
  guestCount: number;
  bottles: number;
  customerName: string;
  customerEmail: string;
  qrCodes: { guestNumber: number; qrDataUrl: string }[];
}

export default function VipCheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationDetails | null>(null);

  // Get URL params
  const sessionId = searchParams.get('session_id');
  const orderId = searchParams.get('orderId');
  const eventId = searchParams.get('eventId');
  const tableId = searchParams.get('tableId');
  const tableNumber = searchParams.get('tableNumber');
  const tableTier = searchParams.get('tableTier');
  const tablePrice = searchParams.get('tablePrice');
  const bottles = searchParams.get('bottles');
  const firstName = searchParams.get('firstName');
  const lastName = searchParams.get('lastName');
  const email = searchParams.get('email');
  const guestCount = searchParams.get('guestCount');

  useEffect(() => {
    processPaymentSuccess();
  }, [sessionId, orderId]);

  const processPaymentSuccess = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // If we have an orderId, fetch the order details
      if (orderId) {
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (orderError) {
          console.error('Error fetching order:', orderError);
        }

        // Fetch event details
        let eventData = null;
        if (eventId) {
          const { data: event } = await supabase
            .from('events')
            .select('name, event_date, venue_name')
            .eq('id', eventId)
            .single();
          eventData = event;
        }

        // Generate QR codes for guests
        const guests = parseInt(guestCount || '6');
        const qrCodes = await generateGuestQrCodes(orderId, guests);

        // Generate a reservation number
        const reservationNumber = `VIP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

        setReservation({
          id: orderId,
          reservationNumber,
          eventName: eventData?.name || 'VIP Event',
          eventDate: eventData?.event_date || '',
          tableName: `Table ${tableNumber}`,
          tableNumber: tableNumber || '0',
          tier: 'VIP',
          price: order?.total || 0,
          guestCount: guests,
          bottles: 1,
          customerName: `${firstName || ''} ${lastName || ''}`.trim() || 'Guest',
          customerEmail: email || order?.purchaser_email || '',
          qrCodes,
        });
      } else {
        // Fallback: try to get data from sessionStorage
        const storedData = sessionStorage.getItem('vipBookingData');
        if (storedData) {
          const bookingData = JSON.parse(storedData);
          const qrCodes = await generateGuestQrCodes(sessionId || 'temp', bookingData.guestCount);
          
          // Fetch event details
          let eventData = null;
          if (bookingData.eventId) {
            const { data: event } = await supabase
              .from('events')
              .select('name, event_date, venue_name')
              .eq('id', bookingData.eventId)
              .single();
            eventData = event;
          }

          const reservationNumber = `VIP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

          setReservation({
            id: sessionId || 'temp',
            reservationNumber,
            eventName: eventData?.name || 'VIP Event',
            eventDate: eventData?.event_date || '',
            tableName: `Table ${bookingData.tableNumber}`,
            tableNumber: bookingData.tableNumber,
            tier: bookingData.tableTier,
            price: parseFloat(bookingData.tablePrice),
            guestCount: bookingData.guestCount,
            bottles: parseInt(bookingData.bottlesIncluded),
            customerName: `${bookingData.firstName} ${bookingData.lastName}`,
            customerEmail: bookingData.email,
            qrCodes,
          });

          sessionStorage.removeItem('vipBookingData');
        } else if (email && tableNumber) {
          // Use URL params as fallback
          const guests = parseInt(guestCount || '6');
          const qrCodes = await generateGuestQrCodes(sessionId || 'temp', guests);
          
          let eventData = null;
          if (eventId) {
            const { data: event } = await supabase
              .from('events')
              .select('name, event_date, venue_name')
              .eq('id', eventId)
              .single();
            eventData = event;
          }

          const reservationNumber = `VIP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

          setReservation({
            id: sessionId || 'temp',
            reservationNumber,
            eventName: eventData?.name || 'VIP Event',
            eventDate: eventData?.event_date || '',
            tableName: `Table ${tableNumber}`,
            tableNumber: tableNumber,
            tier: tableTier || 'VIP',
            price: tablePrice ? parseFloat(tablePrice) : 0,
            guestCount: guests,
            bottles: bottles ? parseInt(bottles) : 1,
            customerName: `${firstName || ''} ${lastName || ''}`.trim() || 'Guest',
            customerEmail: email,
            qrCodes,
          });
        } else {
          setError('Unable to find reservation details. Please contact support.');
        }
      }
    } catch (err) {
      console.error('Error processing payment success:', err);
      setError('Failed to load reservation details. Please contact support with your confirmation email.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateGuestQrCodes = async (reservationId: string, guestCount: number) => {
    const qrCodes: { guestNumber: number; qrDataUrl: string }[] = [];
    
    for (let i = 1; i <= guestCount; i++) {
      const qrData = JSON.stringify({
        type: 'vip_guest',
        reservationId,
        guestNumber: i,
        timestamp: Date.now(),
      });
      
      try {
        const qrDataUrl = await QRCode.toDataURL(qrData, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        qrCodes.push({ guestNumber: i, qrDataUrl });
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    }
    
    return qrCodes;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleShare = async () => {
    if (navigator.share && reservation) {
      try {
        await navigator.share({
          title: `VIP Table Reservation - ${reservation.reservationNumber}`,
          text: `Your VIP table reservation for ${reservation.eventName}`,
          url: window.location.href,
        });
      } catch {
        // Share cancelled by user
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Processing your reservation...</p>
        </div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Something Went Wrong</h2>
          <p className="text-muted-foreground mb-6">{error || 'Unable to load your reservation'}</p>
          <Alert className="mb-6 text-left">
            <Mail className="h-4 w-4" />
            <AlertDescription>
              If you completed payment, check your email for confirmation. Your reservation is still valid.
            </AlertDescription>
          </Alert>
          <Button asChild>
            <Link to="/">Back to Events</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-green-900/30 via-black to-black" />
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <Crown className="w-8 h-8 text-yellow-500" />
              <span className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-300 bg-clip-text text-transparent">
                VIP TABLES
              </span>
            </Link>
            {navigator.share && (
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="relative z-40 w-full bg-black/30 backdrop-blur-sm border-b border-white/5 py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <VipProgressIndicator currentStep="confirmation" />
        </div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {/* Success Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Reservation <span className="text-green-500">Confirmed!</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Your VIP table is reserved. Show your QR codes at the entrance.
          </p>
        </div>

        {/* Email Alert */}
        <Alert className="mb-8 border-primary/50 bg-primary/10">
          <Mail className="h-4 w-4" />
          <AlertDescription>
            Confirmation sent to <strong>{reservation.customerEmail}</strong>. 
            Check your inbox (and spam folder) for your QR codes.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reservation Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Reservation Info Card */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Reservation Details</span>
                  <Badge className="text-lg px-3 py-1 bg-green-500/20 text-green-400 border-green-500/50">
                    {reservation.reservationNumber}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Event</p>
                    <p className="font-semibold">{reservation.eventName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {formatDate(reservation.eventDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Table</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      {reservation.tableName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Guests</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {reservation.guestCount} guests
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bottle Service</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Wine className="w-4 h-4" />
                      {reservation.bottles} bottle{reservation.bottles > 1 ? 's' : ''} included
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      3320 Old Capitol Trail
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground">Reservation Name</p>
                  <p className="font-semibold">{reservation.customerName}</p>
                </div>

                {reservation.price > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <span className="text-lg font-semibold">Total Paid</span>
                    <span className="text-2xl font-bold text-green-500">
                      ${reservation.price.toFixed(2)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Guest QR Codes */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  Guest Entry Passes ({reservation.qrCodes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Each guest needs to show their QR code at the entrance. 
                  Screenshot these or have guests scan from your phone.
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {reservation.qrCodes.map((qr) => (
                    <div
                      key={qr.guestNumber}
                      className="bg-white rounded-lg p-4 text-center"
                    >
                      <img
                        src={qr.qrDataUrl}
                        alt={`Guest ${qr.guestNumber} QR Code`}
                        className="w-full max-w-[150px] mx-auto mb-2"
                      />
                      <p className="text-black font-semibold text-sm">
                        Guest {qr.guestNumber}
                      </p>
                      <Badge className="mt-1 bg-blue-500/20 text-blue-600 border-blue-500/50">
                        Ready
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Important Info */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-lg text-amber-400">Important Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Arrive 30 minutes early for table setup</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Valid government ID required for all guests</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Each guest scans their QR code at entry</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Screenshot QR codes for offline access</span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link to="/account">
                  <Download className="w-4 h-4 mr-2" />
                  View My Reservations
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">
                  Browse More Events
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

