/**
 * VIP Scanner Component
 * Scanner interface specifically for VIP table guest passes
 */

import { useState, useEffect } from 'react';
import { Crown, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { QrScanner } from '@/components/QrScanner';
import { VipTableGuestResult } from '@/components/VipTableGuestResult';
import { getGuestPassByQrToken, checkInGuestPass } from '@/services/vip-admin-service';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { playSuccess, playError, playWarning } from '@/lib/audio-feedback-service';

interface VIPScannerProps {
  eventId?: string;
  onScanComplete?: (reservationId: string) => void;
}

export function VIPScanner({ eventId, onScanComplete }: VIPScannerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<{
    status: 'valid' | 'used' | 'invalid';
    pass?: any;
    reservation?: any;
    message: string;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleQRCode = async (qrData: string) => {
    if (isProcessing) return;

    setIsScanning(false);
    setIsProcessing(true);

    try {
      // Parse QR data - could be JSON or just token
      let qrToken: string;
      try {
        const parsed = JSON.parse(qrData);
        qrToken = parsed.token || qrData;
      } catch {
        qrToken = qrData;
      }

      // Get guest pass by QR token
      const result = await getGuestPassByQrToken(qrToken);

      if (!result) {
        setScanResult({
          status: 'invalid',
          message: 'Invalid VIP guest pass. QR code not found.',
        });
        playError();
        return;
      }

      const { pass, reservation } = result;

      // Check if already checked in
      if (pass.status === 'checked_in') {
        setScanResult({
          status: 'used',
          pass,
          reservation,
          message: 'This guest pass has already been checked in.',
        });
        playWarning();
        return;
      }

      // Check if reservation is valid
      if (reservation.status !== 'confirmed' && reservation.payment_status !== 'paid') {
        setScanResult({
          status: 'invalid',
          pass,
          reservation,
          message: 'Reservation is not confirmed or paid.',
        });
        playError();
        return;
      }

      // Check event match if eventId provided
      if (eventId && reservation.event_id !== eventId) {
        setScanResult({
          status: 'invalid',
          pass,
          reservation,
          message: 'This pass is for a different event.',
        });
        playError();
        return;
      }

      // Check in the guest
      await checkInGuestPass(pass.id, user?.id || 'system');

      // Success
      setScanResult({
        status: 'valid',
        pass: { ...pass, status: 'checked_in' },
        reservation: {
          ...reservation,
          checked_in_guests: (reservation.checked_in_guests || 0) + 1,
        },
        message: `Guest ${pass.guest_number} of ${reservation.guest_count} checked in successfully!`,
      });

      playSuccess();
      toast({
        title: 'VIP Guest Checked In',
        description: `Guest ${pass.guest_number} checked in for ${reservation.vip_table?.table_name || 'VIP Table'}`,
      });

      if (onScanComplete) {
        onScanComplete(reservation.id);
      }
    } catch (error) {
      console.error('Error scanning VIP pass:', error);
      setScanResult({
        status: 'invalid',
        message: error instanceof Error ? error.message : 'Failed to process VIP guest pass.',
      });
      playError();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setScanResult(null);
    setIsScanning(true);
  };

  useEffect(() => {
    if (!scanResult) {
      setIsScanning(true);
    }
  }, [scanResult]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            VIP Table Guest Scanner
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!scanResult ? (
            <div className="space-y-4">
              {isScanning && (
                <QrScanner
                  onScan={handleQRCode}
                  onError={(error) => {
                    console.error('QR Scanner error:', error);
                    toast({
                      title: 'Scanner Error',
                      description: error.message || 'Failed to start camera',
                      variant: 'destructive',
                    });
                  }}
                />
              )}
              {isProcessing && (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="ml-2">Processing VIP pass...</span>
                </div>
              )}
            </div>
          ) : (
            <VipTableGuestResult result={scanResult} onReset={handleReset} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}










