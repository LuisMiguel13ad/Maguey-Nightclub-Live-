import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useWakeLock } from "@/hooks/use-wake-lock";
import {
  Keyboard,
  Camera,
  Radio,
  RefreshCw,
  WifiOff,
  Cloud,
  ChevronDown,
  Menu,
  LogOut,
  ListChecks,
  Settings,
  Ticket,
} from "lucide-react";
import { SuccessOverlay } from "@/components/scanner/SuccessOverlay";
import { RejectionOverlay, RejectionReason } from "@/components/scanner/RejectionOverlay";
import { ScanHistory, ScanHistoryEntry } from "@/components/scanner/ScanHistory";
import { CheckInCounter } from "@/components/scanner/CheckInCounter";
import { OfflineBanner } from "@/components/scanner/OfflineBanner";
import { OfflineAcknowledgeModal } from "@/components/scanner/OfflineAcknowledgeModal";
import { BatteryIndicator } from "@/components/scanner/BatteryIndicator";
import { QrScanner } from "@/components/QrScanner";
import { NFCScanner } from "@/components/NFCScanner";
import {
  scanTicket,
  scanTicketOffline,
  getEventsFromTickets,
  debugGetSampleTickets,
} from "@/lib/simple-scanner";
import { ensureCacheIsFresh } from "@/lib/offline-ticket-cache";
import {
  queueScan,
  syncPendingScans,
  getSyncStatus,
} from "@/lib/offline-queue-service";
import { sendHeartbeat } from "@/lib/scanner-status-service";
import {
  hapticSuccess,
  hapticRejection,
  hapticVIP,
  hapticReentry,
} from "@/lib/audio-feedback-service";
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
  status: "idle" | "scanning" | "success" | "error" | "already_scanned" | "reentry";
  ticket: TicketType | null;
  message: string;
  rejectionReason?: RejectionReason;
  rejectionDetails?: {
    previousScan?: { staff: string; gate: string; time: string };
    wrongEventDate?: string;
  };
  vipInfo?: {
    tableName: string;
    tableNumber: string;
    reservationId: string;
  };
}

interface VipLinkInfo {
  isVipGuest: boolean;
  tableNumber: number | null;
  purchaserName: string | null;
}

/**
 * Determine ticket type for overlay display
 */
const determineTicketType = (
  ticket: TicketType | null,
  vipInfo: VipLinkInfo
): 'ga' | 'vip_reservation' | 'vip_guest' => {
  if (vipInfo.isVipGuest) return 'vip_guest';
  if (ticket?.ticket_type?.toLowerCase().includes('vip')) return 'vip_reservation';
  return 'ga';
};

// Cooldown period after a scan (ms)
const SCAN_COOLDOWN = 2500;

