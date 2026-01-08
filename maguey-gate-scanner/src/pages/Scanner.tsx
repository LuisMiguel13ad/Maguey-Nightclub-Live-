import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Cloud,
  ChevronDown,
  Menu,
  LogOut,
  ListChecks,
  Settings,
  User,
  Zap,
  Ticket
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
import { Ticket as TicketType } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ScanMode = "manual" | "qr" | "nfc";

interface ScanState {
  status: "idle" | "scanning" | "success" | "error" | "already_scanned";
  ticket: TicketType | null;
  message: string;
}

// Cooldown period after a scan (ms)
const SCAN_COOLDOWN = 2500;

const Scanner = () => {
  const { user } = useAuth();
  const role = useRole();
  const { toast } = useToast();
  const navigate = useNavigate();

  // State
  const [scanMode, setScanMode] = useState<ScanMode>("qr");
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
  const [menuOpen, setMenuOpen] = useState(false);

  // Offline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingScans, setPendingScans] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load event names on mount and debug tickets
  useEffect(() => {
    const loadEvents = async () => {
      const names = await getEventNamesFromTickets();
      setEventNames(names);
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

  // Handle Mode Switching with Cleanup
  const handleModeChange = (mode: ScanMode) => {
    setScanMode(mode);
    setScanState({ status: "idle", ticket: null, message: "" });
    setManualInput("");
    setIsProcessing(false);
  };

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

  // Handle QR scan with debounce
  const handleQrScan = (decodedText: string) => {
    const now = Date.now();
    if (
      decodedText === lastScannedRef.current &&
      now - lastScanTimeRef.current < SCAN_COOLDOWN
    ) {
      return;
    }
    if (scanState.status !== "idle" && scanState.status !== "scanning") {
      return;
    }
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
    lastScannedRef.current = "";
    lastScanTimeRef.current = 0;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Nav Links for Sidebar
  const navItems = [
    { title: "Scanner", icon: Camera, path: "/scanner" },
    { title: "Guest List", icon: ListChecks, path: "/guest-list" },
    { title: "Settings", icon: Settings, path: "/crew/settings" },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white relative overflow-hidden flex flex-col font-sans">

      {/* Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full h-12 w-12">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-[#0a0a0a] border-r border-white/10 text-white w-[85vw] max-w-sm p-0">
            <SheetHeader className="p-6 border-b border-white/10 text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-purple-600 flex items-center justify-center">
                  <Ticket className="h-6 w-6 text-white" />
                </div>
                <div>
                  <SheetTitle className="text-white">Maguey Scanner</SheetTitle>
                  <p className="text-xs text-white/50">{role === 'owner' ? 'Owner Access' : 'Staff Access'}</p>
                </div>
              </div>
            </SheetHeader>

            <div className="p-4 space-y-2">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  className="w-full justify-start text-lg h-14 gap-4 text-white/80 hover:text-white hover:bg-white/5 rounded-xl"
                  onClick={() => {
                    navigate(item.path);
                    setMenuOpen(false);
                  }}
                >
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </Button>
              ))}
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-white/10 bg-black/50">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-10 w-10 border border-white/10">
                  <AvatarFallback className="bg-white/10 text-white">{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                  <p className="text-xs text-white/50 truncate">Logged in</p>
                </div>
              </div>
              <Button
                variant="destructive"
                className="w-full justify-start gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Event Selector (Center) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="bg-black/40 backdrop-blur-md border border-white/10 text-white rounded-full px-4 py-2 h-10 hover:bg-black/60 transition-all max-w-[140px] sm:max-w-xs">
              <span className="mr-2 truncate text-sm font-medium">
                {selectedEvent === "all" ? "All Events" : selectedEvent}
              </span>
              <ChevronDown className="h-3 w-3 opacity-70 flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-black/90 border-white/10 backdrop-blur-xl text-white">
            <DropdownMenuItem onClick={() => setSelectedEvent("all")} className="focus:bg-white/10 cursor-pointer">
              All Events
            </DropdownMenuItem>
            {eventNames.map((name) => (
              <DropdownMenuItem key={name} onClick={() => setSelectedEvent(name)} className="focus:bg-white/10 cursor-pointer">
                {name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sync Status Button */}
        <div className="relative">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSync}
            className={cn("bg-black/40 backdrop-blur-md text-white border border-white/10 rounded-full h-12 w-12 hover:bg-white/10",
              !isOnline && "text-red-500 border-red-500/50",
              isSyncing && "animate-spin text-yellow-500 border-yellow-500/50"
            )}
          >
            {isOnline ? <Cloud className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
          </Button>
          {pendingScans > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-yellow-500 text-[10px] font-bold text-black flex items-center justify-center border-2 border-black">
              {pendingScans}
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area - Full Screen */}
      <div className="flex-1 relative flex flex-col justify-center items-center">

        {/* SCANNER VIEW */}
        {scanMode === "qr" && (
          <div className="absolute inset-0 bg-black">
            {/* Camera Feed */}
            <div className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full">
              <QrScanner
                onScanSuccess={handleQrScan}
                isScanning={true}
                minimal={true}
                onError={(err) => {
                  // Don't show toast, we'll show inline UI
                }}
              />
            </div>

            {/* Viewfinder Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-12">
              <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]">
                {/* Corners */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-purple-500 rounded-tl-2xl shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-purple-500 rounded-tr-2xl shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-purple-500 rounded-bl-2xl shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-purple-500 rounded-br-2xl shadow-[0_0_10px_rgba(168,85,247,0.5)]" />

                {/* Scanning Animation */}
                <div className="absolute inset-x-4 top-0 h-1 bg-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.8)] animate-[scan_2.5s_ease-in-out_infinite]" />

                {/* Center Icon hint */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <Camera className="h-16 w-16 text-white" />
                </div>
              </div>

              <p className="mt-8 text-white/80 bg-black/60 backdrop-blur px-4 py-2 rounded-full text-sm font-medium border border-white/10">
                Align QR code within frame
              </p>
            </div>
          </div>
        )}

        {/* MANUAL VIEW */}
        {scanMode === "manual" && (
          <div className="absolute inset-0 bg-[#050505] flex items-center justify-center px-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="w-full max-w-md space-y-8 text-center pb-20">
              <div className="w-24 h-24 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto ring-1 ring-purple-500/20">
                <Keyboard className="h-10 w-10 text-purple-500" />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Manual Entry</h2>
                <p className="text-white/50">Enter the alphanumeric code from the ticket</p>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="MAGUEY-XXXX"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                    disabled={isProcessing}
                    className="bg-zinc-900/50 border-white/10 text-center text-2xl h-16 text-white placeholder:text-white/20 rounded-2xl focus:ring-purple-500 focus:border-purple-500 transition-all uppercase tracking-widest font-mono"
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!manualInput.trim() || isProcessing}
                  className="w-full h-14 text-lg font-bold rounded-2xl bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/20"
                >
                  {isProcessing ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : "Verify Ticket"}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* NFC VIEW */}
        {scanMode === "nfc" && (
          <div className="absolute inset-0 bg-[#050505] flex items-center justify-center px-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="w-full max-w-md text-center pb-20">
              <div className="relative mb-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="relative z-10 w-32 h-32 bg-black border border-white/10 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                  <Radio className="h-12 w-12 text-purple-500" />
                </div>
                {/* Ripple Effect */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white/5 rounded-full animate-ping [animation-duration:3s]" />
              </div>

              <h2 className="text-3xl font-bold tracking-tight mb-2">Ready to Scan</h2>
              <p className="text-white/50 mb-8 max-w-[260px] mx-auto">Hold the NFC tag near the top back of your device</p>

              <NFCScanner
                onScanSuccess={handleNfcScan}
                isScanning={true}
                onError={(err) => {
                  // handled internally or we can toast
                }}
              />
            </div>
          </div>
        )}

      </div>

      {/* Bottom Navigation Bar */}
      <div className="pt-2 pb-6 px-6 bg-black/90 backdrop-blur-xl border-t border-white/5 z-50 flex items-end justify-between gap-2">
        <button
          onClick={() => handleModeChange("manual")}
          className={cn(
            "flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all duration-300",
            scanMode === "manual" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60 active:scale-95"
          )}
        >
          <Keyboard className="h-6 w-6" />
          <span className="text-xs font-medium">Manual</span>
        </button>

        <button
          onClick={() => handleModeChange("qr")}
          className={cn(
            "mx-2 -mt-10 h-16 w-16 rounded-full flex items-center justify-center border-4 border-black shadow-lg shadow-purple-500/20 transition-all duration-300 transform",
            scanMode === "qr" ? "bg-purple-600 text-white scale-110 rotate-0" : "bg-zinc-800 text-white/50 hover:bg-zinc-700 hover:text-white"
          )}
        >
          <Camera className="h-6 w-6" />
        </button>

        <button
          onClick={() => handleModeChange("nfc")}
          className={cn(
            "flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all duration-300",
            scanMode === "nfc" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60 active:scale-95"
          )}
        >
          <Radio className="h-6 w-6" />
          <span className="text-xs font-medium">NFC</span>
        </button>
      </div>

      {/* Result Overlay */}
      {(scanState.status === "success" || scanState.status === "error" || scanState.status === "already_scanned") && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in zoom-in duration-300 p-6">
          <div className="w-full max-w-sm text-center space-y-8">

            {/* Status Icon */}
            <div className="flex justify-center">
              {scanState.status === "success" && (
                <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center ring-4 ring-green-500/30 animate-[bounce_1s_ease-in-out]">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
              )}
              {scanState.status === "already_scanned" && (
                <div className="w-24 h-24 rounded-full bg-yellow-500/20 flex items-center justify-center ring-4 ring-yellow-500/30">
                  <AlertCircle className="h-12 w-12 text-yellow-500" />
                </div>
              )}
              {scanState.status === "error" && (
                <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center ring-4 ring-red-500/30 shake">
                  <XCircle className="h-12 w-12 text-red-500" />
                </div>
              )}
            </div>

            {/* Status Text */}
            <div className="space-y-2">
              <h2 className={cn(
                "text-3xl font-black uppercase tracking-tight",
                scanState.status === "success" && "text-green-500",
                scanState.status === "already_scanned" && "text-yellow-500",
                scanState.status === "error" && "text-red-500",
              )}>
                {scanState.status === "success" ? "ACCESS GRANTED" :
                  scanState.status === "already_scanned" ? "ALREADY USED" :
                    "ACCESS DENIED"}
              </h2>
              <p className="text-white/60 text-lg leading-relaxed">{scanState.message}</p>
            </div>

            {/* Ticket Details */}
            {scanState.ticket && (
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 text-left space-y-4 shadow-xl">
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">Guest Name</p>
                  <p className="text-xl font-bold text-white truncate">{scanState.ticket.guest_name || "Unknown Guest"}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">Type</p>
                    <p className="text-sm font-medium text-white">{scanState.ticket.ticket_type || "Standard"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-1">Event</p>
                    <p className="text-sm font-medium text-white truncate">{scanState.ticket.event_name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <Button
              onClick={handleScanAnother}
              className={cn(
                "w-full h-14 text-lg font-bold rounded-2xl shadow-lg transition-all hover:scale-[1.02]",
                scanState.status === "success" ? "bg-green-600 hover:bg-green-500 text-white" :
                  scanState.status === "already_scanned" ? "bg-yellow-600 hover:bg-yellow-500 text-white" :
                    "bg-red-600 hover:bg-red-500 text-white"
              )}
            >
              Scan Next Ticket
            </Button>
          </div>
        </div>
      )}

      {/* Global CSS for animations */}
      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
};

export default Scanner;
