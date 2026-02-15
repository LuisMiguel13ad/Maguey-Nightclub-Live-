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
  const mountedRef = useRef(true);
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
    if (!isScanning || isInitialized.current || !mountedRef.current) return;

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
          // Only call callback if still mounted
          if (mountedRef.current) {
            onScanSuccess(decodedText);
          }
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

      // Guard: Don't update state if component unmounted
      if (!mountedRef.current) return;

      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      isInitialized.current = false;

      if (onError) {
        onError(errorMsg);
      }
    }
  };

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isScanning) {
      initScanner();
    }

    return () => {
      // Mark as unmounted before cleanup to prevent callbacks
      mountedRef.current = false;

      if (scannerRef.current) {
        try {
          // Try to stop the scanner - wrap in try-catch to prevent any errors from bubbling up
          scannerRef.current
            .stop()
            .then(() => {
              try {
                scannerRef.current?.clear();
              } catch {
                // Ignore clear errors
              }
              isInitialized.current = false;
            })
            .catch(() => {
              // Silently ignore "Cannot stop" errors - scanner may not be running
              isInitialized.current = false;
            });
        } catch {
          // Silently ignore synchronous errors during cleanup
          isInitialized.current = false;
        }
      }
    };
  }, [isScanning]);

  const handleRetry = async () => {
    if (!mountedRef.current) return;

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

    // Guard: Don't continue if component unmounted during wait
    if (!mountedRef.current) return;

    await initScanner();

    // Guard: Don't update state if component unmounted
    if (!mountedRef.current) return;

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
      <CardContent className="p-0 h-full flex flex-col justify-center">
        {error ? (
          <div className="flex flex-col items-center justify-center h-[400px] w-full bg-zinc-950/80 backdrop-blur-sm rounded-3xl border border-white/10 p-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full animate-pulse" />
              <div className="relative bg-zinc-900 p-4 rounded-full border border-red-500/30">
                <Camera className="h-8 w-8 text-red-500" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Camera Issue</h3>
            <p className="text-white/60 text-sm max-w-[260px] mb-8 leading-relaxed">
              {error.replace("Camera error: ", "")}
            </p>

            <Button
              onClick={handleRetry}
              className="w-full max-w-[200px] h-12 bg-white text-black hover:bg-white/90 font-bold rounded-full transition-all hover:scale-105"
              disabled={isRetrying}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Restarting...' : 'Try Again'}
            </Button>
          </div>
        ) : (
          <>
            <div className="relative rounded-3xl overflow-hidden bg-black h-full w-full">
              <div id="qr-reader" className="w-full h-full min-h-[400px]" />

              {/* Viewfinder Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-12">
                <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]">
                  {/* Corners - Glowing Neon Style */}
                  <div className="absolute top-0 left-0 w-16 h-16 border-t-[6px] border-l-[6px] border-purple-500 rounded-tl-3xl shadow-[0_0_20px_rgba(168,85,247,0.6)]" />
                  <div className="absolute top-0 right-0 w-16 h-16 border-t-[6px] border-r-[6px] border-purple-500 rounded-tr-3xl shadow-[0_0_20px_rgba(168,85,247,0.6)]" />
                  <div className="absolute bottom-0 left-0 w-16 h-16 border-b-[6px] border-l-[6px] border-purple-500 rounded-bl-3xl shadow-[0_0_20px_rgba(168,85,247,0.6)]" />
                  <div className="absolute bottom-0 right-0 w-16 h-16 border-b-[6px] border-r-[6px] border-purple-500 rounded-br-3xl shadow-[0_0_20px_rgba(168,85,247,0.6)]" />

                  {/* Scanning Animation - Smoother & brighter */}
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_25px_rgba(168,85,247,1)] animate-[scan_2s_ease-in-out_infinite]" />

                  {/* Center Icon hint */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <Camera className="h-24 w-24 text-white" />
                  </div>
                </div>

                <div className="mt-12 bg-black/40 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <p className="text-white font-medium text-sm tracking-wide">
                    Align code within frame
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </>
  );
};