const Scanner = () => {
  const { user } = useAuth();
  const role = useRole();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Keep screen awake while scanner is active
  const { isSupported: wakeLockSupported, isLocked } = useWakeLock(
    scanMode === "qr" || scanMode === "nfc" // Active when in scanning mode
  );

  // State
  const [scanMode, setScanMode] = useState<ScanMode>("qr");
  const [manualInput, setManualInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanState, setScanState] = useState<ScanState>({
    status: "idle",
    ticket: null,
    message: "",
  });

  // VIP Guest link info
  const [vipLinkInfo, setVipLinkInfo] = useState<VipLinkInfo>({
    isVipGuest: false,
    tableNumber: null,
    purchaserName: null,
  });

  // Prevent duplicate scans
  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  // Track component mount state to prevent setState after unmount
  const mountedRef = useRef(true);

  // Event filter
  const [selectedEvent, setSelectedEvent] = useState<string>("all");
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  // Offline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingScans, setPendingScans] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineAcknowledged, setOfflineAcknowledged] = useState(false);

  // Scan history state
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const MAX_HISTORY_ENTRIES = 10;

  // Selected event ID for counter (separate from name for API queries)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Scans today counter (for heartbeat reporting)
  const [scansToday, setScansToday] = useState(() => {
    const saved = localStorage.getItem('scans_today');
    const savedDate = localStorage.getItem('scans_today_date');
    const today = new Date().toDateString();
    if (savedDate === today && saved) return parseInt(saved, 10);
    return 0;
  });

  // Load events on mount and debug tickets
  useEffect(() => {
    const loadEvents = async () => {
      const eventList = await getEventsFromTickets(supabase);
      // Guard: Only update state if component is still mounted
      if (mountedRef.current) {
        setEvents(eventList);
      }
      await debugGetSampleTickets(supabase);
    };
    loadEvents();
  }, []);

  // Track mount state to prevent setState calls after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load scan history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('scan_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        setScanHistory(parsed.map((e: ScanHistoryEntry & { timestamp: string }) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        })));
      } catch (error) {
        console.error('Failed to load scan history:', error);
      }
    }
  }, []);

  /**
   * Add a scan entry to history
   */
  const addToHistory = (entry: Omit<ScanHistoryEntry, 'id'>) => {
    setScanHistory(prev => {
      const newEntry = { ...entry, id: crypto.randomUUID() };
      const updated = [newEntry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
      // Persist to localStorage for reload recovery
      localStorage.setItem('scan_history', JSON.stringify(updated));
      return updated;
    });
  };

  /**
   * Toggle expansion of a history entry
   */
  const toggleHistoryExpand = (id: string) => {
    setScanHistory(prev => prev.map(entry =>
      entry.id === id ? { ...entry, expanded: !entry.expanded } : entry
    ));
  };

  /**
   * Determine ticket type label for history
   */
  const determineTicketTypeLabel = (
    ticket: TicketType | null,
    vipInfo: VipLinkInfo
  ): 'GA' | 'VIP' | 'VIP Guest' => {
    if (vipInfo.isVipGuest) return 'VIP Guest';
    if (ticket?.ticket_type?.toLowerCase().includes('vip')) return 'VIP';
    return 'GA';
  };

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setOfflineAcknowledged(false); // Reset for next offline event
    };
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
      // Guard: Only update state if component is still mounted
      if (mountedRef.current) {
        setPendingScans(status.pending + status.failed);
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Refresh ticket cache when event is selected (for offline scanning)
  useEffect(() => {
    if (selectedEventId && navigator.onLine) {
      ensureCacheIsFresh(selectedEventId).then(result => {
        if (result.status === 'refreshed') {
          console.log('[Scanner] Refreshed ticket cache:', result.ticketCount, 'tickets');
        }
      }).catch(err => {
        console.error('[Scanner] Failed to refresh ticket cache:', err);
      });
    }
  }, [selectedEventId]);

  // Send heartbeat every 30 seconds
  useEffect(() => {
    const sendStatus = async () => {
      if (!mountedRef.current) return;
      const syncStatus = await getSyncStatus();
      await sendHeartbeat({
        eventId: selectedEventId || undefined,
        eventName: selectedEvent !== 'all' ? selectedEvent : undefined,
        pendingScans: syncStatus.pending + syncStatus.failed,
        scansToday,
      });
    };

    // Send immediately
    sendStatus();

    // Then every 30 seconds
    const interval = setInterval(sendStatus, 30000);
    return () => clearInterval(interval);
  }, [selectedEventId, selectedEvent, scansToday]);

  // Check if a ticket is linked to a VIP reservation
  const checkVipLink = async (ticketId: string): Promise<VipLinkInfo> => {
    try {
      const { data, error } = await supabase
        .from("vip_linked_tickets")
        .select("*, vip_reservations(table_number, purchaser_name)")
        .eq("ticket_id", ticketId)
        .maybeSingle();

      if (error) {
        console.error("Error checking VIP link:", error);
        return { isVipGuest: false, tableNumber: null, purchaserName: null };
      }

      if (data && data.vip_reservations) {
        return {
          isVipGuest: true,
          tableNumber: data.vip_reservations.table_number,
          purchaserName: data.vip_reservations.purchaser_name,
        };
      }

      return { isVipGuest: false, tableNumber: null, purchaserName: null };
    } catch (err) {
      console.error("Error in checkVipLink:", err);
      return { isVipGuest: false, tableNumber: null, purchaserName: null };
    }
  };

  // Handle Mode Switching with Cleanup
  const handleModeChange = (mode: ScanMode) => {
    setScanMode(mode);
    setScanState({ status: "idle", ticket: null, message: "" });
    setVipLinkInfo({ isVipGuest: false, tableNumber: null, purchaserName: null });
    setManualInput("");
    setIsProcessing(false);
  };

  // Process a scan input (from manual, QR, or NFC)
  const processScan = async (input: string, method: ScanMode) => {
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    setScanState({ status: "scanning", ticket: null, message: "Looking up ticket..." });

    try {
      // If offline, use local cache validation
      if (!isOnline) {
        // Validate against cache instead of just queueing
        const result = await scanTicketOffline(input.trim(), user?.id, selectedEventId || undefined);

        // Guard: Don't update state if component unmounted
        if (!mountedRef.current) return;

        if (result.success) {
          // Queue for sync when back online
          await queueScan(input.trim(), user?.id, {
            ticketIdString: input.trim(),
            scanMetadata: {
              eventId: selectedEventId || undefined,
              ticketType: result.ticket?.ticket_type,
              attendeeName: result.ticket?.guest_name || undefined,
            },
          });

          setScanState({
            status: "success",
            ticket: result.ticket,
            message: result.message,
          });

          // Haptic feedback for offline success
          hapticSuccess();

          // Add to history (offline success)
          addToHistory({
            timestamp: new Date(),
            status: 'success',
            ticketType: determineTicketTypeLabel(result.ticket, { isVipGuest: false, tableNumber: null, purchaserName: null }),
            guestName: result.ticket?.guest_name,
            eventName: result.ticket?.event_name,
          });

          // Increment scans today counter
          setScansToday(prev => {
            const newCount = prev + 1;
            localStorage.setItem('scans_today', String(newCount));
            localStorage.setItem('scans_today_date', new Date().toDateString());
            return newCount;
          });

          // Show toast if there's an offline warning
          if (result.offlineWarning) {
            toast({
              title: "Offline Scan",
              description: result.offlineWarning,
            });
          }
        } else {
          setScanState({
            status: result.alreadyScanned ? "already_scanned" : "error",
            ticket: result.ticket,
            message: result.message,
            rejectionReason: result.rejectionReason,
            rejectionDetails: result.rejectionDetails,
          });

          // Haptic feedback for offline rejection
          hapticRejection();

          // Add to history (offline failure)
          addToHistory({
            timestamp: new Date(),
            status: 'failure',
            ticketType: result.ticket?.ticket_type?.toLowerCase().includes('vip') ? 'VIP' : 'GA',
            guestName: result.ticket?.guest_name,
            eventName: result.ticket?.event_name,
            errorReason: result.message,
          });
        }

        setManualInput("");
        setIsProcessing(false);
        return;
      }

      // Online: perform the scan
      const result = await scanTicket(input.trim(), user?.id, method, supabase);

      // Guard: Don't update state if component unmounted
      if (!mountedRef.current) return;

      // Check event filter
      if (selectedEvent !== "all" && result.ticket && result.ticket.event_name !== selectedEvent) {
        setScanState({
          status: "error",
          ticket: result.ticket,
          message: `This ticket is for "${result.ticket.event_name}", not the selected event`,
          rejectionReason: 'wrong_event',
          rejectionDetails: {
            wrongEventDate: result.ticket.event_name,
          },
        });

        // Haptic feedback for wrong event rejection
        hapticRejection();

        // Add to history (wrong event)
        addToHistory({
          timestamp: new Date(),
          status: 'failure',
          ticketType: result.ticket.ticket_type?.toLowerCase().includes('vip') ? 'VIP' : 'GA',
          guestName: result.ticket.guest_name,
          eventName: result.ticket.event_name,
          errorReason: `Wrong event: ${result.ticket.event_name}`,
        });

        setManualInput("");
        setIsProcessing(false);
        return;
      }

      if (result.success) {
        // Check if this is a re-entry (VIP-linked ticket scanned again)
        const isReentry = result.rejectionReason === 'reentry';

        setScanState({
          status: isReentry ? "reentry" : "success",
          ticket: result.ticket,
          message: result.message,
          vipInfo: result.vipInfo,
        });

        // Check if this ticket is linked to a VIP reservation (for display)
        // VipInfo is now returned directly from scanTicket for linked tickets
        let ticketVipInfo: VipLinkInfo = { isVipGuest: false, tableNumber: null, purchaserName: null };
        if (result.vipInfo) {
          // Use vipInfo from scan result
          ticketVipInfo = {
            isVipGuest: true,
            tableNumber: parseInt(result.vipInfo.tableNumber) || null,
            purchaserName: null,
          };
          if (mountedRef.current) {
            setVipLinkInfo(ticketVipInfo);
          }
        } else if (result.ticket?.id) {
          // Fallback: check VIP link for non-linked tickets (backward compatibility)
          ticketVipInfo = await checkVipLink(result.ticket.id);
          if (mountedRef.current) {
            setVipLinkInfo(ticketVipInfo);
          }
        }

        // Haptic feedback based on scan type
        if (isReentry) {
          hapticReentry(); // Double pulse for re-entry
        } else if (ticketVipInfo.isVipGuest || result.vipInfo) {
          hapticVIP(); // Triple pulse for VIP
        } else {
          hapticSuccess(); // Quick buzz for regular success
        }

        // Add to history (online success or re-entry)
        addToHistory({
          timestamp: new Date(),
          status: 'success',
          ticketType: determineTicketTypeLabel(result.ticket, ticketVipInfo),
          guestName: result.ticket?.guest_name,
          eventName: result.ticket?.event_name,
        });

        // Increment scans today counter
        setScansToday(prev => {
          const newCount = prev + 1;
          localStorage.setItem('scans_today', String(newCount));
          localStorage.setItem('scans_today_date', new Date().toDateString());
          return newCount;
        });
      } else if (result.alreadyScanned) {
        setScanState({
          status: "already_scanned",
          ticket: result.ticket,
          message: result.message,
          rejectionReason: result.rejectionReason || 'already_used',
          rejectionDetails: result.rejectionDetails || {
            previousScan: {
              staff: 'Staff',
              gate: 'Gate',
              time: 'Earlier',
            },
          },
        });

        // Haptic feedback for already scanned rejection
        hapticRejection();

        // Add to history (already scanned)
        addToHistory({
          timestamp: new Date(),
          status: 'failure',
          ticketType: result.ticket?.ticket_type?.toLowerCase().includes('vip') ? 'VIP' : 'GA',
          guestName: result.ticket?.guest_name,
          eventName: result.ticket?.event_name,
          errorReason: 'Already scanned',
        });
      } else {
        // Determine reason based on message content
        let rejectionReason: RejectionReason = 'invalid';
        if (result.message?.toLowerCase().includes('not found') ||
          result.message?.toLowerCase().includes('does not exist')) {
          rejectionReason = 'not_found';
        } else if (result.message?.toLowerCase().includes('expired')) {
          rejectionReason = 'expired';
        }

        setScanState({
          status: "error",
          ticket: null,
          message: result.message,
          rejectionReason,
        });

        // Haptic feedback for other rejection types
        hapticRejection();

        // Add to history (other failure)
        addToHistory({
          timestamp: new Date(),
          status: 'failure',
          ticketType: 'GA',
          errorReason: result.message,
        });
      }
    } catch (error) {
      console.error("Scan error:", error);

      // Guard: Don't update state if component unmounted
      if (!mountedRef.current) return;

      setScanState({
        status: "error",
        ticket: null,
        message: "An error occurred while scanning",
        rejectionReason: 'invalid',
      });

      // Haptic feedback for system error
      hapticRejection();

      // Add to history (exception)
      addToHistory({
        timestamp: new Date(),
        status: 'failure',
        ticketType: 'GA',
        errorReason: 'System error',
      });
    }

    // Guard: Don't update state if component unmounted
    if (!mountedRef.current) return;

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

      // Guard: Don't update state if component unmounted
      if (!mountedRef.current) return;

      toast({
        title: "Sync Complete",
        description: `Synced ${result.success} of ${result.total} scans`,
      });
      const status = await getSyncStatus();

      // Guard: Don't update state if component unmounted
      if (!mountedRef.current) return;

      setPendingScans(status.pending + status.failed);
    } catch (error) {
      // Guard: Don't update state if component unmounted
      if (!mountedRef.current) return;

      toast({
        title: "Sync Failed",
        description: "Could not sync pending scans",
        variant: "destructive",
      });
    }

    // Guard: Don't update state if component unmounted
    if (!mountedRef.current) return;

    setIsSyncing(false);
  };

  // Reset to scan another
  const handleScanAnother = () => {
    setScanState({ status: "idle", ticket: null, message: "", rejectionReason: undefined, rejectionDetails: undefined });
    setVipLinkInfo({ isVipGuest: false, tableNumber: null, purchaserName: null });
    setManualInput("");
    lastScannedRef.current = "";
    lastScanTimeRef.current = 0;
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
      // Continue to login page even if signOut fails
    } finally {
      navigate("/auth");
    }
  };

  // Nav Links for Sidebar
  const navItems = [
    { title: "Scanner", icon: Camera, path: "/scanner" },
    { title: "Guest List", icon: ListChecks, path: "/guest-list" },
    { title: "Settings", icon: Settings, path: "/crew/settings" },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-black text-white relative overflow-hidden flex flex-col font-sans">

      {/* Offline Banner - very top, above everything */}
      <OfflineBanner className="fixed top-0 left-0 right-0 z-[70]" />

      {/* Offline Acknowledge Modal - requires acknowledgment before continuing */}
      {!isOnline && !offlineAcknowledged && (
        <OfflineAcknowledgeModal
          onAcknowledge={() => setOfflineAcknowledged(true)}
        />
      )}

      {/* Check-in Counter - below offline banner (when shown) */}
      <div className={cn(
        "fixed left-0 right-0 z-[65]",
        !isOnline ? "top-[52px]" : "top-0"
      )}>
        <CheckInCounter eventId={selectedEventId} />
      </div>

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
            <DropdownMenuItem
              onClick={() => {
                setSelectedEvent("all");
                setSelectedEventId(null);
              }}
              className="focus:bg-white/10 cursor-pointer"
            >
              All Events
            </DropdownMenuItem>
            {events.map((event) => (
              <DropdownMenuItem
                key={event.id}
                onClick={() => {
                  setSelectedEvent(event.name);
                  setSelectedEventId(event.id);
                }}
                className="focus:bg-white/10 cursor-pointer"
              >
                {event.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Battery and Sync Status */}
        <div className="flex items-center gap-2">
          <BatteryIndicator />
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
                    onChange={(e) => setManualInput(e.target.value)}
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

      {/* Scan History - above bottom nav, below scanner */}
      {scanHistory.length > 0 && scanState.status === 'idle' && (
        <div className="fixed bottom-24 left-0 right-0 z-[40] px-4 pb-2">
          <ScanHistory
            entries={scanHistory}
            maxVisible={5}
            onToggleExpand={toggleHistoryExpand}
          />
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <div className="pt-2 pb-8 px-8 bg-black/80 backdrop-blur-2xl border-t border-white/5 z-50 flex items-end justify-between gap-6 fixed bottom-0 left-0 right-0">
        <button
          onClick={() => handleModeChange("manual")}
          className={cn(
            "flex-1 flex flex-col items-center gap-2 p-4 rounded-3xl transition-all duration-300",
            scanMode === "manual"
              ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              : "text-white/40 hover:text-white/80 hover:bg-white/5"
          )}
        >
          <Keyboard className="h-6 w-6" />
          <span className="text-[10px] uppercase font-bold tracking-wider">Manual</span>
        </button>

        <button
          onClick={() => handleModeChange("qr")}
          className={cn(
            "mx-2 -mt-12 h-20 w-20 rounded-full flex items-center justify-center border-[6px] border-black shadow-2xl transition-all duration-300 transform relative z-10",
            scanMode === "qr"
              ? "bg-purple-600 text-white shadow-[0_0_30px_rgba(168,85,247,0.4)] scale-110"
              : "bg-zinc-800 text-white/50 hover:bg-zinc-700 hover:text-white"
          )}
        >
          <Camera className={cn("h-8 w-8 transition-transform", scanMode === "qr" ? "scale-110" : "")} />
        </button>

        <button
          onClick={() => handleModeChange("nfc")}
          className={cn(
            "flex-1 flex flex-col items-center gap-2 p-4 rounded-3xl transition-all duration-300",
            scanMode === "nfc"
              ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              : "text-white/40 hover:text-white/80 hover:bg-white/5"
          )}
        >
          <Radio className="h-6 w-6" />
          <span className="text-[10px] uppercase font-bold tracking-wider">NFC</span>
        </button>
      </div>

      {/* Success Overlay - Full screen green */}
      {(scanState.status === "success" || scanState.status === "reentry") && (
        <SuccessOverlay
          ticketType={determineTicketType(scanState.ticket, vipLinkInfo)}
          guestName={scanState.ticket?.guest_name || undefined}
          vipDetails={
            vipLinkInfo.isVipGuest || scanState.vipInfo ? {
              tableName: scanState.vipInfo?.tableName || `Table ${vipLinkInfo.tableNumber}`,
              tier: 'VIP',
              guestCount: 1,
              holderName: vipLinkInfo.purchaserName || 'VIP Host'
            } : undefined
          }
          isReentry={scanState.status === "reentry"}
          lastEntryTime={
            scanState.status === "reentry" && scanState.ticket?.scanned_at
              ? new Date(scanState.ticket.scanned_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })
              : undefined
          }
          onDismiss={handleScanAnother}
        />
      )}

      {/* Rejection Overlay - Full screen red */}
      {(scanState.status === "error" || scanState.status === "already_scanned") && (
        <RejectionOverlay
          reason={scanState.rejectionReason || (scanState.status === "already_scanned" ? 'already_used' : 'invalid')}
          details={{
            previousScan: scanState.rejectionDetails?.previousScan,
            wrongEventDate: scanState.rejectionDetails?.wrongEventDate,
            message: scanState.message
          }}
          onDismiss={handleScanAnother}
        />
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
    </div >
  );
};

export default Scanner;
