import { useEffect, useState } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Radio, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { 
  readNFCTag, 
  isNFCAvailable, 
  isNFCEnabled, 
  getNFCErrorMessage,
  triggerHapticFeedback,
  type NFCTicketPayload 
} from "@/lib/nfc-service";

interface NFCScannerProps {
  onScanSuccess: (payload: NFCTicketPayload) => void;
  isScanning: boolean;
  onError?: (error: string) => void;
}

export const NFCScanner = ({ onScanSuccess, isScanning, onError }: NFCScannerProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isDetected, setIsDetected] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Check NFC availability on mount
  useEffect(() => {
    const checkNFC = async () => {
      const available = isNFCAvailable();
      setIsAvailable(available);
      
      if (available) {
        const enabled = await isNFCEnabled();
        setIsEnabled(enabled);
        
        if (!enabled) {
          const errorMsg = "NFC is not enabled. Please enable NFC on your device.";
          setError(errorMsg);
          if (onError) {
            onError(errorMsg);
          }
        }
      } else {
        const errorMsg = "NFC is not available on this device. Please use QR code scanning instead.";
        setError(errorMsg);
        if (onError) {
          onError(errorMsg);
        }
      }
    };

    checkNFC();
  }, [onError]);

  // Start NFC reading when scanning is enabled
  useEffect(() => {
    if (!isScanning || !isAvailable || !isEnabled || isReading) {
      return;
    }

    const startReading = async () => {
      setIsReading(true);
      setIsDetected(false);
      setError(null);

      try {
        const result = await readNFCTag();
        
        if (result.success && result.payload) {
          // Visual feedback
          setIsDetected(true);
          
          // Haptic feedback
          triggerHapticFeedback('success');
          
          // Call success callback
          onScanSuccess(result.payload);
          
          // Reset detection state after a moment
          setTimeout(() => {
            setIsDetected(false);
            setIsReading(false);
          }, 1000);
        } else {
          // Error reading NFC tag
          const errorMsg = result.error || 'Failed to read NFC tag';
          setError(getNFCErrorMessage(errorMsg));
          triggerHapticFeedback('error');
          
          if (onError) {
            onError(errorMsg);
          }
          
          setIsReading(false);
        }
      } catch (err: any) {
        const errorMsg = err?.message || 'NFC read failed';
        setError(getNFCErrorMessage(errorMsg));
        triggerHapticFeedback('error');
        
        if (onError) {
          onError(errorMsg);
        }
        
        setIsReading(false);
      }
    };

    startReading();
  }, [isScanning, isAvailable, isEnabled, isReading, onScanSuccess, onError]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);
    setIsReading(false);
    setIsDetected(false);
    
    // Wait a moment before retrying
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Re-check NFC availability
    const available = isNFCAvailable();
    setIsAvailable(available);
    
    if (available) {
      const enabled = await isNFCEnabled();
      setIsEnabled(enabled);
    }
    
    setIsRetrying(false);
  };

  if (!isAvailable) {
    return (
      <>
        <CardHeader className="text-center bg-gradient-scan">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-muted rounded-full">
              <Radio className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">NFC Scanning</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>NFC Not Available</AlertTitle>
            <AlertDescription className="mt-2">
              NFC is not supported on this device. Please use QR code scanning instead.
            </AlertDescription>
          </Alert>
        </CardContent>
      </>
    );
  }

  if (!isEnabled) {
    return (
      <>
        <CardHeader className="text-center bg-gradient-scan">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-muted rounded-full">
              <Radio className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">NFC Scanning</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>NFC Not Enabled</AlertTitle>
            <AlertDescription className="mt-2">
              Please enable NFC on your device and grant permission to use NFC in your browser settings.
            </AlertDescription>
            <Button
              onClick={handleRetry}
              variant="outline"
              className="mt-4 w-full"
              disabled={isRetrying}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Checking...' : 'Check Again'}
            </Button>
          </Alert>
        </CardContent>
      </>
    );
  }

  return (
    <>
      <CardHeader className="text-center bg-gradient-scan">
        <div className="flex justify-center mb-4">
          <div className={`p-3 rounded-full transition-all ${
            isDetected 
              ? 'bg-green-500/20' 
              : isReading 
                ? 'bg-primary/10' 
                : 'bg-primary/10'
          }`}>
            {isDetected ? (
              <CheckCircle2 className="h-8 w-8 text-green-500 animate-pulse" />
            ) : (
              <Radio className={`h-8 w-8 text-primary ${isReading ? 'animate-pulse' : ''}`} />
            )}
          </div>
        </div>
        <CardTitle className="text-2xl">Tap NFC Ticket</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>NFC Read Error</AlertTitle>
            <AlertDescription className="mt-2">
              {error}
            </AlertDescription>
            <Button
              onClick={handleRetry}
              variant="outline"
              className="mt-4 w-full"
              disabled={isRetrying}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </Button>
          </Alert>
        ) : (
          <>
            <div className="relative rounded-lg overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 min-h-[300px] md:min-h-[400px] flex items-center justify-center">
              <div className="text-center space-y-4 p-8">
                {isDetected ? (
                  <>
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto animate-pulse" />
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      Ticket Detected!
                    </p>
                  </>
                ) : (
                  <>
                    <Radio className={`h-16 w-16 text-primary mx-auto ${isReading ? 'animate-pulse' : ''}`} />
                    <p className="text-lg font-semibold">
                      {isReading ? 'Reading NFC tag...' : 'Ready to scan'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Hold your NFC ticket or card near the device
                    </p>
                  </>
                )}
              </div>
              {isReading && !isDetected && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 border-4 border-primary/50 rounded-lg animate-ping" />
                </div>
              )}
            </div>
            <p className="text-center text-muted-foreground mt-4 text-sm md:text-base">
              {isReading 
                ? 'Reading ticket data...' 
                : 'Tap your NFC-enabled ticket or card on the device'}
            </p>
          </>
        )}
      </CardContent>
    </>
  );
};

