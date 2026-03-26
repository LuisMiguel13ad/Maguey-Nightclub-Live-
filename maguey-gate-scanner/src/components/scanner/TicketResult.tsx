import { CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, LogIn, LogOut, Crown, Sparkles, IdCard, Camera, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { getTicketScanHistory, getTicketReEntryStatus, type ScanHistoryEntry } from "@/lib/re-entry-service";
import { getTierInfo, getTierColor, getTierDisplayName, type TicketTier } from "@/lib/tier-service";
import { checkIDRequirementByName, isTicketVerified } from "@/lib/id-verification-service";
import { PhotoCaptureModal } from "./PhotoCaptureModal";
import { getTicketPhotos } from "@/lib/photo-capture-service";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface TicketResultProps {
  result: {
    status: "valid" | "used" | "invalid";
    ticket?: any;
    message: string;
    overrideUsed?: boolean;
    overrideReason?: string;
  };
  onReset: () => void;
  overrideUsed?: boolean;
  overrideReason?: string;
}

export const TicketResult = ({ result, onReset, overrideUsed, overrideReason }: TicketResultProps) => {
  const { user } = useAuth();
  const isOverrideUsed = overrideUsed || result.overrideUsed || false;
  const overrideReasonText = overrideReason || result.overrideReason || '';
  const isValid = result.status === "valid";
  const isUsed = result.status === "used";
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [reEntryStatus, setReEntryStatus] = useState<{
    currentStatus: 'inside' | 'outside' | 'left';
    entryCount: number;
    exitCount: number;
  } | null>(null);
  const [tierInfo, setTierInfo] = useState<TicketTier | null>(null);
  const [requiresIDVerification, setRequiresIDVerification] = useState(false);
  const [isIDVerified, setIsIDVerified] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [ticketPhotos, setTicketPhotos] = useState<any[]>([]);
  const [hasPhoto, setHasPhoto] = useState(false);

  useEffect(() => {
    const loadScanHistory = async () => {
      if (result.ticket?.id) {
        const history = await getTicketScanHistory(result.ticket.id);
        setScanHistory(history);
        
        const status = await getTicketReEntryStatus(result.ticket.id);
        setReEntryStatus({
          currentStatus: status.currentStatus,
          entryCount: status.entryCount,
          exitCount: status.exitCount,
        });
      }
    };
    loadScanHistory();
  }, [result.ticket?.id]);

  useEffect(() => {
    const loadTierInfo = async () => {
      if (result.ticket?.tier) {
        const tier = await getTierInfo(result.ticket.tier);
        setTierInfo(tier);
      } else {
        // Try to infer tier from ticket_type if tier is not set
        const ticketType = result.ticket?.ticket_type?.toLowerCase() || '';
        if (ticketType.includes('vip')) {
          const tier = await getTierInfo('vip');
          setTierInfo(tier);
        } else if (ticketType.includes('premium')) {
          const tier = await getTierInfo('premium');
          setTierInfo(tier);
        } else if (ticketType.includes('backstage')) {
          const tier = await getTierInfo('backstage');
          setTierInfo(tier);
        } else {
          const tier = await getTierInfo('general');
          setTierInfo(tier);
        }
      }
    };
    loadTierInfo();
  }, [result.ticket?.tier, result.ticket?.ticket_type]);

  useEffect(() => {
    const checkIDVerification = async () => {
      if (result.ticket?.id) {
        const verified = await isTicketVerified(result.ticket.id);
        setIsIDVerified(verified);
        
        // Check if ID verification is required
        const ticketTypeName = result.ticket.ticket_types?.name || result.ticket.ticket_type || '';
        const required = checkIDRequirementByName(ticketTypeName);
        setRequiresIDVerification(required);
      }
    };
    
    if (isValid && result.ticket) {
      checkIDVerification();
    }
  }, [result.ticket?.id, isValid]);

  // Load ticket photos
  useEffect(() => {
    const loadPhotos = async () => {
      if (result.ticket?.id) {
        const photos = await getTicketPhotos(result.ticket.id);
        setTicketPhotos(photos);
        setHasPhoto(photos.length > 0 || !!result.ticket.photo_url);
      }
    };
    loadPhotos();
  }, [result.ticket?.id]);

  const handlePhotoCaptured = (photoUrl: string, thumbnailUrl: string, photoId?: string) => {
    setHasPhoto(true);
    // Refresh photos list
    if (result.ticket?.id) {
      getTicketPhotos(result.ticket.id).then(setTicketPhotos);
    }
  };

  // Check if photo is required (VIP, premium tickets, or ID verification scenarios)
  const isPhotoRequired = () => {
    if (!result.ticket) return false;
    const ticketType = (result.ticket.ticket_types?.name || result.ticket.ticket_type || '').toLowerCase();
    return ticketType.includes('vip') || ticketType.includes('premium') || requiresIDVerification;
  };

  const tierColor = tierInfo?.color || getTierColor(result.ticket?.tier);
  const tierDisplayName = getTierDisplayName(result.ticket?.tier || result.ticket?.ticket_type);
  const isVIPTier = (result.ticket?.tier || '').toLowerCase() === 'vip' || 
                    (result.ticket?.ticket_type || '').toLowerCase().includes('vip');
  const isPremiumTier = (result.ticket?.tier || '').toLowerCase() === 'premium' || 
                        (result.ticket?.ticket_type || '').toLowerCase().includes('premium');
  const isBackstageTier = (result.ticket?.tier || '').toLowerCase() === 'backstage' || 
                          (result.ticket?.ticket_type || '').toLowerCase().includes('backstage');

  const wrapperClass = isValid
    ? "bg-gradient-to-b from-emerald-900 via-emerald-900/70 to-emerald-950 border-emerald-500/40 text-emerald-50"
    : isUsed
    ? "bg-gradient-to-b from-amber-950 via-amber-900/80 to-amber-950 border-amber-500/40 text-amber-50"
    : "bg-gradient-to-b from-[#2b0303] via-red-950 to-black border-red-500/40 text-red-50";

  const headerGlow = isValid
    ? "shadow-[0_0_35px_rgba(16,185,129,0.45)]"
    : isUsed
    ? "shadow-[0_0_35px_rgba(251,191,36,0.4)]"
    : "shadow-[0_0_35px_rgba(248,113,113,0.45)]";

  return (
    <div
      className={cn(
        "rounded-3xl border-2 shadow-2xl transition-all duration-300 overflow-hidden",
        wrapperClass,
      )}
    >
      {/* Override Warning Banner */}
      {isOverrideUsed && (
        <div className="w-full py-3 px-4 bg-red-500/20 border-l-4 border-red-500 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-500">Override Used</p>
            <p className="text-xs text-red-600/80">{overrideReasonText}</p>
          </div>
          <Badge variant="destructive" className="text-xs">
            OVERRIDE
          </Badge>
        </div>
      )}

      {/* Tier Banner - Large Visual Indicator */}
      {isValid && tierInfo && tierInfo.name !== 'general' && (
        <div 
          className="w-full py-4 sm:py-6 text-center font-bold text-lg sm:text-2xl uppercase tracking-wider"
          style={{ 
            backgroundColor: `${tierColor}20`,
            borderTop: `4px solid ${tierColor}`,
            borderBottom: `4px solid ${tierColor}`,
            color: tierColor
          }}
        >
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            {isVIPTier && <Crown className="h-5 w-5 sm:h-6 sm:w-6" />}
            {isPremiumTier && <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />}
            <span>{tierDisplayName} TICKET</span>
            {isVIPTier && <Crown className="h-5 w-5 sm:h-6 sm:w-6" />}
            {isPremiumTier && <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />}
          </div>
        </div>
      )}

      <CardHeader
        className={cn(
          "text-center py-8 sm:py-12 border-b border-white/10 transition-all duration-300",
          isValid
            ? "bg-emerald-500/15"
            : isUsed
            ? "bg-amber-500/15"
            : "bg-red-600/20",
          headerGlow,
        )}
      >
        <div className="flex justify-center mb-4 sm:mb-6">
          {isValid ? (
            <div className="p-4 sm:p-6 bg-success rounded-full shadow-glow-success">
              <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-success-foreground" />
            </div>
          ) : isUsed ? (
            <div className="p-4 sm:p-6 bg-accent rounded-full shadow-glow-gold">
              <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-accent-foreground" />
            </div>
          ) : (
            <div className="p-4 sm:p-6 bg-destructive rounded-full">
              <XCircle className="h-12 w-12 sm:h-16 sm:w-16 text-destructive-foreground" />
            </div>
          )}
        </div>
        <h2
          className={`text-2xl sm:text-4xl font-bold mb-2 sm:mb-4 ${
            isValid
              ? "text-success"
              : isUsed
              ? "text-accent"
              : "text-destructive"
          }`}
        >
          {isValid ? "ENTRY GRANTED" : isUsed ? "ALREADY SCANNED" : "INVALID TICKET"}
        </h2>
        <p className="text-base sm:text-xl text-foreground/80 px-2">{result.message}</p>
      </CardHeader>

      {result.ticket && (
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* ID Verification Badge */}
          {isValid && requiresIDVerification && (
            <div className="flex items-center justify-center mb-2">
              <Badge 
                variant={isIDVerified ? "default" : "destructive"}
                className={`flex items-center gap-2 px-3 py-1.5 ${
                  isIDVerified 
                    ? "bg-green-600 hover:bg-green-700" 
                    : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                <IdCard className="h-4 w-4" />
                {isIDVerified ? "ID Verified" : "ID Required"}
              </Badge>
            </div>
          )}

          {/* Tier Perks Display */}
          {isValid && tierInfo && tierInfo.perks_description && tierInfo.name !== 'general' && (
            <div 
              className="p-3 sm:p-4 rounded-lg border-2 mb-4"
              style={{ 
                borderColor: tierColor,
                backgroundColor: `${tierColor}10`
              }}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">
                  {isVIPTier && <Crown className="h-4 w-4" style={{ color: tierColor }} />}
                  {isPremiumTier && <Sparkles className="h-4 w-4" style={{ color: tierColor }} />}
                  {isBackstageTier && <Sparkles className="h-4 w-4" style={{ color: tierColor }} />}
                </div>
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-semibold mb-1" style={{ color: tierColor }}>
                    {tierDisplayName} Perks:
                  </p>
                  <p className="text-xs sm:text-sm text-foreground/90">
                    {tierInfo.perks_description}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Ticket ID</p>
              <p className="font-mono font-bold text-primary break-all">{result.ticket.ticket_id}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Type</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{result.ticket.ticket_type}</p>
                {tierInfo && tierInfo.name !== 'general' && (
                  <Badge 
                    className="text-[10px] sm:text-xs px-2 py-0.5"
                    style={{ 
                      backgroundColor: tierColor,
                      color: 'white',
                      border: 'none'
                    }}
                  >
                    {tierDisplayName}
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Event</p>
              <p className="font-semibold break-words">{result.ticket.event_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Guest</p>
              <p className="font-semibold break-words">{result.ticket.guest_name}</p>
            </div>
          </div>

          {/* Re-entry Status */}
          {reEntryStatus && (reEntryStatus.entryCount > 0 || reEntryStatus.exitCount > 0) && (
            <div className="pt-4 border-t border-primary/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Current Status</span>
                <Badge 
                  variant={reEntryStatus.currentStatus === 'inside' ? 'default' : 'outline'}
                  className={reEntryStatus.currentStatus === 'inside' ? 'bg-green-600' : ''}
                >
                  {reEntryStatus.currentStatus === 'inside' ? (
                    <>
                      <LogIn className="h-3 w-3 mr-1" />
                      Inside Venue
                    </>
                  ) : (
                    <>
                      <LogOut className="h-3 w-3 mr-1" />
                      Outside Venue
                    </>
                  )}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Entries</p>
                  <p className="font-semibold text-lg">{reEntryStatus.entryCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Exits</p>
                  <p className="font-semibold text-lg">{reEntryStatus.exitCount}</p>
                </div>
              </div>
            </div>
          )}

          {/* Scan History */}
          {scanHistory.length > 0 && (
            <div className="pt-4 border-t border-primary/10">
              <p className="text-sm font-medium text-muted-foreground mb-3">Scan History</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {scanHistory.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {entry.scan_type === 'entry' ? (
                        <LogIn className="h-3 w-3 text-green-600" />
                      ) : (
                        <LogOut className="h-3 w-3 text-orange-600" />
                      )}
                      <span className="font-medium capitalize">{entry.scan_type}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(entry.scanned_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photo Capture Section */}
          {isValid && (
            <div className="pt-4 border-t border-primary/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Photo Verification
                  </span>
                  {isPhotoRequired() && (
                    <Badge variant="destructive" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                {hasPhoto && (
                  <Badge variant="default" className="text-xs bg-green-600">
                    <ImageIcon className="h-3 w-3 mr-1" />
                    Photo Captured
                  </Badge>
                )}
              </div>

              {hasPhoto && ticketPhotos.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {ticketPhotos.slice(0, 2).map((photo) => (
                    <div
                      key={photo.id}
                      className="relative aspect-video rounded-lg overflow-hidden border border-primary/20"
                    >
                      <img
                        src={photo.thumbnail_url || photo.photo_url}
                        alt="Ticket photo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                onClick={() => setShowPhotoCapture(true)}
                variant={hasPhoto ? "outline" : "default"}
                className={`w-full ${!hasPhoto ? 'bg-gradient-purple hover:shadow-glow-purple' : ''}`}
                size="sm"
              >
                <Camera className="h-4 w-4 mr-2" />
                {hasPhoto ? 'Add Another Photo' : 'Capture Photo'}
              </Button>
            </div>
          )}

          <Button
            onClick={onReset}
            className="w-full mt-4 sm:mt-6 bg-gradient-purple hover:shadow-glow-purple transition-all text-sm sm:text-base"
            size="lg"
          >
            Scan Next Ticket
          </Button>
        </CardContent>
      )}

      {/* Photo Capture Modal */}
      {result.ticket?.id && (
        <PhotoCaptureModal
          open={showPhotoCapture}
          onClose={() => setShowPhotoCapture(false)}
          onCapture={handlePhotoCaptured}
          ticketId={result.ticket.id}
          userId={user?.id}
          requireConsent={true}
          requirePhoto={isPhotoRequired()}
        />
      )}

      {!result.ticket && (
        <CardContent className="p-6">
          <Button
            onClick={onReset}
            className="w-full bg-gradient-purple hover:shadow-glow-purple transition-all"
            size="lg"
          >
            Try Again
          </Button>
        </CardContent>
      )}
    </div>
  );
};
