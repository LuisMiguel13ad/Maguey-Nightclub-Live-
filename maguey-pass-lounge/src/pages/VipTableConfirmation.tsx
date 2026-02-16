/**
 * VIP Table Confirmation Page
 * Shows reservation confirmation with QR codes for all guests
 */

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Crown,
  CheckCircle2,
  Mail,
  Download,
  Users,
  Wine,
  MapPin,
  Calendar,
  Phone,
  Loader2,
  AlertCircle,
  QrCode,
  Share2,
  Printer,
} from 'lucide-react';
import { VipProgressIndicator } from '@/components/vip/VipProgressIndicator';
import { CustomCursor } from '@/components/CustomCursor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  getReservationByNumber,
  getReservationById,
  getGuestPassesWithQrCodes,
  type TableReservation,
  type TableGuestPass,
} from '@/lib/vip-tables-service';

const VipTableConfirmation = () => {
  const [searchParams] = useSearchParams();
  const reservationId = searchParams.get('reservationId');
  const reservationNumber = searchParams.get('reservationNumber');

  const [reservation, setReservation] = useState<TableReservation | null>(null);
  const [guestPasses, setGuestPasses] = useState<TableGuestPass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReservation();
  }, [reservationId, reservationNumber]);

  const loadReservation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let reservationData: TableReservation | null = null;

      if (reservationId) {
        reservationData = await getReservationById(reservationId);
      } else if (reservationNumber) {
        reservationData = await getReservationByNumber(reservationNumber);
      }

      if (!reservationData) {
        setError('Reservation not found');
        setIsLoading(false);
        return;
      }

      setReservation(reservationData);

      // Load guest passes with QR codes
      const passes = await getGuestPassesWithQrCodes(reservationData.id);
      setGuestPasses(passes);
    } catch (err) {
      console.error('Error loading reservation:', err);
      setError('Failed to load reservation details');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share && reservation) {
      try {
        await navigator.share({
          title: `VIP Table Reservation - ${reservation.reservation_number}`,
          text: `Your VIP table reservation at ${reservation.event?.venue_name} on ${new Date(reservation.event?.event_date || '').toLocaleDateString()}`,
          url: window.location.href,
        });
      } catch {
        // Share cancelled or failed
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-copper-400" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Loading Confirmation...
        </p>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Reservation Not Found</h2>
          <p className="text-stone-500 mb-4">{error || 'Unable to find your reservation'}</p>
          <Button asChild className="bg-copper-400 hover:bg-copper-500 text-forest-950">
            <Link to="/">Back to Events</Link>
          </Button>
        </div>
      </div>
    );
  }

  const eventDate = reservation.event?.event_date
    ? new Date(reservation.event.event_date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen bg-forest-950 text-stone-300 overflow-x-hidden">
      {/* Custom Cursor */}
      <CustomCursor />
      
      {/* Noise Overlay */}
      <div className="noise-overlay" />
      
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
        <svg width="100%" height="100%">
          <pattern id="confirmation-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-copper-400" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#confirmation-grid)" />
        </svg>
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-white/5 bg-forest-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-copper-400" />
              <span className="text-lg font-light tracking-wide" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                <span className="text-stone-100">VIP </span>
                <span className="italic text-copper-400">Tables</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="hidden md:flex border-white/10 bg-white/5 hover:bg-white/10 text-stone-300">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              {navigator.share && (
                <Button variant="outline" size="sm" onClick={handleShare} className="border-white/10 bg-white/5 hover:bg-white/10 text-stone-300">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="relative z-40 w-full bg-forest-900/50 backdrop-blur-sm border-b border-white/5 py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <VipProgressIndicator currentStep="confirmation" />
        </div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {/* Success Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 ring-4 ring-emerald-500/30 mb-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-light mb-2" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
            Reservation <span className="italic text-copper-400">Confirmed!</span>
          </h1>
          <p className="text-stone-500 text-lg">
            Your VIP table is reserved. QR codes have been sent to your email.
          </p>
        </div>

        {/* Email Alert */}
        <Alert className="mb-8 border-copper-400/30 bg-copper-400/10">
          <Mail className="h-4 w-4 text-copper-400" />
          <AlertDescription className="text-stone-300">
            Confirmation email sent to <strong className="text-stone-100">{reservation.customer_email}</strong>. 
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
                  <Badge className="text-lg px-3 py-1 bg-copper-400/20 text-copper-400 border-copper-400/50">
                    {reservation.reservation_number}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Event</p>
                    <p className="font-semibold">{reservation.event?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {eventDate}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Table</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      {reservation.vip_table?.table_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {reservation.vip_table?.floor_section}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Guests</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {reservation.guest_count} guests
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bottle Service</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Wine className="w-4 h-4" />
                      {reservation.vip_table?.bottle_service_description}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Reservation Name</p>
                    <p className="font-semibold">
                      {reservation.customer_first_name} {reservation.customer_last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contact</p>
                    <p className="font-semibold flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {reservation.customer_phone}
                    </p>
                  </div>
                </div>

                {reservation.bottle_choice && (
                  <div>
                    <p className="text-sm text-muted-foreground">Bottle Choice</p>
                    <p className="font-semibold">{reservation.bottle_choice}</p>
                  </div>
                )}

                {reservation.special_requests && (
                  <div>
                    <p className="text-sm text-muted-foreground">Special Requests</p>
                    <p className="text-sm">{reservation.special_requests}</p>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Total Paid</span>
                  <span className="text-2xl font-bold text-stone-100">
                    ${Number(reservation.total_amount).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Guest QR Codes */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  Guest Entry Passes ({guestPasses.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Each guest needs to show their QR code at the entrance. 
                  Share these with your guests or have them scan from your phone.
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {guestPasses.map((pass) => (
                    <div
                      key={pass.id}
                      className="bg-white rounded-lg p-4 text-center"
                    >
                      {pass.qr_code_url && (
                        <img
                          src={pass.qr_code_url}
                          alt={`Guest ${pass.guest_number} QR Code`}
                          className="w-full max-w-[150px] mx-auto mb-2"
                        />
                      )}
                      <p className="text-black font-semibold text-sm">
                        Guest {pass.guest_number}
                      </p>
                      <p className="text-gray-500 text-xs font-mono">
                        {pass.pass_id}
                      </p>
                      <Badge
                        className={
                          pass.status === 'checked_in'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 mt-2'
                            : 'bg-copper-400/20 text-copper-400 border-copper-400/50 mt-2'
                        }
                      >
                        {pass.status === 'checked_in' ? 'Checked In' : 'Ready'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Event Image Card */}
            {reservation.event?.image_url && (
              <Card className="border-primary/20 overflow-hidden">
                <img
                  src={reservation.event.image_url}
                  alt={reservation.event.name}
                  className="w-full h-48 object-cover"
                />
              </Card>
            )}

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
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-red-400">No refunds - reservation is final</span>
                </div>
              </CardContent>
            </Card>

            {/* Venue Info */}
            <Card className="border-border/50 bg-black/40">
              <CardContent className="p-4">
                <h4 className="font-semibold mb-2">{reservation.event?.venue_name}</h4>
                <p className="text-sm text-muted-foreground">
                  {reservation.event?.event_time && (
                    <>Doors open at {reservation.event.event_time}</>
                  )}
                </p>
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

      {/* Print Styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          header, footer, button { display: none !important; }
          .text-white { color: black !important; }
          .text-muted-foreground { color: #666 !important; }
          .bg-forest-950, .bg-forest-950\\/80, .bg-copper-400\\/10 { background: white !important; }
          .border-copper-400\\/20 { border-color: #ccc !important; }
        }
      `}</style>
    </div>
  );
};

export default VipTableConfirmation;
