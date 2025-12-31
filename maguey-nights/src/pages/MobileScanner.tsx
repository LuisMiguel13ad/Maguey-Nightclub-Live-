import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  QrCode, 
  CheckCircle, 
  XCircle, 
  Camera,
  Volume2,
  VolumeX,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { validateTicket, getScanStats } from '@/services/ticketScannerService';
import { supabase } from '@/lib/supabase';

interface TicketData {
  orderId: string;
  event: {
    artist: string;
    date: string;
    time: string;
  };
  customer: {
    firstName: string;
    lastName: string;
  };
  status: 'valid' | 'used' | 'expired' | 'cancelled' | 'invalid';
  scannedAt?: string;
}

const MobileScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<TicketData | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanCount, setScanCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannerUserId, setScannerUserId] = useState<string | undefined>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setScannerUserId(user?.id);
    };
    getCurrentUser();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const statsData = await getScanStats();
      setScanCount(statsData.successfulScans);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsScanning(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const processScan = async (qrCode: string) => {
    setIsProcessing(true);
    
    try {
      const result = await validateTicket(qrCode, scannerUserId);
      
      if (result.success && result.ticket) {
        const ticketData: TicketData = {
          orderId: result.ticket.order_id,
          event: {
            artist: result.ticket.events?.name || 'Unknown Event',
            date: result.ticket.events?.event_date 
              ? new Date(result.ticket.events.event_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  weekday: 'short'
                }).toUpperCase()
              : 'TBD',
            time: result.ticket.events?.event_time 
              ? new Date(`2000-01-01T${result.ticket.events.event_time}`).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit'
                })
              : 'TBD'
          },
          customer: {
            firstName: result.ticket.attendee_name.split(' ')[0] || '',
            lastName: result.ticket.attendee_name.split(' ').slice(1).join(' ') || ''
          },
          status: result.ticket.is_used ? 'used' : 'valid',
          scannedAt: result.ticket.scanned_at || undefined
        };

        setLastScan(ticketData);
        setScanCount(prev => prev + 1);
        
        if (soundEnabled && result.success) {
          // Play success sound
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBS13yO/eizEIHWq+8+OWT');
          audio.play().catch(() => {});
        }
      } else {
        setLastScan({
          orderId: qrCode,
          event: { artist: 'Invalid', date: '', time: '' },
          customer: { firstName: '', lastName: '' },
          status: 'invalid'
        });
      }
    } catch (error) {
      console.error('Scan error:', error);
      setLastScan({
        orderId: qrCode,
        event: { artist: 'Error', date: '', time: '' },
        customer: { firstName: '', lastName: '' },
        status: 'invalid'
      });
    } finally {
      setIsProcessing(false);
      await loadStats();
    }
  };

  const simulateScan = () => {
    const testQrCode = `MAG-${Date.now()}`;
    processScan(testQrCode);
  };

  const getStatusBadge = (status: TicketData['status']) => {
    const config = {
      valid: { color: 'bg-green-500', icon: CheckCircle, text: 'VALID' },
      used: { color: 'bg-blue-500', icon: CheckCircle, text: 'USED' },
      expired: { color: 'bg-yellow-500', icon: XCircle, text: 'EXPIRED' },
      cancelled: { color: 'bg-red-500', icon: XCircle, text: 'CANCELLED' },
      invalid: { color: 'bg-gray-500', icon: XCircle, text: 'INVALID' }
    }[status];

    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white text-lg px-4 py-2`}>
        <Icon className="w-5 h-5 mr-2" />
        {config.text}
      </Badge>
    );
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gray-900 p-4 text-center">
        <h1 className="text-2xl font-bold">Maguey Scanner</h1>
        <p className="text-gray-400">Scan tickets for entry</p>
      </div>

      {/* Camera View */}
      <div className="relative">
        {!isScanning ? (
          <div className="h-96 bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">Tap to start scanning</p>
              <Button 
                onClick={startCamera} 
                className="bg-green-600 hover:bg-green-700 text-lg px-8 py-3"
                disabled={isProcessing}
              >
                <Camera className="w-5 h-5 mr-2" />
                Start Camera
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-96 bg-black"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-4 border-green-500 w-64 h-64 rounded-lg flex items-center justify-center">
                <QrCode className="w-20 h-20 text-green-500" />
              </div>
            </div>
            <div className="absolute top-4 right-4">
              <Button
                onClick={stopCamera}
                variant="outline"
                className="bg-black/50 border-white text-white"
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <Button
            onClick={simulateScan}
            className="bg-green-600 hover:bg-green-700 text-lg px-6 py-3"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <QrCode className="w-5 h-5 mr-2" />
                Test Scan
              </>
            )}
          </Button>
          
          <Button
            onClick={() => setSoundEnabled(!soundEnabled)}
            variant="outline"
            className="border-gray-600 text-white"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        </div>

        <div className="text-center">
          <p className="text-gray-400">Scans Today: <span className="text-white font-bold">{scanCount}</span></p>
        </div>
      </div>

      {/* Last Scan Result */}
      {lastScan && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4"
        >
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Last Scan Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                {getStatusBadge(lastScan.status)}
              </div>
              
              <div className="space-y-2">
                <div className="text-center">
                  <p className="text-white font-bold text-lg">{lastScan.event.artist}</p>
                  <p className="text-gray-400">{lastScan.event.date} - {lastScan.event.time}</p>
                </div>
                
                <div className="text-center">
                  <p className="text-white">{lastScan.customer.firstName} {lastScan.customer.lastName}</p>
                  <p className="text-gray-400 font-mono text-sm">{lastScan.orderId}</p>
                </div>
              </div>

              {lastScan.status === 'valid' && (
                <Alert className="border-green-500 bg-green-900/20">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription className="text-green-300 text-center">
                    Ticket is valid! Customer may enter.
                  </AlertDescription>
                </Alert>
              )}

              {lastScan.status === 'used' && (
                <Alert className="border-yellow-500 bg-yellow-900/20">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription className="text-yellow-300 text-center">
                    This ticket has already been used.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Actions */}
      <div className="p-4 space-y-2">
        <Button
          onClick={() => setLastScan(null)}
          variant="outline"
          className="w-full border-gray-600 text-white"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Clear Last Scan
        </Button>
      </div>
    </div>
  );
};

export default MobileScanner;
