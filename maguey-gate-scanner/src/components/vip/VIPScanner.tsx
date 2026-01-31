/**
 * VIP Scanner Component
 * Scanner interface specifically for VIP table guest passes
 * Now with offline queue support for network resilience
 */

import { useState, useEffect, useCallback } from 'react';
import { Crown, Loader2, AlertCircle, CheckCircle2, XCircle, ShieldAlert, WifiOff, RefreshCw, CloudOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { QrScanner } from '@/components/QrScanner';
import { VipTableGuestResult } from '@/components/VipTableGuestResult';
import { getGuestPassByQrToken, checkInGuestPass, verifyPassSignature, processVipScanWithReentry } from '@/services/vip-admin-service';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { playSuccess, playError, playWarning } from '@/lib/audio-feedback-service';
import {
  queueVipScan,
  getPendingVipScanCount,
  syncPendingVipScans,
  startVipAutoSync,
  stopVipAutoSync,
} from '@/lib/vip-offline-queue-service';

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
    reentry?: boolean;
    lastEntryTime?: string;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Offline support state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingScans, setPendingScans] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Update pending scan count
  const updatePendingCount = useCallback(async () => {
    const count = await getPendingVipScanCount();
    setPendingScans(count);
  }, []);

  // Handle online/offline status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Back Online',
        description: 'VIP scanner is now online. Syncing queued scans...',
      });
      updatePendingCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'Offline Mode',
        description: 'VIP scans will be queued and synced when connection returns.',
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start auto-sync and check pending count
    startVipAutoSync(5000);
    updatePendingCount();

    // Check pending count periodically
    const pendingInterval = setInterval(updatePendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopVipAutoSync();
      clearInterval(pendingInterval);
    };
  }, [toast, updatePendingCount]);

  // Manual sync function
  const handleManualSync = async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const result = await syncPendingVipScans({ syncType: 'manual' });
      await updatePendingCount();

      if (result.total === 0) {
        toast({
          title: 'No Pending Scans',
          description: 'All VIP scans are already synced.',
        });
      } else {
        toast({
          title: 'Sync Complete',
          description: `Synced ${result.success} of ${result.total} VIP scans.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`,
          variant: result.failed > 0 ? 'destructive' : 'default',
        });
      }
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: 'Could not sync pending VIP scans. Will retry automatically.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleQRCode = async (qrData: string) => {
    if (isProcessing) return;

    setIsScanning(false);
    setIsProcessing(true);

    try {
      // Parse QR data - could be JSON or just token
      let qrToken: string;
      let qrSignature: string | null = null;
      let parsedMeta: { reservationId?: string; guestNumber?: number } | null = null;

      try {
        const parsed = JSON.parse(qrData);
        qrToken = parsed.token || qrData;
        qrSignature = parsed.signature || null;
        parsedMeta = parsed.meta || null;
      } catch {
        qrToken = qrData;
      }

      // OFFLINE MODE: Queue the scan if we're not online
      if (!isOnline) {
        await queueVipScan(qrToken, qrSignature, parsedMeta, user?.id);
        await updatePendingCount();

        setScanResult({
          status: 'valid',
          message: 'VIP scan queued for sync when online.',
        });
        playSuccess();
        toast({
          title: 'Scan Queued (Offline)',
          description: 'VIP pass will be verified when connection returns.',
        });
        return;
      }

      // If we have a signature, verify it first
      if (qrSignature) {
        const verificationResult = await verifyPassSignature(
          qrToken,
          qrSignature,
          parsedMeta?.reservationId,
          parsedMeta?.guestNumber
        );

        // Handle signature verification errors
        if (!verificationResult.valid) {
          // If already checked in, show as used
          if (verificationResult.error === 'ALREADY_CHECKED_IN') {
            const result = await getGuestPassByQrToken(qrToken);
            if (result) {
              setScanResult({
                status: 'used',
                pass: result.pass,
                reservation: result.reservation,
                message: 'This guest pass has already been checked in.',
              });
              playWarning();
              return;
            }
          }

          // For invalid signatures, show security warning
          if (verificationResult.error === 'INVALID_SIGNATURE') {
            setScanResult({
              status: 'invalid',
              message: 'SECURITY WARNING: Invalid QR code signature. This may be a counterfeit pass.',
            });
            playError();
            toast({
              title: 'Security Alert',
              description: 'Invalid signature detected. Pass may be counterfeit.',
              variant: 'destructive',
            });
            return;
          }

          // Other errors (not found, cancelled, etc.)
          setScanResult({
            status: 'invalid',
            message: verificationResult.message || 'Invalid VIP guest pass.',
          });
          playError();
          return;
        }
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

      // If no signature was provided, verify against stored signature
      if (!qrSignature && pass.qr_signature) {
        const verificationResult = await verifyPassSignature(
          qrToken,
          pass.qr_signature
        );

        if (!verificationResult.valid && verificationResult.error === 'INVALID_SIGNATURE') {
          console.warn('Pass signature mismatch - proceeding with caution');
          // Log but don't block - signature might be from old generation method
        }
      }

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

      // Check if reservation is valid (in new schema, 'confirmed' or 'checked_in' means paid)
      const validStatuses = ['confirmed', 'checked_in', 'completed'];
      if (!validStatuses.includes(reservation.status)) {
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

      // Check in the guest using re-entry function
      const scanResult = await processVipScanWithReentry(pass.id, user?.id || 'system');

      if (!scanResult.success) {
        setScanResult({
          status: 'invalid',
          message: scanResult.message || 'Failed to process VIP scan.',
        });
        playError();
        return;
      }

      // Success - use package_snapshot.guestCount for total guests
      const totalGuests = reservation.package_snapshot?.guestCount || 0;
      const tableName = reservation.event_vip_table?.table_name || 'VIP Table';

      const isReentry = scanResult.entryType === 'reentry';

      setScanResult({
        status: 'valid',
        pass: { ...pass, status: 'checked_in' },
        reservation: {
          ...reservation,
          checked_in_guests: scanResult.checkedInGuests || (reservation.checked_in_guests || 0),
        },
        message: isReentry
          ? `Guest ${pass.guest_number} re-entry granted`
          : `Guest ${pass.guest_number} of ${totalGuests} checked in successfully!`,
        reentry: isReentry,
        lastEntryTime: scanResult.lastEntryTime,
      });

      playSuccess();
      toast({
        title: isReentry ? 'VIP Re-Entry Granted' : 'VIP Guest Checked In',
        description: isReentry
          ? `Guest ${pass.guest_number} - ${tableName}`
          : `Guest ${pass.guest_number} checked in for ${tableName}`,
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
      {/* Offline Status Banner */}
      {!isOnline && (
        <Alert variant="destructive" className="border-orange-500 bg-orange-50">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Offline Mode - VIP scans will be queued</span>
            {pendingScans > 0 && (
              <Badge variant="outline" className="ml-2">
                {pendingScans} pending
              </Badge>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Scans Banner (when online with pending) */}
      {isOnline && pendingScans > 0 && (
        <Alert className="border-blue-500 bg-blue-50">
          <CloudOff className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>{pendingScans} VIP scan{pendingScans !== 1 ? 's' : ''} pending sync</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="ml-2"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Sync Now
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            VIP Table Guest Scanner
            {!isOnline && (
              <Badge variant="secondary" className="ml-auto text-orange-600">
                <WifiOff className="w-3 h-3 mr-1" />
                Offline
              </Badge>
            )}
            {pendingScans > 0 && isOnline && (
              <Badge variant="secondary" className="ml-auto">
                {pendingScans} queued
              </Badge>
            )}
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










