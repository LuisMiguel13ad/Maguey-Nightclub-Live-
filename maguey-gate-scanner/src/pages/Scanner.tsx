import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { localStorageService } from "@/lib/localStorage";
import { validateTicketId, sanitizeTicketId } from "@/lib/ticketValidation";
import { lookupTicketByQR, lookupTicketByNFC, scanTicket } from "@/lib/scanner-service";
import { isNFCAvailable, type NFCTicketPayload, type ScanMethod } from "@/lib/nfc-service";
import { getEventCapacity, checkCapacityBeforeScan, type CapacityStatus } from "@/lib/capacity-service";
import { getTicketTransferInfo, checkNameMatch, type TicketTransferInfo } from "@/lib/transfer-service";
import { checkRefundBeforeScan, getTicketRefundInfo, type RefundInfo } from "@/lib/refund-service";
import { approveBatch, getPartySize, type QueuedTicket } from "@/lib/batch-scan-service";
import { useAuth } from "@/contexts/AuthContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import EmployeePortalLayout from "@/components/layout/EmployeePortalLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { WifiOff, Camera, Keyboard, Users, AlertTriangle, XCircle, Layers, RefreshCw, Cloud, CloudOff, Settings, Volume2, VolumeX, Vibrate, TrendingUp, Radio } from "lucide-react";
import { 
  queueScan, 
  syncPendingScans, 
  getSyncStatus, 
  startAutoSync, 
  stopAutoSync,
  type QueuedScan 
} from "@/lib/offline-queue-service";
import { 
  playSuccess, 
  playError, 
  playWarning, 
  playBatchApproved,
  getAudioSettings,
  saveAudioSettings,
  testSound
} from "@/lib/audio-feedback-service";
import { 
  getReEntryMode, 
  setReEntryMode, 
  type ReEntryMode 
} from "@/lib/re-entry-service";
import { QrScanner } from "@/components/QrScanner";
import { NFCScanner } from "@/components/NFCScanner";
import { TicketResult } from "@/components/TicketResult";
import { ManualEntry } from "@/components/ManualEntry";
import { ScannerInput } from "@/components/ScannerInput";
import { BatchQueue } from "@/components/BatchQueue";
import { IDVerificationModal } from "@/components/IDVerificationModal";
import { checkIDVerificationRequired } from "@/lib/id-verification-service";
import { OverrideActivationModal } from "@/components/OverrideActivationModal";
import { OverrideReasonModal } from "@/components/OverrideReasonModal";
import { 
  isOverrideActive, 
  getRemainingOverrideTime, 
  deactivateOverride,
  logOverrideAction,
  type OverrideType 
} from "@/lib/emergency-override-service";
import { useRole } from "@/contexts/AuthContext";
import { initializeBatteryMonitoring, getBatteryStatus, updateDeviceStatus } from "@/lib/battery-monitoring-service";
import { initializePowerSaving, getRecommendedScanInterval, getPowerSavingSettings } from "@/lib/power-saving-service";
import { LowBatteryModal } from "@/components/LowBatteryModal";
import { DeviceInfoCard } from "@/components/DeviceInfoCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Stub function for scan logging with duration (to be implemented properly)
const logScanWithDuration = async (_ticketId: string, _status: string, _durationMs: number): Promise<void> => {
  // TODO: Implement scan logging with duration
};

interface VerifiedQrPayload {
  token: string;
  signature: string;
  meta: Record<string, unknown> | null;
  raw: string;
}

const textEncoder = new TextEncoder();

const bufferToBase64 = (buffer: ArrayBuffer): string => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const constantTimeEquals = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const importQrSigningKey = async (): Promise<CryptoKey> => {
  const secret = import.meta.env.VITE_QR_SIGNING_SECRET;
  if (!secret) {
    throw new Error(
      "Missing VITE_QR_SIGNING_SECRET. Set this env variable in the scanner app."
    );
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Web Crypto API unavailable in this environment. Cannot verify QR signatures."
    );
  }
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
};

const verifyQrSignature = async (
  token: string,
  signature: string
): Promise<boolean> => {
  const key = await importQrSigningKey();
  const expectedBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(token)
  );
  const expectedSignature = bufferToBase64(expectedBuffer);
  const matches = constantTimeEquals(signature, expectedSignature);
  console.info("[scanner] QR signature verification result", {
    token,
    matches,
  });
  return matches;
};

const parseAndVerifyQrPayload = async (
  raw: string
): Promise<VerifiedQrPayload> => {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("QR payload is not valid JSON");
  }

  const token = parsed?.token;
  const signature = parsed?.signature;
  const meta = parsed?.meta ?? null;

  if (typeof token !== "string" || typeof signature !== "string") {
    throw new Error("QR payload missing token and signature");
  }

  const isValid = await verifyQrSignature(token, signature);
  if (!isValid) {
    throw new Error("QR signature mismatch");
  }

  return {
    token,
    signature,
    meta,
    raw,
  };
};

interface ScanResult {
  status: "valid" | "used" | "invalid";
  ticket?: any;
  message: string;
  transferInfo?: TicketTransferInfo;
  nameMismatch?: boolean;
  refundInfo?: RefundInfo;
}

