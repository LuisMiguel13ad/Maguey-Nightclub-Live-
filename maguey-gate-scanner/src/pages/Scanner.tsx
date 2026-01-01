import { useState, useEffect, useRef } from "react";
import { useAuth, useRole } from "@/contexts/AuthContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import EmployeePortalLayout from "@/components/layout/EmployeePortalLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Keyboard,
  Camera,
  Radio,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  WifiOff,
  Cloud
} from "lucide-react";
import { QrScanner } from "@/components/QrScanner";
import { NFCScanner } from "@/components/NFCScanner";
import {
  scanTicket,
  getEventNamesFromTickets,
  debugGetSampleTickets,
} from "@/lib/simple-scanner";
import {
  queueScan,
  syncPendingScans,
  getSyncStatus,
} from "@/lib/offline-queue-service";
import { Ticket } from "@/lib/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ScanMode = "manual" | "qr" | "nfc";

interface ScanState {
  status: "idle" | "scanning" | "success" | "error" | "already_scanned";
  ticket: Ticket | null;
  message: string;
}

// Cooldown period after a scan (ms)
const SCAN_COOLDOWN = 3000;

const Scanner = () => {
  const { user } = useAuth();
  const role = useRole();
  const { toast } = useToast();

  // State
  const [scanMode, setScanMode] = useState<ScanMode>("manual");
  const [manualInput, setManualInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanState, setScanState] = useState<ScanState>({
    status: "idle",
    ticket: null,
    message: "",
  });

  // Prevent duplicate scans
  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  // Event filter
  const [selectedEvent, setSelectedEvent] = useState<string>("all");
  const [eventNames, setEventNames] = useState<string[]>([]);

  // Offline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingScans, setPendingScans] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load event names on mount and debug tickets
  useEffect(() => {
    const loadEvents = async () => {
      const names = await getEventNamesFromTickets();
      setEventNames(names);
      // Debug: show sample tickets in console
      await debugGetSampleTickets();
    };
    loadEvents();
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update pending scan count
  useEffect(() => {
    const updatePendingCount = async () => {
      const status = await getSyncStatus();
      setPendingScans(status.pending + status.failed);
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Process a scan input (from manual, QR, or NFC)
  const processScan = async (input: string, method: ScanMode) => {
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    setScanState({ status: "scanning", ticket: null, message: "Looking up ticket..." });

    try {
      // If offline, queue the scan
      if (!isOnline) {
        await queueScan(input.trim(), user?.id, {
          ticketIdString: input.trim(),
        });

        setScanState({
          status: "success",
          ticket: null,
          message: "Scan queued for sync when online",
        });

        toast({
          title: "Queued Offline",
          description: "Scan will sync when connection is restored",
        });

        setManualInput("");
        setIsProcessing(false);
        return;
      }

      // Online: perform the scan
      const result = await scanTicket(input.trim(), user?.id, method);

      // Check event filter
      if (selectedEvent !== "all" && result.ticket && result.ticket.event_name !== selectedEvent) {
        setScanState({
          status: "error",
          ticket: result.ticket,
          message: `This ticket is for "${result.ticket.event_name}", not the selected event`,
        });
        setManualInput("");
        setIsProcessing(false);
        return;
      }

      if (result.success) {
        setScanState({
          status: "success",
          ticket: result.ticket,
          message: result.message,
        });
        toast({
          title: "Valid Ticket",
          description: `${result.ticket?.guest_name || "Guest"} - ${result.ticket?.ticket_type || "Standard"}`,
        });
      } else if (result.alreadyScanned) {
        setScanState({
          status: "already_scanned",
          ticket: result.ticket,
          message: result.message,
        });
      } else {
        setScanState({
          status: "error",
          ticket: null,
          message: result.message,
        });
      }
    } catch (error) {
      console.error("Scan error:", error);
      setScanState({
        status: "error",
        ticket: null,
        message: "An error occurred while scanning",
      });
    }

    setManualInput("");
    setIsProcessing(false);
  };

  // Handle manual form submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processScan(manualInput, "manual");
  };

  // Handle QR scan with debounce to prevent duplicate scans
  const handleQrScan = (decodedText: string) => {
    const now = Date.now();

    // Skip if we're still in cooldown period for the same QR code
    if (
      decodedText === lastScannedRef.current &&
      now - lastScanTimeRef.current < SCAN_COOLDOWN
    ) {
      return;
    }

    // Skip if we already have a result showing
    if (scanState.status !== "idle" && scanState.status !== "scanning") {
      return;
    }

    // Update refs to track this scan
    lastScannedRef.current = decodedText;
    lastScanTimeRef.current = now;

    processScan(decodedText, "qr");
  };

  // Handle NFC scan
  const handleNfcScan = (payload: { token: string }) => {
    processScan(payload.token, "nfc");
  };

  // Sync pending scans
  const handleSync = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await syncPendingScans();
      toast({
        title: "Sync Complete",
        description: `Synced ${result.success} of ${result.total} scans`,
      });

      const status = await getSyncStatus();
      setPendingScans(status.pending + status.failed);
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Could not sync pending scans",
        variant: "destructive",
      });
    }
    setIsSyncing(false);
  };

  // Reset to scan another
  const handleScanAnother = () => {
    setScanState({ status: "idle", ticket: null, message: "" });
    setManualInput("");
    // Reset the last scanned ref so the same QR can be scanned again
    lastScannedRef.current = "";
    lastScanTimeRef.current = 0;
  };

  // Render scan result
  const renderScanResult = () => {
    if (scanState.status === "idle" || scanState.status === "scanning") {
      return null;
    }

    const isSuccess = scanState.status === "success";
    const isWarning = scanState.status === "already_scanned";
    const isError = scanState.status === "error";

    return (
      <Card className={`mt-6 border-2 ${
        isSuccess ? "border-green-500 bg-green-500/10" :
        isWarning ? "border-yellow-500 bg-yellow-500/10" :
        "border-red-500 bg-red-500/10"
      }`}>
        <CardContent className="p-6 text-center">
          <div className="flex justify-center mb-4">
            {isSuccess && <CheckCircle2 className="h-16 w-16 text-green-500" />}
            {isWarning && <AlertCircle className="h-16 w-16 text-yellow-500" />}
            {isError && <XCircle className="h-16 w-16 text-red-500" />}
          </div>

          <h3 className={`text-2xl font-bold mb-2 ${
            isSuccess ? "text-green-600 dark:text-green-400" :
            isWarning ? "text-yellow-600 dark:text-yellow-400" :
            "text-red-600 dark:text-red-400"
          }`}>
            {isSuccess ? "Entry Granted" : isWarning ? "Already Scanned" : "Entry Denied"}
          </h3>

          {scanState.ticket && (
            <div className="space-y-2 mb-4">
              <p className="text-xl font-semibold">
                {scanState.ticket.guest_name || "Unknown Guest"}
              </p>
              <Badge variant="secondary" className="text-base">
                {scanState.ticket.ticket_type || "Standard Ticket"}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {scanState.ticket.event_name}
              </p>
            </div>
          )}

          <p className="text-muted-foreground mb-4">{scanState.message}</p>

          <Button onClick={handleScanAnother} className="w-full">
            Scan Another Ticket
          </Button>
        </CardContent>
      </Card>
    );
  };

  // Choose layout based on role
  const Layout = role === "owner" ? OwnerPortalLayout : EmployeePortalLayout;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header with Event Selector and Sync */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="event-filter" className="sr-only">Filter by Event</Label>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger id="event-filter">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {eventNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {/* Online/Offline indicator */}
            {isOnline ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Cloud className="h-3 w-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}

            {/* Sync button */}
            {pendingScans > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={!isOnline || isSyncing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
                Sync ({pendingScans})
              </Button>
            )}
          </div>
        </div>

        {/* Scan Mode Tabs */}
        <Card>
          <Tabs value={scanMode} onValueChange={(v) => setScanMode(v as ScanMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                <span className="hidden sm:inline">Manual</span>
              </TabsTrigger>
              <TabsTrigger value="qr" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">QR Camera</span>
              </TabsTrigger>
              <TabsTrigger value="nfc" className="flex items-center gap-2">
                <Radio className="h-4 w-4" />
                <span className="hidden sm:inline">NFC</span>
              </TabsTrigger>
            </TabsList>

            {/* Manual Entry */}
            <TabsContent value="manual">
              <CardHeader className="text-center">
                <CardTitle>Enter Ticket ID</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="ticket-id" className="sr-only">Ticket ID</Label>
                    <Input
                      id="ticket-id"
                      type="text"
                      placeholder="Enter ticket ID (e.g., MAGUEY-001)"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      disabled={isProcessing}
                      autoFocus
                      className="text-lg py-6"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full py-6 text-lg"
                    disabled={!manualInput.trim() || isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      "Validate Ticket"
                    )}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>

            {/* QR Scanner - only render when active to ensure proper cleanup */}
            <TabsContent value="qr" forceMount={false}>
              {scanMode === "qr" && (
                <div className="relative">
                  <QrScanner
                    onScanSuccess={handleQrScan}
                    isScanning={true}
                    onError={(error) => {
                      toast({
                        title: "Camera Error",
                        description: error,
                        variant: "destructive",
                      });
                    }}
                  />
                  {/* Result overlay on camera */}
                  {scanState.status !== "idle" && scanState.status !== "scanning" && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-10">
                      <div className={`w-full max-w-sm rounded-lg p-6 text-center ${
                        scanState.status === "success" ? "bg-green-500" :
                        scanState.status === "already_scanned" ? "bg-yellow-500" :
                        "bg-red-500"
                      }`}>
                        <div className="flex justify-center mb-3">
                          {scanState.status === "success" && <CheckCircle2 className="h-12 w-12 text-white" />}
                          {scanState.status === "already_scanned" && <AlertCircle className="h-12 w-12 text-white" />}
                          {scanState.status === "error" && <XCircle className="h-12 w-12 text-white" />}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">
                          {scanState.status === "success" ? "Entry Granted" :
                           scanState.status === "already_scanned" ? "Already Scanned" :
                           "Entry Denied"}
                        </h3>
                        {scanState.ticket && (
                          <p className="text-white font-medium mb-1">
                            {scanState.ticket.guest_name || "Guest"}
                          </p>
                        )}
                        <p className="text-white/80 text-sm mb-4">{scanState.message}</p>
                        <Button
                          onClick={handleScanAnother}
                          variant="secondary"
                          className="w-full"
                        >
                          Scan Another
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* NFC Scanner - only render when active */}
            <TabsContent value="nfc" forceMount={false}>
              {scanMode === "nfc" && (
                <NFCScanner
                  onScanSuccess={handleNfcScan}
                  isScanning={scanState.status === "idle" || scanState.status === "scanning"}
                  onError={(error) => {
                    toast({
                      title: "NFC Error",
                      description: error,
                      variant: "destructive",
                    });
                  }}
                />
              )}
            </TabsContent>
          </Tabs>
        </Card>

        {/* Scan Result - only show outside QR mode (QR has overlay) */}
        {scanMode !== "qr" && renderScanResult()}

        {/* Processing Indicator */}
        {scanState.status === "scanning" && (
          <Card className="border-primary/50">
            <CardContent className="p-6 text-center">
              <RefreshCw className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-lg">{scanState.message}</p>
            </CardContent>
          </Card>
        )}

        {/* Offline Queue Status */}
        {pendingScans > 0 && !isOnline && (
          <Alert>
            <WifiOff className="h-4 w-4" />
            <AlertTitle>Offline Mode</AlertTitle>
            <AlertDescription>
              {pendingScans} scan{pendingScans !== 1 ? "s" : ""} queued.
              They will sync automatically when you're back online.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Layout>
  );
};

export default Scanner;
