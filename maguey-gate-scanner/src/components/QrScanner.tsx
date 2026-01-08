import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Scan, Camera, AlertCircle, RefreshCw } from "lucide-react";

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  isScanning: boolean;
  onError?: (error: string) => void;
  minimal?: boolean;
}

export const QrScanner = ({ onScanSuccess, isScanning, onError, minimal = false }: QrScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isInitialized = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const getErrorMessage = (err: any): string => {
    const errorMessage = err?.message || String(err);

    if (errorMessage.includes("Permission") || errorMessage.includes("permission")) {
      return "Camera permission denied. Please allow camera access in your browser settings.";
    }
    if (errorMessage.includes("NotFound") || errorMessage.includes("not found")) {
      return "No camera found. Please connect a camera and try again.";
    }
    if (errorMessage.includes("NotReadable") || errorMessage.includes("not readable")) {
      return "Camera is already in use by another application. Please close other apps using the camera.";
    }
    if (errorMessage.includes("NotAllowed") || errorMessage.includes("not allowed")) {
      return "Camera access denied. Please enable camera permissions in your browser.";
    }
    if (errorMessage.includes("HTTPS") || errorMessage.includes("secure context")) {
      return "Camera requires HTTPS connection. Please use a secure connection.";
    }

    return `Camera error: ${errorMessage}. Please try again or use manual entry.`;
  };

  const initScanner = async () => {
    if (!isScanning || isInitialized.current) return;

    setError(null);
    setIsRetrying(false);

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      isInitialized.current = true;

      // Use back camera on mobile, auto-select on desktop
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const facingMode = isMobile ? "environment" : { exact: "environment" };

      await scanner.start(
        facingMode,
        {
          fps: 10,
          qrbox: (width, height) => {
            // Make QR box responsive - use 80% of smaller dimension on mobile
            const minDimension = Math.min(width, height);
            const qrSize = isMobile ? Math.min(300, minDimension * 0.8) : 250;
            return { width: qrSize, height: qrSize };
          },
          aspectRatio: 1.0,
          videoConstraints: {
            facingMode: isMobile ? "environment" : "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        (decodedText) => {
          onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Silent error callback for scanning errors (not critical)
          // Only log if it's not a common scanning error
          if (!errorMessage.includes("NotFoundException") && !errorMessage.includes("No QR code")) {
            console.debug("Scan error:", errorMessage);
          }
        }
      );
    } catch (err: any) {
      console.error("Scanner initialization error:", err);
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      isInitialized.current = false;

      if (onError) {
        onError(errorMsg);
      }
    }
  };

  useEffect(() => {
    if (isScanning) {
      initScanner();
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
            isInitialized.current = false;
          })
          .catch(() => {
            // Silently ignore "Cannot stop" errors - scanner may not be running
            isInitialized.current = false;
          });
      }
    };
  }, [isScanning]);

  const handleRetry = async () => {
    setIsRetrying(true);
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // Ignore stop errors
      }
    }
    isInitialized.current = false;
    await new Promise(resolve => setTimeout(resolve, 500));
    await initScanner();
    setIsRetrying(false);
  };

  return (
    <>
      {!minimal && (
        <CardHeader className="text-center bg-gradient-scan">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              {error ? (
                <Camera className="h-8 w-8 text-destructive" />
              ) : (
                <Scan className="h-8 w-8 text-primary animate-pulse" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl">Scan Ticket QR Code</CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-6 space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Camera Error</AlertTitle>
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
              {isRetrying ? 'Retrying...' : 'Retry Camera'}
            </Button>
          </Alert>
        ) : (
          <>
            <div className="relative rounded-lg overflow-hidden border-2 border-primary/30 bg-black">
              <div id="qr-reader" className="w-full min-h-[300px] md:min-h-[400px]" />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="border-2 border-primary/50 rounded-lg animate-pulse"
                  style={{ width: '80%', maxWidth: '300px', aspectRatio: '1' }} />
              </div>
            </div>
            <p className="text-center text-muted-foreground mt-4 text-sm md:text-base">
              Position QR code within the frame
            </p>
          </>
        )}
      </CardContent>
    </>
  );
};