const Scanner = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const role = useRole();
  const isOwner = role === "owner";
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanMode, setScanMode] = useState<"camera" | "scanner">("camera"); // Camera or USB scanner
  const [scanMethod, setScanMethod] = useState<ScanMethod>("qr"); // QR or NFC scanning method
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const [batchMode, setBatchMode] = useState(false); // Batch scanning mode
  const [queuedTickets, setQueuedTickets] = useState<QueuedTicket[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [lastQueuedTicketId, setLastQueuedTicketId] = useState<string | null>(null);
  const [capacityStatus, setCapacityStatus] = useState<CapacityStatus | null>(null);
  const [currentEventName, setCurrentEventName] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{
    pending: number;
    syncing: number;
    synced: number;
    failed: number;
    total: number;
  }>({ pending: 0, syncing: 0, synced: 0, failed: 0, total: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [reEntryMode, setReEntryModeState] = useState<ReEntryMode>('single');
  const [audioSettings, setAudioSettings] = useState(getAudioSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [showIDVerificationModal, setShowIDVerificationModal] = useState(false);
  const [pendingTicketForIDVerification, setPendingTicketForIDVerification] = useState<any>(null);
  const [currentScanRate, setCurrentScanRate] = useState<number>(0);
  const [scanMetrics, setScanMetrics] = useState<{
    currentRate: number;
    todayAverage: number;
    peakRate: number;
    peakRateTime: string | null;
  } | null>(null);
  const [overrideActive, setOverrideActive] = useState(false);
  const [overrideTimeRemaining, setOverrideTimeRemaining] = useState(0);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showOverrideReasonModal, setShowOverrideReasonModal] = useState(false);
  const [pendingOverrideType, setPendingOverrideType] = useState<OverrideType | null>(null);
  const [pendingOverrideTicket, setPendingOverrideTicket] = useState<any>(null);
  const [ownerScannerAcknowledged, setOwnerScannerAcknowledged] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  
  // Battery monitoring state - MUST be declared before any early returns to avoid hooks violation
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState(false);
  const [showLowBatteryModal, setShowLowBatteryModal] = useState(false);
  const [lowBatteryWarningShown, setLowBatteryWarningShown] = useState<Set<number>>(new Set());
  
  // Refs - MUST be declared before any early returns
  const lastScanTime = useRef<number>(0);
  const lastScanKey = useRef<string>("");
  const processingTicketKeys = useRef<Set<string>>(new Set());
  const scanStartTime = useRef<number>(0);
  const manualEntryRef = useRef<HTMLDivElement | null>(null);

  // Fetch available events (today and upcoming)
  const { data: events } = useQuery({
    queryKey: ['scanner-events'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('events')
        .select('id, name, event_date, event_time')
        .gte('event_date', today)
        .eq('is_active', true)
        .order('event_date', { ascending: true })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: isSupabaseConfigured(),
  });

  // Auto-select first event if available
  useEffect(() => {
    if (events && events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
      setCurrentEventName(events[0].name);
    }
  }, [events, selectedEventId]);

  // Update current event name when selection changes
  useEffect(() => {
    if (selectedEventId && events) {
      const event = events.find((e: any) => e.id === selectedEventId);
      if (event) {
        setCurrentEventName(event.name);
      }
    }
  }, [selectedEventId, events]);

  useEffect(() => {
    if (!authLoading && role === "owner") {
      setOwnerScannerAcknowledged(false);
    }
  }, [authLoading, role]);

  // Constants
  const SCAN_DEBOUNCE_MS = 1000; // 1 second between scans
  const CAPACITY_REFRESH_INTERVAL = 30000; // Refresh capacity every 30 seconds
  
  // Flag for showing owner acknowledgment screen (used in conditional render at the end)
  const showOwnerAcknowledgment = !authLoading && isOwner && !ownerScannerAcknowledged;


  // Check NFC availability on mount
  useEffect(() => {
    const checkNFC = () => {
      const available = isNFCAvailable();
      setNfcAvailable(available);
      if (!available && scanMethod === 'nfc') {
        // Fallback to QR if NFC not available
        setScanMethod('qr');
        toast({
          title: "NFC Not Available",
          description: "NFC is not supported on this device. Using QR code scanning instead.",
        });
      }
    };
    checkNFC();
  }, [scanMethod, toast]);


  useEffect(() => {
    const checkSession = async () => {
      const isConfigured = isSupabaseConfigured();
      
      if (isConfigured) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          if (!session) {
            navigate("/auth");
            return;
          }
        } catch (error: any) {
          console.error("Session error:", error);
          toast({
            variant: "destructive",
            title: "Authentication Error",
            description: error.message || "Failed to check authentication.",
          });
          navigate("/auth");
          return;
        }
      } else {
        // Development mode - use local storage
        const localUser = localStorageService.getUser();
        if (!localUser) {
          navigate("/auth");
          return;
        }
      }
      
      setIsLoading(false);
    };

    checkSession();
  }, [navigate, toast]);

  // Load capacity status
  useEffect(() => {
    const loadCapacity = async () => {
      // Try to detect current event from recent scans or use default
      // For now, we'll use a default event name - you can enhance this later
      const eventName = currentEventName || "Perreo Fridays"; // Default event
      
      const capacity = await getEventCapacity(eventName);
      if (capacity) {
        setCapacityStatus(capacity);
        setCurrentEventName(eventName);
      }
    };

    loadCapacity();
    
    // Refresh capacity periodically
    const interval = setInterval(loadCapacity, CAPACITY_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [currentEventName]);

  // Initialize battery monitoring and power saving
  useEffect(() => {
    const initBatteryMonitoring = async () => {
      await initializeBatteryMonitoring();
      const cleanup = initializePowerSaving();
      
      // Update battery status periodically
      const updateBattery = async () => {
        const status = await getBatteryStatus();
        if (status) {
          setBatteryLevel(status.level);
          setIsCharging(status.isCharging);
          
          // Check for low battery warnings
          if (!status.isCharging) {
            const warningThresholds = [20, 10, 5];
            for (const threshold of warningThresholds) {
              if (status.level <= threshold && !lowBatteryWarningShown.has(threshold)) {
                // Check if user disabled warnings
                const disabled = localStorage.getItem('low_battery_warning_disabled') === 'true';
                if (!disabled) {
                  setShowLowBatteryModal(true);
                  setLowBatteryWarningShown(prev => new Set(prev).add(threshold));
                }
                break; // Only show one warning at a time
              }
            }
          }
        }
        
        await updateDeviceStatus();
      };
      
      updateBattery();
      const batteryInterval = setInterval(updateBattery, 30000); // Update every 30 seconds
      
      return () => {
        cleanup();
        clearInterval(batteryInterval);
      };
    };

    const cleanup = initBatteryMonitoring();
    return () => {
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [lowBatteryWarningShown]);

  // Scroll to top when component mounts - use useLayoutEffect for synchronous execution
  useLayoutEffect(() => {
    // Immediate scroll - runs before browser paint
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Also use requestAnimationFrame as backup
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, []);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync will handle syncing when online (runs every 5 seconds)
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update sync status periodically
  useEffect(() => {
    const updateSyncStatus = async () => {
      if (isSupabaseConfigured()) {
        const status = await getSyncStatus();
        setSyncStatus(status);
      }
    };

    updateSyncStatus();
    const interval = setInterval(updateSyncStatus, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Start auto-sync on mount
  useEffect(() => {
    if (isSupabaseConfigured()) {
      startAutoSync(5000); // Check every 5 seconds
    }

    return () => {
      if (isSupabaseConfigured()) {
        stopAutoSync();
      }
    };
  }, []);

  // Load re-entry mode on mount
  useEffect(() => {
    const loadReEntryMode = async () => {
      const mode = await getReEntryMode();
      setReEntryModeState(mode);
    };
    loadReEntryMode();
  }, []);

  // Monitor override state
  useEffect(() => {
    const checkOverride = () => {
      const active = isOverrideActive();
      setOverrideActive(active);
      if (active) {
        setOverrideTimeRemaining(getRemainingOverrideTime());
      } else {
        setOverrideTimeRemaining(0);
      }
    };

    checkOverride();
    const interval = setInterval(checkOverride, 1000); // Check every second

    // Listen for override events
    const handleOverrideExpired = () => {
      setOverrideActive(false);
      setOverrideTimeRemaining(0);
      toast({
        title: "Override Mode Expired",
        description: "Emergency override mode has expired",
        variant: "default",
      });
    };

    const handleOverrideDeactivated = () => {
      setOverrideActive(false);
      setOverrideTimeRemaining(0);
    };

    window.addEventListener('override-expired', handleOverrideExpired);
    window.addEventListener('override-deactivated', handleOverrideDeactivated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('override-expired', handleOverrideExpired);
      window.removeEventListener('override-deactivated', handleOverrideDeactivated);
    };
  }, [toast]);

  // Update re-entry mode handler
  const handleReEntryModeChange = (mode: ReEntryMode) => {
    setReEntryMode(mode);
    setReEntryModeState(mode);
  };

  // Update audio settings handler
  const handleAudioSettingsChange = (settings: Partial<typeof audioSettings>) => {
    const newSettings = { ...audioSettings, ...settings };
    saveAudioSettings(newSettings);
    setAudioSettings(newSettings);
  };

  // Manual sync handler
  const handleManualSync = async () => {
    if (!isSupabaseConfigured() || !isOnline) {
      toast({
        variant: "destructive",
        title: "Cannot Sync",
        description: isOnline ? "Supabase not configured" : "You're currently offline. Please check your internet connection.",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncPendingScans();
      const status = await getSyncStatus();
      setSyncStatus(status);

      if (result.total === 0) {
        toast({
          title: "All Synced",
          description: "No pending scans to sync.",
        });
      } else if (result.failed === 0) {
        toast({
          title: "Sync Complete",
          description: `Successfully synced ${result.success} scan${result.success !== 1 ? 's' : ''}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Partial Sync",
          description: `Synced ${result.success} of ${result.total} scans. ${result.failed} failed.`,
        });
      }
    } catch (error: any) {
      console.error('[scanner] Manual sync error:', error);
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error.message || "Failed to sync scans. Please try again.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const scrollToManualEntry = () => {
    manualEntryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const validateTicket = async (input: string | VerifiedQrPayload, method: ScanMethod = 'qr') => {
    const now = Date.now();
    const timeSinceLastScan = now - lastScanTime.current;

    if (isProcessing) {
      console.debug(
        "[scanner] Ignoring scan while another ticket is being processed."
      );
      return;
    }

    const isSecurePayload = typeof input !== "string";
    const payload = isSecurePayload ? (input as VerifiedQrPayload) : null;

    let sanitizedTicketId = "";
    let lookupKey = "";
    let displayLabel = "";
    let payloadMeta: Record<string, unknown> | null = null;

    if (isSecurePayload) {
      lookupKey = payload.token;
      displayLabel = payload.token;
      payloadMeta = payload.meta;
      if (!lookupKey) {
        toast({
          variant: "destructive",
          title: "Invalid QR Payload",
          description: "Ticket token missing from QR data.",
        });
        return;
      }
    } else {
      const validation = validateTicketId(input);
      if (!validation.isValid) {
        toast({
          variant: "destructive",
          title: "Invalid Ticket ID",
          description: validation.error,
        });
        return;
      }
      sanitizedTicketId = validation.sanitized || sanitizeTicketId(input);
      lookupKey = sanitizedTicketId;
      displayLabel = sanitizedTicketId;
    }

    if (processingTicketKeys.current.has(lookupKey)) {
      toast({
        variant: "destructive",
        title: "Already Processing",
        description: "This ticket is currently being verified. Please wait.",
      });
      return;
    }

    if (lookupKey === lastScanKey.current && timeSinceLastScan < SCAN_DEBOUNCE_MS) {
      console.debug("[scanner] Debounced duplicate scan", { lookupKey });
      return;
    }

    processingTicketKeys.current.add(lookupKey);

    const isConfigured = isSupabaseConfigured();
    if (isConfigured && !isOnline) {
      // Queue the scan for later sync
      processingTicketKeys.current.delete(lookupKey);
      
      // When offline, we can't look up tickets, so we queue with the lookup key
      // The sync process will resolve the ticket ID during sync
      try {
        // Use a placeholder ticket ID - we'll resolve it during sync
        // For now, use the lookup key as the ticket ID placeholder
        // The sync service will handle resolving the actual ticket ID
        await queueScan(lookupKey, user?.id, {
          qrToken: isSecurePayload ? lookupKey : undefined,
          ticketIdString: !isSecurePayload ? lookupKey : undefined,
        });

        const status = await getSyncStatus();
        setSyncStatus(status);

        toast({
          title: "Scan Queued",
          description: `Ticket queued for sync (${status.pending + status.failed} pending). Will sync when online.`,
        });

        // Show a queued result
        setScanResult({
          status: "valid",
          message: "Scan queued - will sync when online",
        });
      } catch (error: any) {
        console.error('[scanner] Failed to queue scan:', error);
        toast({
          variant: "destructive",
          title: "Queue Failed",
          description: "Failed to queue scan. Please try again when online.",
        });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    setIsProcessing(true);
    lastScanTime.current = now;
    lastScanKey.current = lookupKey;

    try {
      let ticket: any = null;

      if (isConfigured) {
        if (isSecurePayload) {
          // Use scanner service for QR token lookup or NFC lookup
          if (method === 'nfc') {
            ticket = await lookupTicketByNFC(lookupKey, payload?.signature);
          } else {
            ticket = await lookupTicketByQR(lookupKey);
          }
        } else {
          // For ticket_id, query directly
          const { data, error } = await supabase
            .from("tickets")
            .select("*")
            .eq("ticket_id", lookupKey)
            .maybeSingle();
          
          if (error) throw error;
          ticket = data;
        }
      } else {
        // Local storage mode
        const tickets = localStorageService.getTickets();
        ticket = tickets.find((t) => {
          if (isSecurePayload) {
            if (t.qr_token) {
              return t.qr_token === lookupKey;
            }
            return (
              t.ticket_id?.toUpperCase() === lookupKey.toUpperCase()
            );
          }
          return t.ticket_id?.toUpperCase() === sanitizedTicketId;
        });
      }

      let result: ScanResult;

      if (!ticket) {
        processingTicketKeys.current.delete(lookupKey);
        result = {
          status: "invalid",
          message: "Ticket not found. Please verify the ticket.",
        };
        // Play error sound
        playError();
      } else {
        const ticketStatus =
          (ticket.status as string)?.toLowerCase?.() ??
          (ticket.is_used ? "scanned" : "issued");
        const isAlreadyScanned =
          ticketStatus === "scanned" || ticket.is_used === true;

        if (isSecurePayload) {
          console.info("[scanner] Verified secure payload", {
            token: lookupKey,
            meta: payloadMeta,
            ticketStatus,
          });
        }

        // Check for refund status first (unless override is active)
        const refundCheck = await checkRefundBeforeScan(ticket);
        if (!refundCheck.allowed && !overrideActive) {
          const durationMs = Date.now() - scanStartTime.current;
          await logScanWithDuration(ticket.id, 'invalid', durationMs);
          processingTicketKeys.current.delete(lookupKey);
          result = {
            status: "invalid",
            ticket,
            message: refundCheck.reason || "This ticket has been refunded. Entry denied.",
            refundInfo: refundCheck.refundInfo,
          };
          // Play error sound
          playError();
        } else if (!refundCheck.allowed && overrideActive) {
          // Override active - prompt for reason
          setPendingOverrideType('refund');
          setPendingOverrideTicket(ticket);
          setShowOverrideReasonModal(true);
          processingTicketKeys.current.delete(lookupKey);
          setIsProcessing(false);
          return;
        } else if (isAlreadyScanned && reEntryMode === 'single' && !overrideActive) {
          const durationMs = Date.now() - scanStartTime.current;
          await logScanWithDuration(ticket.id, 'used', durationMs);
          processingTicketKeys.current.delete(lookupKey);
          result = {
            status: "used",
            ticket,
            message: `Already scanned at ${
              ticket.scanned_at
                ? new Date(ticket.scanned_at).toLocaleString()
                : "unknown time"
            }`,
            transferInfo,
            nameMismatch: hasNameMismatch,
            refundInfo,
          };
          // Play error sound
          playError();
        } else if (isAlreadyScanned && reEntryMode === 'single' && overrideActive) {
          // Override active - allow duplicate scan
          setPendingOverrideType('duplicate');
          setPendingOverrideTicket(ticket);
          setShowOverrideReasonModal(true);
          processingTicketKeys.current.delete(lookupKey);
          setIsProcessing(false);
          return;
        } else {
          // Check for transfer and name mismatch (only if not refunded)
          const transferInfo = await getTicketTransferInfo(ticket);
          const nameCheck = await checkNameMatch(ticket);
          const hasNameMismatch = !nameCheck.matches && transferInfo.isTransferred;
          
          // Handle transfer restrictions (unless override is active)
          if (transferInfo.isTransferred && hasNameMismatch && !overrideActive) {
            processingTicketKeys.current.delete(lookupKey);
            result = {
              status: "invalid",
              ticket,
              message: "Ticket has been transferred. Name mismatch detected.",
              transferInfo,
              nameMismatch: true,
            };
            playError();
            setScanResult(result);
            setIsScanning(false);
            setIsProcessing(false);
            return;
          } else if (transferInfo.isTransferred && hasNameMismatch && overrideActive) {
            // Override active - prompt for reason
            setPendingOverrideType('transfer');
            setPendingOverrideTicket(ticket);
            setShowOverrideReasonModal(true);
            processingTicketKeys.current.delete(lookupKey);
            setIsProcessing(false);
            return;
          }
          
          // Get refund info for display
          const refundInfo = await getTicketRefundInfo(ticket);
          
          // Check capacity before scanning
          const eventName = ticket.event_name || currentEventName || "Perreo Fridays";
          const ticketType = ticket.ticket_type;
          
          const capacityCheck = await checkCapacityBeforeScan(eventName, ticketType);
          if (!capacityCheck.allowed && !overrideActive) {
            const durationMs = Date.now() - scanStartTime.current;
            await logScanWithDuration(ticket.id, 'invalid', durationMs);
            processingTicketKeys.current.delete(lookupKey);
            result = {
              status: "invalid",
              ticket,
              message: capacityCheck.reason || "Venue is at full capacity.",
              refundInfo,
            };
            // Play warning sound
            playWarning();
          } else if (!capacityCheck.allowed && overrideActive) {
            // Override active - prompt for reason
            setPendingOverrideType('capacity');
            setPendingOverrideTicket(ticket);
            setShowOverrideReasonModal(true);
            processingTicketKeys.current.delete(lookupKey);
            setIsProcessing(false);
            return;
          } else if (isConfigured) {
            // Use scanner service to scan the ticket (pass scan start time for duration tracking)
            const scanResult = await scanTicket(ticket.id, user?.id, reEntryMode, scanStartTime.current, method);
            
            if (!scanResult.success) {
              // Duration already logged by scanTicket service for valid scans
              // For failed scans, log here if not already logged
              const durationMs = Date.now() - scanStartTime.current;
              const resultStatus = scanResult.error?.includes("Already scanned") ? "used" : "invalid";
              // Only log if scanTicket didn't already log it (it only logs valid scans)
              if (resultStatus !== "valid") {
                await logScanWithDuration(ticket.id, resultStatus, durationMs);
              }
              processingTicketKeys.current.delete(lookupKey);
              result = {
                status: resultStatus,
                ticket: scanResult.ticket ? {
                  ...ticket,
                  ...scanResult.ticket,
                } : ticket,
                message: scanResult.error || "Failed to scan ticket",
              };
              // Play error sound
              playError();
            } else {
              ticket = scanResult.ticket ? { ...ticket, ...scanResult.ticket } : ticket;
              
              // Refresh capacity after successful scan
              const updatedCapacity = await getEventCapacity(eventName);
              if (updatedCapacity) {
                setCapacityStatus(updatedCapacity);
              }
              
              // Play success sound
              playSuccess();
              
              result = {
                status: "valid",
                ticket,
                message: "Entry granted - Welcome!",
                transferInfo,
                nameMismatch: hasNameMismatch,
                refundInfo,
              };

              // Check if ID verification is required
              try {
                const needsIDVerification = await checkIDVerificationRequired(ticket);
                if (needsIDVerification) {
                  setPendingTicketForIDVerification(ticket);
                  setShowIDVerificationModal(true);
                }
              } catch (error) {
                console.error('Error checking ID verification requirement:', error);
                // Continue even if check fails
              }
            }
          } else {
            // Local storage mode - check refund, capacity, and transfer
            const eventName = ticket.event_name || currentEventName || "Perreo Fridays";
            const ticketType = ticket.ticket_type;
            
            // Check refund status
            const refundCheck = await checkRefundBeforeScan(ticket);
            if (!refundCheck.allowed) {
              processingTicketKeys.current.delete(lookupKey);
              result = {
                status: "invalid",
                ticket,
                message: refundCheck.reason || "This ticket has been refunded. Entry denied.",
                refundInfo: refundCheck.refundInfo,
              };
            } else {
              // Check for transfer and name mismatch
              const transferInfo = await getTicketTransferInfo(ticket);
              const nameCheck = await checkNameMatch(ticket);
              const hasNameMismatch = !nameCheck.matches && transferInfo.isTransferred;
              
              // Get refund info for display
              const refundInfo = await getTicketRefundInfo(ticket);
              
              const capacityCheck = await checkCapacityBeforeScan(eventName, ticketType);
              if (!capacityCheck.allowed) {
                processingTicketKeys.current.delete(lookupKey);
                result = {
                  status: "invalid",
                  ticket,
                  message: capacityCheck.reason || "Venue is at full capacity.",
                  refundInfo,
                };
              } else {
              const storageTickets = localStorageService.getTickets();
              const storedTicket = storageTickets.find(
                (t) => t.id === ticket.id
              );
              if (
                storedTicket?.status === "scanned" ||
                storedTicket?.is_used
              ) {
                processingTicketKeys.current.delete(lookupKey);
                result = {
                  status: "used",
                  ticket: storedTicket,
                  message: `Already scanned at ${
                    storedTicket.scanned_at
                      ? new Date(storedTicket.scanned_at).toLocaleString()
                      : "unknown time"
                  }`,
                  transferInfo,
                  refundInfo,
                };
              } else {
                const nowIso = new Date().toISOString();
                const updatedTicket = {
                  ...ticket,
                  status: "scanned",
                  is_used: true,
                  scanned_at: nowIso,
                  scanned_by: user?.id ?? "offline-user",
                };
                localStorageService.saveTicket(updatedTicket);
                ticket = updatedTicket;
                
                // Refresh capacity after successful scan
                const updatedCapacity = await getEventCapacity(eventName);
                if (updatedCapacity) {
                  setCapacityStatus(updatedCapacity);
                }
                
                result = {
                  status: "valid",
                  ticket,
                  message: "Entry granted - Welcome!",
                  transferInfo,
                  nameMismatch: hasNameMismatch,
                  refundInfo,
                };

                // Check if ID verification is required (local storage mode)
                try {
                  const needsIDVerification = await checkIDVerificationRequired(ticket);
                  if (needsIDVerification) {
                    setPendingTicketForIDVerification(ticket);
                    setShowIDVerificationModal(true);
                  }
                } catch (error) {
                  console.error('Error checking ID verification requirement:', error);
                  // Continue even if check fails
                }
              }
            }
          }
        }
      }
    }

      // In batch mode, add to queue instead of processing immediately
      if (batchMode && ticket) {
        const queuedTicket: QueuedTicket = {
          id: `${ticket.id}-${Date.now()}`,
          ticket,
          ticketId: ticket.ticket_id || lookupKey,
          guestName: ticket.guest_name,
          ticketType: ticket.ticket_type || "Unknown",
          eventName: ticket.event_name || currentEventName || "Unknown Event",
          status: result.status === "valid" ? "valid" : result.status === "used" ? "used" : "invalid",
          message: result.message,
          transferInfo: result.transferInfo,
          refundInfo: result.refundInfo,
          scannedAt: new Date(),
          orderId: ticket.order_id,
        };

        // Check if ticket is already in queue
        const isDuplicate = queuedTickets.some(
          qt => qt.ticketId === queuedTicket.ticketId || 
                 (qt.ticket?.id && queuedTicket.ticket?.id && qt.ticket.id === queuedTicket.ticket.id)
        );

        if (!isDuplicate) {
          setQueuedTickets(prev => {
            const updated = [...prev, queuedTicket];
            toast({
              title: result.status === "valid" ? "Added to Queue" : result.status === "used" ? "Already Used" : "Invalid",
              description: result.status === "valid" 
                ? `Ticket queued (${updated.length} in queue)`
                : result.message,
              variant: result.status === "valid" ? "default" : "destructive",
            });
            return updated;
          });
          setLastQueuedTicketId(queuedTicket.id);

          // Auto-reset scanning immediately in batch mode
          setIsScanning(true);
          setIsProcessing(false);
          lastScanKey.current = "";
          processingTicketKeys.current.delete(lookupKey);
          return;
        } else {
          toast({
            variant: "destructive",
            title: "Duplicate Ticket",
            description: "This ticket is already in the queue.",
          });
          processingTicketKeys.current.delete(lookupKey);
          setIsProcessing(false);
          return;
        }
      }

      // Scan logging is handled by scanTicket service, but log for local storage mode
      if (!isConfigured) {
        localStorageService.addScanLog({
          ticket_id: ticket?.id,
          scanned_by: user?.id,
          scan_result: result.status,
          metadata: {
            ticket_id: sanitizedTicketId || displayLabel,
            qr_token: isSecurePayload ? lookupKey : null,
          },
        });
      }

      setScanResult(result);
      setIsScanning(false);

      toast({
        title:
          result.status === "valid"
            ? "Valid Ticket"
            : result.status === "used"
            ? "Already Used"
            : "Invalid",
        description: result.message,
        variant: result.status === "valid" ? "default" : "destructive",
      });

      if (result.status !== "valid") {
        processingTicketKeys.current.delete(lookupKey);
      }

      setTimeout(() => {
        setScanResult(null);
        setIsScanning(true);
        setIsProcessing(false);
        lastScanKey.current = "";
        processingTicketKeys.current.delete(lookupKey);
      }, 4000);
    } catch (error: any) {
      console.error("[scanner] Ticket validation error", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to validate ticket. Please try again.",
      });
      setIsScanning(true);
      setIsProcessing(false);
      lastScanKey.current = "";
      processingTicketKeys.current.delete(lookupKey);
    }
  };

  const processScan = async (decodedText: string) => {
    if (!decodedText) return;

    const trimmed = decodedText.trim();

    if (trimmed.startsWith("{")) {
      try {
        const payload = await parseAndVerifyQrPayload(trimmed);
        await validateTicket(payload, scanMethod);
        return;
      } catch (error: any) {
        console.error("[scanner] Secure QR verification failed", error);
        toast({
          variant: "destructive",
          title: "Invalid QR Code",
          description:
            error.message ||
            "The QR code could not be verified. Please ask the guest to show another ticket.",
        });
        return;
      }
    }

    await validateTicket(trimmed, scanMethod);
  };

  const handleScanSuccess = (decodedText: string) => {
    if (!isScanning) return;
    void processScan(decodedText);
  };

  const handleNFCScanSuccess = async (payload: NFCTicketPayload) => {
    if (!isScanning) return;
    
    // Convert NFC payload to format expected by validateTicket
    if (payload.signature) {
      // Has signature - treat as secure payload
      const verifiedPayload: VerifiedQrPayload = {
        token: payload.token,
        signature: payload.signature,
        meta: payload.meta || null,
        raw: payload.raw || JSON.stringify(payload),
      };
      await validateTicket(verifiedPayload, 'nfc');
    } else {
      // No signature - treat as plain token
      await validateTicket(payload.token, 'nfc');
    }
  };

  const handleManualEntry = async (searchData: { method: string; values: Record<string, string> }) => {
    // Prevent concurrent manual entries
    if (isProcessing) {
      toast({
        variant: "destructive",
        title: "Processing",
        description: "Please wait for the current verification to complete.",
      });
      return;
    }

    const isConfigured = isSupabaseConfigured();
    let tickets: any[] = [];

    try {
      if (searchData.method === "ticket-id") {
        const inputValue = searchData.values.ticket_id.trim();

        if (!inputValue) {
          toast({
            variant: "destructive",
            title: "Invalid Input",
            description: "Please enter a ticket ID, QR token, or ticket UUID.",
          });
          return;
        }

        const sanitizedInput = inputValue.trim();

        if (isConfigured) {
          const queryString = `ticket_id.eq.${sanitizedInput},qr_token.eq.${sanitizedInput},id.eq.${sanitizedInput}`;

          const { data: tickets, error } = await supabase
            .from('tickets')
            .select('*, events(*), ticket_types(*)')
            .or(queryString)
            .limit(1);

          if (error) {
            console.error("[Manual Verification] Database query failed:", error);
            toast({
              variant: "destructive",
              title: "Search Error",
              description: error.message || "Failed to search for ticket. Please try again.",
            });
            return;
          }

          const ticket = tickets?.[0] || null;

          if (!ticket) {
            // Try WITH quotes as fallback
            const queryStringWithQuotes = `ticket_id.eq."${sanitizedInput}",qr_token.eq."${sanitizedInput}",id.eq."${sanitizedInput}"`;

            const { data: ticketsWithQuotes } = await supabase
              .from('tickets')
              .select('*, events(*), ticket_types(*)')
              .or(queryStringWithQuotes)
              .limit(1);

            const ticketWithQuotes = ticketsWithQuotes?.[0] || null;

            if (ticketWithQuotes) {
              validateTicket(ticketWithQuotes.ticket_id || sanitizedInput);
              return;
            }

            toast({
              variant: "destructive",
              title: "Ticket Not Found",
              description: "No ticket found matching the provided ID, QR token, or ticket UUID.",
            });
            return;
          }

          validateTicket(ticket.ticket_id || sanitizedInput);
        } else {
          // Local storage mode - search in ticket_id, qr_token, and id fields
          const allTickets = localStorageService.getTickets();
          const ticket = allTickets.find(
            (t) =>
              t.ticket_id?.toUpperCase() === sanitizedInput.toUpperCase() ||
              t.qr_token === sanitizedInput ||
              t.id === sanitizedInput
          );

          if (!ticket) {
            toast({
              variant: "destructive",
              title: "Ticket Not Found",
              description: "No ticket found matching the provided ID, QR token, or ticket UUID.",
            });
            return;
          }

          // Found ticket - proceed with validation using ticket_id
          validateTicket(ticket.ticket_id || sanitizedInput);
        }
        return;
      }

      // For other methods, search for tickets (without event filter)
      if (isConfigured) {
        let query = supabase.from("tickets").select("*");

        if (searchData.method === "name-event") {
          query = query.eq("guest_name", searchData.values.guest_name);
        } else if (searchData.method === "email-event") {
          query = query.eq("guest_email", searchData.values.guest_email);
        } else if (searchData.method === "phone-event") {
          // Search by phone in email or metadata
          const phoneDigits = searchData.values.phone_number;
          const { data: allTickets } = await supabase.from("tickets").select("*");
          
          if (allTickets && allTickets.length > 0) {
            const foundTicket = allTickets.find(t => {
              const emailDigits = t.guest_email?.replace(/\D/g, "") || "";
              const ticketPhone = t.metadata?.phone?.replace(/\D/g, "") || "";
              return emailDigits.includes(phoneDigits) || ticketPhone === phoneDigits;
            });
            
            if (foundTicket) {
              // Ticket found, proceed to validation
              validateTicket(foundTicket.ticket_id);
              return;
            }
          }
          
          toast({
            variant: "destructive",
            title: "Ticket Not Found",
            description: "No ticket found matching the provided phone number.",
          });
          return;
        }

        const { data, error } = await query;
        if (error) throw error;
        tickets = data || [];
      } else {
        // Search in local storage
        const allTickets = localStorageService.getTickets();
        
        if (searchData.method === "name-event") {
          tickets = allTickets.filter(t => 
            t.guest_name?.toLowerCase() === searchData.values.guest_name.toLowerCase()
          );
        } else if (searchData.method === "email-event") {
          tickets = allTickets.filter(t => 
            t.guest_email?.toLowerCase() === searchData.values.guest_email.toLowerCase()
          );
        } else if (searchData.method === "phone-event") {
          // Search by phone in guest_email or metadata
          const phoneDigits = searchData.values.phone_number.replace(/\D/g, "");
          tickets = allTickets.filter(t => {
            const emailDigits = t.guest_email?.replace(/\D/g, "") || "";
            const ticketPhone = t.metadata?.phone?.replace(/\D/g, "") || "";
            return emailDigits.includes(phoneDigits) || ticketPhone === phoneDigits;
          });
        }
      }

      if (tickets.length === 0) {
        toast({
          variant: "destructive",
          title: "Ticket Not Found",
          description: `No ticket found matching the provided ${searchData.method === "name-event" ? "name" : searchData.method === "email-event" ? "email" : "phone"}.`,
        });
        return;
      }

      // Check for multiple tickets (duplicate detection)
      if (tickets.length > 1) {
        toast({
          variant: "destructive",
          title: "Multiple Tickets Found",
          description: `Found ${tickets.length} tickets matching this criteria. Please use Ticket ID to verify the specific ticket.`,
        });
        return;
      }

      const ticket = tickets[0];

      // Check if ticket is already used
      if (ticket.is_used) {
        toast({
          variant: "destructive",
          title: "Ticket Already Used",
          description: `This ticket was already scanned at ${ticket.scanned_at ? new Date(ticket.scanned_at).toLocaleString() : "unknown time"}.`,
        });
        return;
      }

      // Validate the found ticket using ticket_id
      validateTicket(ticket.ticket_id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Search Error",
        description: error.message || "Failed to search for ticket. Please try again.",
      });
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setIsScanning(true);
  };

  const handleApproveBatch = async () => {
    if (queuedTickets.length === 0) return;
    
    setIsProcessingBatch(true);
    try {
      const validTickets = queuedTickets.filter(t => t.status === 'valid');
      
      // Process tickets that haven't been scanned yet
      const ticketsToProcess = validTickets.filter(qt => {
        const ticket = qt.ticket;
        const ticketStatus = (ticket?.status as string)?.toLowerCase?.() ?? (ticket?.is_used ? "scanned" : "issued");
        return ticketStatus !== "scanned" && !ticket?.is_used;
      });
      
      const result = await approveBatch(ticketsToProcess, user?.id);
      
      if (result.success || result.processed > 0) {
        // Play batch approved sound
        playBatchApproved();
        
        toast({
          title: "Batch Approved!",
          description: `Successfully processed ${result.processed} ticket${result.processed !== 1 ? 's' : ''}.`,
        });
        
        // Refresh capacity
        if (currentEventName) {
          const updatedCapacity = await getEventCapacity(currentEventName);
          if (updatedCapacity) {
            setCapacityStatus(updatedCapacity);
          }
        }
        
        // Clear successfully processed tickets from queue
        const processedTicketIds = new Set(
          ticketsToProcess
            .filter((_, idx) => idx < result.processed)
            .map(qt => qt.ticket?.id || qt.id)
        );
        
        setQueuedTickets(prev => prev.filter(t => 
          !processedTicketIds.has(t.ticket?.id || t.id)
        ));
      }
      
      if (result.errors.length > 0) {
        toast({
          variant: "destructive",
          title: "Some Tickets Had Issues",
          description: `${result.processed} processed, ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}.`,
        });
        
        // Remove successfully processed tickets
        const processedTicketIds = new Set(
          ticketsToProcess
            .filter((_, idx) => idx < result.processed)
            .map(qt => qt.ticket?.id || qt.id)
        );
        
        setQueuedTickets(prev => prev.filter(t => 
          !processedTicketIds.has(t.ticket?.id || t.id)
        ));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Batch Processing Failed",
        description: error.message || "Failed to process batch.",
      });
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleRemoveFromQueue = (ticketId: string) => {
    setQueuedTickets(prev => prev.filter(t => t.id !== ticketId));
  };

  const handleClearQueue = () => {
    setQueuedTickets([]);
    toast({
      title: "Queue Cleared",
      description: "All queued tickets have been removed.",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading scanner...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="border-primary/20 shadow-glow-purple max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <p className="text-muted-foreground">Redirecting to login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const LayoutComponent = isOwner ? OwnerPortalLayout : EmployeePortalLayout;
  const layoutSubtitle = !isOwner
    ? currentEventName
      ? `Crew Shift • ${currentEventName}`
      : "Crew Shift • Standby"
    : undefined;
  const layoutDescription = isOwner
    ? "Scan QR codes or enter ticket IDs to validate entry"
    : `${isOnline ? "Online" : "Offline mode"} • ${
        currentScanRate ? `${currentScanRate.toFixed(1)}/min` : "Ready to scan"
      }`;
  const staffActions = !isOwner ? (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="border-white/20 text-white hover:bg-white/10"
        onClick={scrollToManualEntry}
      >
        Manual Entry
      </Button>
      <Button
        size="sm"
        className="bg-gradient-purple hover:shadow-glow-purple"
        onClick={handleManualSync}
        disabled={isSyncing}
      >
        {isSyncing ? "Syncing..." : "Sync Queue"}
      </Button>
        </div>
  ) : null;

  // Show owner acknowledgment screen if needed
  if (showOwnerAcknowledgment) {
    return (
      <OwnerPortalLayout title="Business Dashboard First">
        <div className="container mx-auto px-4 py-16 max-w-3xl">
          <Card className="shadow-lg border-primary/20">
            <CardHeader>
              <CardTitle className="text-3xl">Business Dashboard First</CardTitle>
              <CardDescription className="text-base">
                Owners manage the business from the dashboard. Access the scanner only when you need to verify tickets yourself.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                We recommend using the owner dashboard to monitor sales, revenue, and operations. Your team can handle scanning duties from their employee portal.
              </p>
              <p className="text-sm text-muted-foreground">
                Need to scan a ticket personally? You can continue below, or head back to the dashboard.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-3">
              <Button className="flex-1" onClick={() => navigate("/dashboard")}>
                Go to Owner Dashboard
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                onClick={() => setOwnerScannerAcknowledged(true)}
              >
                Continue to Scanner
              </Button>
            </CardFooter>
          </Card>
        </div>
      </OwnerPortalLayout>
    );
  }

  return (
    <LayoutComponent
      title="Ticket Scanner"
      subtitle={layoutSubtitle}
      description={layoutDescription}
      actions={staffActions}
    >
        {/* Event Selector */}
        {events && events.length > 0 && (
          <Card className="border-primary/20 mb-4">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium whitespace-nowrap">Event:</Label>
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event: any) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name} - {new Date(event.event_date).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4 sm:space-y-6">
            {/* Stats Grid - Mobile First */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Scan Rate Display */}
              {isSupabaseConfigured() && (
                <Card className="border-primary/20 shadow-sm">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-2 rounded-lg bg-primary/20 flex-shrink-0">
                        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Scan Speed
                        </div>
                        <div className="text-lg sm:text-xl font-bold mt-0.5 sm:mt-1">
                          <span className={currentScanRate >= 15 ? "text-green-600" : currentScanRate >= 10 ? "text-yellow-600" : "text-red-600"}>
                            {currentScanRate.toFixed(1)}/min
                          </span>
                        </div>
                        {scanMetrics && (
                          <div className="text-xs text-muted-foreground mt-0.5 sm:mt-1">
                            Avg: {scanMetrics.todayAverage.toFixed(1)}/min
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Network Status */}
              {!isOnline && isSupabaseConfigured() && (
                <Card className="border-destructive/50 bg-destructive/5 sm:col-span-2 lg:col-span-2">
                  <CardContent className="p-3 sm:p-4">
                    <Alert variant="destructive" className="border-0 bg-transparent p-0">
                      <WifiOff className="h-4 w-4" />
                      <AlertTitle className="text-xs sm:text-sm">Offline Mode</AlertTitle>
                      <AlertDescription className="text-xs">
                        Scans will be queued and synced when online.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Left Column - Main Scanner Content */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">


          {/* Capacity Status */}
          {capacityStatus && (
            <>
              <Card className={`border-primary/20 shadow-sm ${
                capacityStatus.isAtCapacity 
                  ? "border-destructive/50 bg-destructive/5" 
                  : capacityStatus.isNearCapacity 
                  ? "border-accent/50 bg-accent/5" 
                  : ""
              }`}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${
                        capacityStatus.isAtCapacity 
                          ? "bg-destructive/20" 
                          : capacityStatus.isNearCapacity 
                          ? "bg-accent/20" 
                          : "bg-primary/20"
                      }`}>
                        <Users className={`h-5 w-5 sm:h-6 sm:w-6 ${
                          capacityStatus.isAtCapacity 
                            ? "text-destructive" 
                            : capacityStatus.isNearCapacity 
                            ? "text-accent" 
                            : "text-primary"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2">
                          Venue Capacity
                        </div>
                        <div className="flex items-baseline gap-2 mb-1 sm:mb-2">
                          <span className={`text-2xl sm:text-3xl font-bold ${
                            capacityStatus.isAtCapacity ? "text-destructive" : ""
                          }`}>
                            {capacityStatus.currentCount}
                          </span>
                          <span className="text-lg sm:text-xl text-muted-foreground">/ {capacityStatus.totalCapacity}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                          <span>{capacityStatus.available} available</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{capacityStatus.percentageFull.toFixed(1)}% full</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="mt-2 sm:mt-3 w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              capacityStatus.isAtCapacity 
                                ? "bg-destructive" 
                                : capacityStatus.isNearCapacity 
                                ? "bg-accent" 
                                : "bg-primary"
                            }`}
                            style={{ width: `${capacityStatus.percentageFull}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 self-start sm:self-auto">
                      {capacityStatus.isAtCapacity && (
                        <Badge variant="destructive" className="text-xs sm:text-sm px-2 sm:px-3 py-1">
                          <XCircle className="h-3 w-3 mr-1" />
                          FULL
                        </Badge>
                      )}
                      {capacityStatus.isNearCapacity && !capacityStatus.isAtCapacity && (
                        <Badge variant="outline" className="text-xs sm:text-sm border-accent/50 text-accent px-2 sm:px-3 py-1">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          NEAR FULL
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Ticket Type Breakdown */}
                  {capacityStatus.ticketTypeCapacity && capacityStatus.ticketTypeCapacity.length > 0 && (
                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-primary/10">
                      <div className="text-xs font-medium text-muted-foreground mb-2">By Ticket Type:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        {capacityStatus.ticketTypeCapacity.map((type) => (
                          <div key={type.ticketType} className="text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{type.ticketType}</span>
                              <span className={`${
                                type.isAtCapacity ? "text-destructive" : 
                                type.isNearCapacity ? "text-accent" : 
                                "text-muted-foreground"
                              }`}>
                                {type.currentCount}/{type.capacity}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  type.isAtCapacity 
                                    ? "bg-destructive" 
                                    : type.isNearCapacity 
                                    ? "bg-accent" 
                                    : "bg-primary"
                                }`}
                                style={{ width: `${Math.min(100, type.percentageFull)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Capacity Alerts */}
              {capacityStatus.isAtCapacity && (
                <Alert variant="destructive" className="border-destructive/50">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Venue at Full Capacity</AlertTitle>
                  <AlertDescription>
                    Entry is blocked. The venue has reached maximum capacity ({capacityStatus.currentCount}/{capacityStatus.totalCapacity}).
                    No additional tickets can be scanned until capacity decreases.
                  </AlertDescription>
                </Alert>
              )}

              {capacityStatus.isNearCapacity && !capacityStatus.isAtCapacity && (
                <Alert className="border-accent/50 bg-accent/5">
                  <AlertTriangle className="h-4 w-4 text-accent" />
                  <AlertTitle>Venue Near Capacity</AlertTitle>
                  <AlertDescription>
                    The venue is {capacityStatus.percentageFull.toFixed(1)}% full ({capacityStatus.currentCount}/{capacityStatus.totalCapacity}).
                    Only {capacityStatus.available} spots remaining.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Scanner Mode Toggle */}
          {!scanResult && (
            <Card className="border-primary/20">
              <CardContent className="p-3 sm:p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-sm font-medium">Scan Mode:</Label>
                  <div className="flex gap-2 flex-1 sm:flex-initial">
                    <Button
                      type="button"
                      variant={scanMode === "camera" ? "default" : "outline"}
                      onClick={() => setScanMode("camera")}
                      className={`flex-1 sm:flex-initial ${
                        scanMode === "camera" 
                          ? "bg-gradient-purple hover:shadow-glow-purple" 
                          : "border-primary/20"
                      }`}
                      size="sm"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">Camera</span>
                      <span className="sm:hidden">Cam</span>
                    </Button>
                    <Button
                      type="button"
                      variant={scanMode === "scanner" ? "default" : "outline"}
                      onClick={() => setScanMode("scanner")}
                      className={`flex-1 sm:flex-initial ${
                        scanMode === "scanner" 
                          ? "bg-gradient-purple hover:shadow-glow-purple" 
                          : "border-primary/20"
                      }`}
                      size="sm"
                    >
                      <Keyboard className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">USB Scanner</span>
                      <span className="sm:hidden">Scanner</span>
                    </Button>
                  </div>
                </div>

                {/* NFC/QR Toggle (only show if NFC is available and scan mode is camera) */}
                {scanMode === "camera" && nfcAvailable && (
                  <div className="flex items-center justify-between gap-4 pt-3 border-t border-primary/10">
                    <div className="flex items-center gap-3">
                      <Radio className="h-4 w-4 text-primary" />
                      <div>
                        <Label htmlFor="nfc-mode" className="text-sm font-medium cursor-pointer">
                          NFC Scanning
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {scanMethod === 'nfc' ? 'Tap NFC tickets to scan' : 'Scan QR codes with camera'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={scanMethod === "qr" ? "default" : "outline"}
                        onClick={() => setScanMethod("qr")}
                        className={`${scanMethod === "qr" ? "bg-gradient-purple hover:shadow-glow-purple" : "border-primary/20"}`}
                        size="sm"
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        QR
                      </Button>
                      <Button
                        type="button"
                        variant={scanMethod === "nfc" ? "default" : "outline"}
                        onClick={() => setScanMethod("nfc")}
                        className={`${scanMethod === "nfc" ? "bg-gradient-purple hover:shadow-glow-purple" : "border-primary/20"}`}
                        size="sm"
                      >
                        <Radio className="mr-2 h-4 w-4" />
                        NFC
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Batch Mode Toggle */}
                <div className="flex items-center justify-between gap-4 pt-3 border-t border-primary/10">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-primary" />
                    <div>
                      <Label htmlFor="batch-mode" className="text-sm font-medium cursor-pointer">
                        Batch Scanning Mode
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Queue tickets and approve all at once
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="batch-mode"
                    checked={batchMode}
                    onCheckedChange={(checked) => {
                      setBatchMode(checked);
                      if (!checked) {
                        // Clear queue when disabling batch mode
                        if (queuedTickets.length > 0) {
                          toast({
                            title: "Batch Mode Disabled",
                            description: "Queue cleared. Switch back to batch mode to queue tickets.",
                          });
                        }
                        setQueuedTickets([]);
                      }
                    }}
                  />
                </div>

                {/* Re-entry Mode Toggle */}
                <div className="flex items-center justify-between gap-4 pt-3 border-t border-primary/10">
                  <div className="flex items-center gap-3">
                    <Layers className="h-4 w-4 text-primary" />
                    <div>
                      <Label htmlFor="reentry-mode" className="text-sm font-medium cursor-pointer">
                        Re-entry Mode
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {reEntryMode === 'single' && 'Single entry only'}
                        {reEntryMode === 'reentry' && 'Allow re-entry'}
                        {reEntryMode === 'exit_tracking' && 'Track entry/exit'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={reEntryMode === 'single' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleReEntryModeChange('single')}
                      className={reEntryMode === 'single' ? 'bg-gradient-purple' : ''}
                    >
                      Single
                    </Button>
                    <Button
                      type="button"
                      variant={reEntryMode === 'reentry' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleReEntryModeChange('reentry')}
                      className={reEntryMode === 'reentry' ? 'bg-gradient-purple' : ''}
                    >
                      Re-entry
                    </Button>
                    <Button
                      type="button"
                      variant={reEntryMode === 'exit_tracking' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleReEntryModeChange('exit_tracking')}
                      className={reEntryMode === 'exit_tracking' ? 'bg-gradient-purple' : ''}
                    >
                      Track
                    </Button>
                  </div>
                </div>

                {/* Settings Toggle */}
                <div className="flex items-center justify-between gap-4 pt-3 border-t border-primary/10">
                  <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4 text-primary" />
                    <Label htmlFor="show-settings" className="text-sm font-medium cursor-pointer">
                      Audio & Haptic Settings
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>

                {/* Settings Panel */}
                {showSettings && (
                  <div className="pt-3 border-t border-primary/10 space-y-4">
                    {/* Sound Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {audioSettings.soundEnabled ? (
                          <Volume2 className="h-4 w-4 text-primary" />
                        ) : (
                          <VolumeX className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Label htmlFor="sound-enabled" className="text-sm cursor-pointer">
                          Sound Feedback
                        </Label>
                      </div>
                      <Switch
                        id="sound-enabled"
                        checked={audioSettings.soundEnabled}
                        onCheckedChange={(checked) => {
                          handleAudioSettingsChange({ soundEnabled: checked });
                          if (checked) testSound('success');
                        }}
                      />
                    </div>

                    {/* Haptic Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Vibrate className={`h-4 w-4 ${audioSettings.hapticEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                        <Label htmlFor="haptic-enabled" className="text-sm cursor-pointer">
                          Haptic Feedback
                        </Label>
                      </div>
                      <Switch
                        id="haptic-enabled"
                        checked={audioSettings.hapticEnabled}
                        onCheckedChange={(checked) => {
                          handleAudioSettingsChange({ hapticEnabled: checked });
                          if (checked) testSound('success');
                        }}
                      />
                    </div>

                    {/* Volume Slider */}
                    {audioSettings.soundEnabled && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Volume</Label>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(audioSettings.volume * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={audioSettings.volume}
                          onChange={(e) => {
                            const volume = parseFloat(e.target.value);
                            handleAudioSettingsChange({ volume });
                            testSound('success');
                          }}
                          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}

                    {/* Test Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => testSound('success')}
                        className="flex-1"
                      >
                        Test Success
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => testSound('error')}
                        className="flex-1"
                      >
                        Test Error
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => testSound('warning')}
                        className="flex-1"
                      >
                        Test Warning
                      </Button>
                    </div>

                    {/* Emergency Override (Owner Only) */}
                    {role === 'owner' && (
                      <div className="pt-4 border-t border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <Label className="text-sm font-semibold text-red-500">
                              Emergency Override
                            </Label>
                          </div>
                          {overrideActive && (
                            <Badge variant="destructive" className="text-xs">
                              ACTIVE
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          Bypass validation checks in emergency situations
                        </p>
                        <div className="flex gap-2">
                          {!overrideActive ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowOverrideModal(true)}
                              className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Activate Override
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                deactivateOverride();
                                toast({
                                  title: "Override Deactivated",
                                  description: "Emergency override mode has been deactivated",
                                });
                              }}
                              className="flex-1 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                            >
                              Deactivate Override
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Override Activation Modal */}
          {role === 'owner' && (
            <OverrideActivationModal
              open={showOverrideModal}
              onClose={() => setShowOverrideModal(false)}
              onActivated={() => {
                setOverrideActive(true);
                setOverrideTimeRemaining(getRemainingOverrideTime());
              }}
              userId={user?.id || null}
            />
          )}

          {/* Batch Queue */}
          {batchMode && (
            <BatchQueue
              queuedTickets={queuedTickets}
              onApproveBatch={handleApproveBatch}
              onClearQueue={handleClearQueue}
              onRemoveTicket={handleRemoveFromQueue}
              isProcessing={isProcessingBatch}
            />
          )}

          {/* Override Banner */}
          {overrideActive && (
            <Alert className="mb-4 border-red-500 bg-red-500/20">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <AlertTitle className="text-red-500 font-bold">
                ⚠️ OVERRIDE MODE ACTIVE
              </AlertTitle>
              <AlertDescription className="text-red-600">
                Expires in {Math.floor(overrideTimeRemaining / 60000)}:{(Math.floor((overrideTimeRemaining % 60000) / 1000)).toString().padStart(2, '0')}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    deactivateOverride();
                    toast({
                      title: "Override Deactivated",
                      description: "Emergency override mode has been deactivated",
                    });
                  }}
                  className="ml-4 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                >
                  Deactivate
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Scanner/Result Card */}
          {!batchMode && (
            <Card className="border-primary/20 shadow-glow-purple overflow-hidden">
              {scanResult ? (
                <>
                  <TicketResult result={scanResult} onReset={resetScan} overrideUsed={scanResult.overrideUsed} overrideReason={scanResult.overrideReason} />
                  <IDVerificationModal
                    open={showIDVerificationModal}
                    onClose={() => {
                      setShowIDVerificationModal(false);
                      setPendingTicketForIDVerification(null);
                    }}
                    ticketId={pendingTicketForIDVerification?.id || ''}
                    ticketTypeName={pendingTicketForIDVerification?.ticket_types?.name || pendingTicketForIDVerification?.ticket_type}
                    attendeeName={pendingTicketForIDVerification?.attendee_name || pendingTicketForIDVerification?.guest_name}
                    onVerified={() => {
                      // Refresh ticket data after verification
                      if (pendingTicketForIDVerification?.id) {
                        // Optionally refresh scan result to show verified status
                        setShowIDVerificationModal(false);
                        setPendingTicketForIDVerification(null);
                      }
                    }}
                  />
                  <OverrideReasonModal
                    open={showOverrideReasonModal}
                    onClose={() => {
                      setShowOverrideReasonModal(false);
                      setPendingOverrideType(null);
                      setPendingOverrideTicket(null);
                    }}
                    onConfirm={async (reason, notes, overrideType) => {
                      // Process override scan
                      const ticket = pendingOverrideTicket;
                      if (!ticket) return;

                      // Proceed with scan (bypassing the check that was blocked)
                      let scanResult;
                      let scanLogId: string | null = null;
                      
                      if (isConfigured) {
                        // Add override info to ticket for logging
                        const ticketWithOverride = {
                          ...ticket,
                          overrideUsed: true,
                          overrideReason: reason,
                        };
                        
                        const scanResultData = await scanTicket(ticket.id, user?.id, reEntryMode, scanStartTime.current, 'qr');
                        
                        // Get scan log ID if available
                        if (scanResultData.success) {
                          // Fetch the most recent scan log for this ticket
                          const { data: scanLogs } = await supabase
                            .from('scan_logs')
                            .select('id')
                            .eq('ticket_id', ticket.id)
                            .order('scanned_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                          scanLogId = scanLogs?.id || null;
                        }
                        
                        if (scanResultData.success && scanResultData.ticket) {
                          scanResult = {
                            status: "valid" as const,
                            ticket: scanResultData.ticket,
                            message: "Entry granted - Welcome! (Override used)",
                            overrideUsed: true,
                            overrideReason: reason,
                          };
                          playSuccess();
                        } else {
                          scanResult = {
                            status: "invalid" as const,
                            ticket,
                            message: scanResultData.error || "Failed to scan ticket",
                            overrideUsed: true,
                            overrideReason: reason,
                          };
                          playError();
                        }
                      } else {
                        // Local storage mode
                        const nowIso = new Date().toISOString();
                        const updatedTicket = {
                          ...ticket,
                          status: "scanned",
                          is_used: true,
                          scanned_at: nowIso,
                          scanned_by: user?.id ?? "offline-user",
                        };
                        localStorageService.saveTicket(updatedTicket);
                        scanResult = {
                          status: "valid" as const,
                          ticket: updatedTicket,
                          message: "Entry granted - Welcome! (Override used)",
                          overrideUsed: true,
                          overrideReason: reason,
                        };
                        playSuccess();
                      }

                      // Log override action after scan
                      await logOverrideAction(
                        ticket.id,
                        user?.id || null,
                        overrideType,
                        reason,
                        notes || null,
                        scanLogId
                      );

                      setScanResult(scanResult);
                      setIsScanning(false);
                      setShowOverrideReasonModal(false);
                      setPendingOverrideType(null);
                      setPendingOverrideTicket(null);
                    }}
                    overrideType={pendingOverrideType || 'capacity'}
                  />
                </>
              ) : scanMode === "camera" ? (
                scanMethod === "nfc" ? (
                  <NFCScanner 
                    onScanSuccess={handleNFCScanSuccess} 
                    isScanning={isScanning && !isProcessing}
                    onError={(error) => {
                      toast({
                        variant: "destructive",
                        title: "NFC Error",
                        description: error,
                      });
                    }}
                  />
                ) : (
                  <QrScanner 
                    onScanSuccess={handleScanSuccess} 
                    isScanning={isScanning && !isProcessing}
                    onError={(error) => {
                      toast({
                        variant: "destructive",
                        title: "Camera Error",
                        description: error,
                      });
                    }}
                  />
                )
              ) : (
                <ScannerInput 
                  onScanSuccess={handleScanSuccess}
                  disabled={isProcessing}
                />
              )}
            </Card>
          )}

          {/* Scanner Card (shown in batch mode) */}
          {batchMode && (
            <Card className="border-primary/20 shadow-glow-purple overflow-hidden">
              {scanMode === "camera" ? (
                scanMethod === "nfc" ? (
                  <NFCScanner 
                    onScanSuccess={handleNFCScanSuccess} 
                    isScanning={isScanning && !isProcessing}
                    onError={(error) => {
                      toast({
                        variant: "destructive",
                        title: "NFC Error",
                        description: error,
                      });
                    }}
                  />
                ) : (
                  <QrScanner 
                    onScanSuccess={handleScanSuccess} 
                    isScanning={isScanning && !isProcessing}
                    onError={(error) => {
                      toast({
                        variant: "destructive",
                        title: "Camera Error",
                        description: error,
                      });
                    }}
                  />
                )
              ) : (
                <ScannerInput 
                  onScanSuccess={handleScanSuccess}
                  disabled={isProcessing}
                />
              )}
            </Card>
          )}

          {/* Manual Entry */}
          <div ref={manualEntryRef} className="scroll-mt-24">
          {(!scanResult || batchMode) && (
            <ManualEntry 
              onSubmit={handleManualEntry} 
              disabled={isProcessing}
            />
          )}
          </div>
          </div>

          {/* Right Column - Device Info Card Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 lg:top-24 space-y-4">
              <DeviceInfoCard />
            </div>
          </div>
        </div>
      </div>

      {/* Low Battery Modal */}
      {batteryLevel !== null && (
        <LowBatteryModal
          open={showLowBatteryModal}
          onClose={() => setShowLowBatteryModal(false)}
          batteryLevel={batteryLevel}
          isCharging={isCharging}
        />
      )}
    </LayoutComponent>
  );
};

export default Scanner;
