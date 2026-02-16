import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  QrCode, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  User, 
  Calendar, 
  Clock, 
  MapPin,
  CreditCard,
  Search,
  Camera,
  Smartphone,
  Loader2
} from 'lucide-react';
import { validateTicket, getScanHistory, getScanStats, type TicketValidationResult } from '@/services/ticketScannerService';
import { supabase } from '@/lib/supabase';

interface TicketData {
  orderId: string;
  eventId: string;
  event: {
    artist: string;
    date: string;
    time: string;
    venue: string;
    address: string;
  };
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
  };
  tickets: {[key: string]: number};
  tables: {[key: string]: number};
  total: number;
  status: 'valid' | 'used' | 'expired' | 'cancelled' | 'invalid';
  scannedAt?: string;
  scannedBy?: string;
  qrCode: string;
}

interface ScanResult {
  success: boolean;
  ticket?: TicketData;
  error?: string;
  message?: string;
}

const TicketScanner = () => {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [scannerMode, setScannerMode] = useState<'qr' | 'manual'>('qr');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({ totalScans: 0, successfulScans: 0, failedScans: 0, successRate: 0 });
  const [scannerUserId, setScannerUserId] = useState<string | undefined>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Get current user ID for scanner
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setScannerUserId(user?.id);
    };
    getCurrentUser();
    loadScanHistory();
    loadStats();
  }, []);

  const loadScanHistory = async () => {
    try {
      const history = await getScanHistory(10);
      setScanHistory(history);
    } catch (error) {
      console.error('Error loading scan history:', error);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await getScanStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Initialize camera for QR scanning
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
      console.error('Error accessing camera:', error);
      setScanResult({
        success: false,
        error: 'Camera access denied. Please allow camera permissions.'
      });
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Simulate QR code scanning (for testing)
  const simulateQRScan = () => {
    // Use a test QR code format
    const testQrCode = `MAG-${Date.now()}`;
    processTicket(testQrCode);
  };

  // Process scanned ticket
  const processTicket = async (qrData: string) => {
    setIsProcessing(true);
    setScanResult(null);
    
    try {
      const result = await validateTicket(qrData, scannerUserId);
      
      if (result.success && result.ticket) {
        // Transform Supabase ticket to display format
        const ticketData: TicketData = {
          orderId: result.ticket.order_id,
          eventId: result.ticket.event_id,
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
              : 'TBD',
            venue: result.ticket.events?.venue_name || 'MAGUEY DELAWARE',
            address: result.ticket.events?.venue_address || '123 Main Street, Wilmington, DE 19801'
          },
          customer: {
            firstName: result.ticket.attendee_name.split(' ')[0] || '',
            lastName: result.ticket.attendee_name.split(' ').slice(1).join(' ') || '',
            email: result.ticket.attendee_email || result.ticket.orders?.purchaser_email || '',
            phone: '',
            dateOfBirth: ''
          },
          tickets: { [result.ticket.ticket_type || 'general']: 1 },
          tables: {},
          total: Number(result.ticket.orders?.total || 0),
          status: result.ticket.is_used ? 'used' : 'valid',
          scannedAt: result.ticket.scanned_at || undefined,
          scannedBy: scannerUserId,
          qrCode: qrData
        };

        setScanResult({
          success: true,
          ticket: ticketData,
          message: result.message
        });

        // Reload history and stats
        await Promise.all([loadScanHistory(), loadStats()]);
      } else {
        setScanResult({
          success: false,
          error: result.error,
          message: result.message
        });
        await loadStats();
      }
    } catch (error) {
      console.error('Error processing ticket:', error);
      setScanResult({
        success: false,
        error: 'Processing error',
        message: 'An error occurred while processing the ticket.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Manual code entry
  const handleManualScan = () => {
    if (manualCode.trim() && !isProcessing) {
      processTicket(manualCode.trim());
      setManualCode('');
    }
  };

  // Get status badge
  const getStatusBadge = (status: TicketData['status']) => {
    const statusConfig = {
      valid: { color: 'bg-green-500', icon: CheckCircle, text: 'VALID' },
      used: { color: 'bg-blue-500', icon: CheckCircle, text: 'USED' },
      expired: { color: 'bg-yellow-500', icon: AlertTriangle, text: 'EXPIRED' },
      cancelled: { color: 'bg-red-500', icon: XCircle, text: 'CANCELLED' },
      invalid: { color: 'bg-gray-500', icon: XCircle, text: 'INVALID' }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.text}
      </Badge>
    );
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      
      <div className="pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold text-white mb-2">Ticket Scanner</h1>
            <p className="text-gray-400">Scan QR codes or enter ticket codes manually</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Scanner Section */}
            <div className="lg:col-span-2 space-y-6">
              {/* Scanner Mode Toggle */}
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <QrCode className="w-5 h-5" />
                    <span>Scanner Mode</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-4">
                    <Button
                      onClick={() => setScannerMode('qr')}
                      className={scannerMode === 'qr' ? 'bg-green-600' : 'bg-gray-700'}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      QR Scanner
                    </Button>
                    <Button
                      onClick={() => setScannerMode('manual')}
                      className={scannerMode === 'manual' ? 'bg-green-600' : 'bg-gray-700'}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Manual Entry
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* QR Scanner */}
              {scannerMode === 'qr' && (
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">QR Code Scanner</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {!isScanning ? (
                        <div className="text-center py-8">
                          <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-400 mb-4">Click to start camera for QR scanning</p>
                          <Button onClick={startCamera} className="bg-green-600 hover:bg-green-700">
                            <Camera className="w-4 h-4 mr-2" />
                            Start Camera
                          </Button>
                          <Button 
                            onClick={simulateQRScan} 
                            variant="outline" 
                            className="ml-4 border-gray-600 text-white hover:bg-gray-800"
                          >
                            <Smartphone className="w-4 h-4 mr-2" />
                            Simulate Scan
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              className="w-full h-64 bg-black rounded-lg"
                            />
                            <canvas
                              ref={canvasRef}
                              className="hidden"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="border-2 border-green-500 w-48 h-48 rounded-lg flex items-center justify-center">
                                <QrCode className="w-16 h-16 text-green-500" />
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              onClick={stopCamera} 
                              variant="outline" 
                              className="border-gray-600 text-white hover:bg-gray-800"
                              disabled={isProcessing}
                            >
                              Stop Camera
                            </Button>
                            <Button 
                              onClick={simulateQRScan} 
                              className="bg-green-600 hover:bg-green-700"
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <Smartphone className="w-4 h-4 mr-2" />
                                  Test Scan
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Manual Entry */}
              {scannerMode === 'manual' && (
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Manual Ticket Entry</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="text-white text-sm font-medium mb-2 block">
                          Enter Ticket Code or Order ID
                        </label>
                        <div className="flex space-x-2">
                          <Input
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            placeholder="MAG-1703123456789 or QR code data"
                            className="bg-gray-800 border-gray-600 text-white"
                            onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
                          />
                          <Button 
                            onClick={handleManualScan}
                            disabled={!manualCode.trim() || isProcessing}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Search className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-400">
                        <p>Enter the order ID (e.g., MAG-1703123456789) or scan a QR code manually.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Scan Result */}
              {scanResult && (
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                      {scanResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span>Scan Result</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {scanResult.success && scanResult.ticket ? (
                      <div className="space-y-4">
                        <Alert className="border-green-500 bg-green-900/20">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription className="text-green-300">
                            {scanResult.message}
                          </AlertDescription>
                        </Alert>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-white font-semibold mb-2">Event Details</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-white">{scanResult.ticket.event.artist}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="text-white">{scanResult.ticket.event.date} - {scanResult.ticket.event.time}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="text-white">{scanResult.ticket.event.venue}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-white font-semibold mb-2">Customer Details</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center space-x-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-white">{scanResult.ticket.customer.firstName} {scanResult.ticket.customer.lastName}</span>
                              </div>
                              <div className="text-gray-400">{scanResult.ticket.customer.email}</div>
                              <div className="text-gray-400">{scanResult.ticket.customer.phone}</div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-gray-700 pt-4">
                          <h4 className="text-white font-semibold mb-2">Order Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Order ID:</span>
                              <span className="text-white font-mono">{scanResult.ticket.orderId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Total:</span>
                              <span className="text-white font-bold">{formatCurrency(scanResult.ticket.total)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Status:</span>
                              {getStatusBadge(scanResult.ticket.status)}
                            </div>
                            {scanResult.ticket.scannedAt && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Scanned:</span>
                                <span className="text-white">{new Date(scanResult.ticket.scannedAt).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Alert className="border-red-500 bg-red-900/20">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription className="text-red-300">
                          <div className="font-semibold mb-1">{scanResult.error}</div>
                          <div>{scanResult.message}</div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Scan History */}
            <div className="space-y-6">
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Recent Scans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {scanHistory.length === 0 ? (
                      <p className="text-gray-400 text-sm">No recent scans</p>
                    ) : (
                      scanHistory.map((scan, index) => (
                        <div key={scan.id || index} className="p-3 bg-gray-800 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-mono text-sm">
                              {scan.tickets?.order_id || 'N/A'}
                            </span>
                            <Badge className={
                              scan.scan_result === 'success' 
                                ? 'bg-green-500 text-white' 
                                : 'bg-red-500 text-white'
                            }>
                              {scan.scan_result === 'success' ? 'VALID' : 'INVALID'}
                            </Badge>
                          </div>
                          <div className="text-gray-400 text-xs">
                            {scan.tickets?.attendee_name || 'N/A'}
                          </div>
                          <div className="text-gray-400 text-xs">
                            {scan.tickets?.events?.name || 'N/A'}
                          </div>
                          <div className="text-gray-500 text-xs mt-1">
                            {new Date(scan.scanned_at).toLocaleTimeString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Today's Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Scans:</span>
                      <span className="text-white font-bold">{stats.totalScans}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Successful:</span>
                      <span className="text-green-400 font-bold">{stats.successfulScans}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Failed:</span>
                      <span className="text-red-400 font-bold">{stats.failedScans}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Success Rate:</span>
                      <span className="text-white font-bold">{stats.successRate.toFixed(1)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TicketScanner;
