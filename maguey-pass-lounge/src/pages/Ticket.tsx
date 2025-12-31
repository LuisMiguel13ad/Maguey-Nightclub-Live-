import { Link, useParams, useNavigate } from "react-router-dom";
import { Calendar, MapPin, User, QrCode, Download, Share2, Loader2, AlertCircle, Wallet, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useRef } from "react";
import { getTicketById, type UserTicket } from "@/lib/orders-service";
import { toast } from "sonner";
import html2canvas from 'html2canvas';
import QRCode from 'react-qr-code';
import { CustomCursor } from "@/components/CustomCursor";

const Ticket = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<UserTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ticketId) {
      setError("No ticket ID provided");
      setLoading(false);
      return;
    }

    const loadTicket = async () => {
      setLoading(true);
      setError(null);
      try {
        const ticketData = await getTicketById(ticketId);
        if (!ticketData) {
          setError("Ticket not found");
          toast.error("Ticket not found");
        } else {
          setTicket(ticketData);
        }
      } catch (err) {
        console.error('Error loading ticket:', err);
        setError("Failed to load ticket");
        toast.error("Failed to load ticket");
      } finally {
        setLoading(false);
      }
    };

    loadTicket();
  }, [ticketId]);

  const formatTicketDisplayName = (rawName: string) => {
    const name = rawName.toLowerCase();
    if (name.includes("female") && name.includes("general")) {
      return "Female - General Admission";
    }
    if (name.includes("male") && name.includes("general")) {
      return "Male - General Admission";
    }
    if (name.includes("vip") && name.includes("general")) {
      return "VIP - General Admission";
    }
    if (name.includes("expedited")) {
      return "Expedited Entry Admission";
    }
    return rawName;
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hourStr, minuteStr] = timeString.split(':');
    if (!hourStr || !minuteStr) return timeString;
    const date = new Date();
    date.setHours(Number(hourStr), Number(minuteStr));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get QR code value for display
  const getQrCodeValue = () => {
    if (ticket?.qr_code_value) {
      return ticket.qr_code_value;
    }
    if (ticket?.ticket_id) {
      return ticket.ticket_id;
    }
    return '';
  };

  const qrCodeValue = getQrCodeValue();

  // Download ticket as image
  const handleDownload = async () => {
    if (!ticketRef.current || !ticket) return;
    
    setIsDownloading(true);
    toast.loading('Preparing ticket for download...', { id: 'download' });
    
    try {
      // Wait a moment to ensure all content is rendered (especially SVG QR code)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast.loading('Capturing ticket...', { id: 'download' });
      
      const canvas = await html2canvas(ticketRef.current, {
        backgroundColor: '#09090b',
        scale: 2,
        logging: false,
        useCORS: true, // Allow cross-origin images
        allowTaint: false, // Don't allow tainted canvas
        imageTimeout: 15000, // 15 second timeout for images
      });
      
      toast.loading('Generating image...', { id: 'download' });
      
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `maguey-ticket-${ticket.ticket_id}.png`;
      link.href = image;
      link.click();
      
      toast.dismiss('download');
      toast.success('Ticket downloaded successfully!');
    } catch (err) {
      console.error('Error downloading ticket:', err);
      toast.dismiss('download');
      toast.error('Failed to download ticket. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Share ticket
  const handleShare = async () => {
    if (!ticket) return;
    
    const shareData = {
      title: `${ticket.event_name} - Ticket`,
      text: `My ticket for ${ticket.event_name}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success('Ticket shared successfully!');
      } else {
        // Fallback: Copy link to clipboard
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Ticket link copied to clipboard!');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error sharing ticket:', err);
        toast.error('Failed to share ticket');
      }
    }
  };

  // Add to Apple Wallet
  const handleAddToAppleWallet = () => {
    if (!ticket) return;
    toast.info('Apple Wallet integration coming soon!', {
      description: 'We are working on adding Apple Wallet support for your tickets.',
    });
    // TODO: Implement Apple Wallet pass generation
    // This requires a backend service to generate .pkpass files
  };

  // Add to Google Wallet
  const handleAddToGoogleWallet = () => {
    if (!ticket) return;
    toast.info('Google Wallet integration coming soon!', {
      description: 'We are working on adding Google Wallet support for your tickets.',
    });
    // TODO: Implement Google Wallet pass generation
    // This requires Google Wallet API integration
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-copper-400" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Loading Ticket...
        </p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="font-serif text-2xl text-stone-100 mb-2">Ticket Not Found</h2>
          <p className="text-stone-400 mb-4">{error || "The ticket you're looking for doesn't exist"}</p>
          <Button onClick={() => navigate('/account')} className="bg-copper-400 hover:bg-copper-500 text-forest-950">Back to My Tickets</Button>
        </div>
      </div>
    );
  }

  const displayTicketType = formatTicketDisplayName(ticket.ticket_type_name);
  const venueAddress = ticket.venue_address 
    ? `${ticket.venue_address}, ${ticket.city || ''}`.trim()
    : ticket.city || '123 Main St, Wilmington, DE 19801';

  return (
    <div className="min-h-screen bg-forest-950 text-stone-300 overflow-x-hidden flex flex-col">
      {/* Custom Cursor */}
      <CustomCursor />
      
      {/* Noise Overlay */}
      <div className="noise-overlay" />
      
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
        <svg width="100%" height="100%">
          <pattern id="ticket-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-copper-400" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#ticket-grid)" />
        </svg>
      </div>
      
      {/* Header */}
      <header className="relative z-50 border-b border-white/5 bg-forest-950/80 backdrop-blur-md sticky top-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="font-mono text-xs tracking-[0.2em] uppercase group">
              MAGUEY <span className="text-copper-400">/</span> DE
            </Link>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/account')}
              className="flex items-center gap-2 text-stone-400 hover:text-stone-100 hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to My Tickets
            </Button>
          </div>
        </div>
      </header>

      {/* Ticket Display */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          {/* Success Message */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-copper-400/20 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-copper-400/30">
              <QrCode className="w-8 h-8 text-copper-400" />
            </div>
            <h1 className="font-serif text-3xl text-stone-100 mb-2">
              Your <span className="italic text-copper-400">Ticket</span>
            </h1>
            <p className="text-stone-400">Present this QR code at the entrance</p>
          </div>

          {/* Digital Ticket */}
          <div ref={ticketRef} className="glass-panel rounded-sm overflow-hidden border-copper-400/30">
            {/* Event Image/Flyer - Prominent Display */}
            {ticket.event_image ? (
              <div className="relative w-full overflow-hidden">
              <img
                  src={ticket.event_image}
                alt={ticket.event_name}
                  className="w-full h-auto object-contain bg-forest-950"
                  onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                {/* Event Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-forest-950 via-forest-950/90 to-transparent">
                  <h2 className="font-serif text-2xl text-stone-100 mb-2 drop-shadow-lg">{ticket.event_name}</h2>
                  <div className="flex items-center gap-2 text-sm text-stone-300 drop-shadow-md">
                    <Calendar className="w-4 h-4 text-copper-400" />
                    <span>
                      {new Date(ticket.event_date).toLocaleDateString('en-US', { 
                        weekday: 'short',
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric' 
                      })} • {formatTime(ticket.event_time)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // Fallback if no event image
              <div className="relative bg-gradient-to-br from-copper-400/20 to-copper-400/10 p-8 border-b border-copper-400/30">
                <h2 className="font-serif text-2xl text-stone-100 mb-2">{ticket.event_name}</h2>
                <div className="flex items-center gap-2 text-sm text-stone-400">
                  <Calendar className="w-4 h-4 text-copper-400" />
                  <span>
                    {new Date(ticket.event_date).toLocaleDateString('en-US', { 
                      weekday: 'short',
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric' 
                    })} • {formatTime(ticket.event_time)}
                  </span>
                </div>
              </div>
            )}

            {/* QR Code - Always Display */}
            <div className="bg-white p-8 flex flex-col items-center justify-center border-y-2 border-dashed border-copper-400/30">
              <div className="text-center mb-4">
                <QrCode className="w-6 h-6 mx-auto mb-2 text-copper-600" />
                <p className="text-sm font-medium text-gray-700">Scan at Entrance</p>
            </div>
              {qrCodeValue ? (
                <div className="w-64 h-64 p-4 bg-white border-4 border-gray-200 rounded-sm shadow-lg flex items-center justify-center">
                  <QRCode
                    value={qrCodeValue}
                    size={256}
                    level="H" // High error correction
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  />
                </div>
              ) : (
                <div className="w-64 h-64 bg-gray-100 border-4 border-gray-200 rounded-sm flex items-center justify-center">
                  <p className="text-gray-400 text-sm">QR Code Loading...</p>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-3 text-center">
                Ticket ID: {ticket.ticket_id}
              </p>
            </div>

            {/* Ticket Details */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm text-stone-400">Ticket Type</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {ticket.ticket_category && ticket.ticket_category !== 'general' && (
                    <Badge className={
                      ticket.ticket_category === 'vip' ? 'bg-copper-400/20 text-copper-400 border-copper-400/50' :
                      ticket.ticket_category === 'service' ? 'bg-purple-400/20 text-purple-400 border-purple-400/50' :
                      ticket.ticket_category === 'section' ? 'bg-blue-400/20 text-blue-400 border-blue-400/50' :
                      'bg-copper-400/20 text-copper-400 border-copper-400/50'
                    }>
                      {ticket.ticket_category.toUpperCase()}
                    </Badge>
                  )}
                <Badge className="bg-copper-400/20 text-copper-400 border-copper-400/50">
                    {displayTicketType}
                  </Badge>
                  {ticket.section_name && (
                    <Badge variant="outline" className="border-white/20 text-stone-300">
                      {ticket.section_name}
                </Badge>
                  )}
                </div>
              </div>
              {ticket.section_description && (
                <div className="text-sm text-stone-400 bg-white/5 p-3 rounded-sm">
                  <span className="font-medium text-stone-300">Section Details: </span>
                  {ticket.section_description}
                </div>
              )}

              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-copper-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm text-stone-400">Ticket Holder</div>
                  <div className="font-medium text-stone-100">{ticket.attendee_name || 'Guest'}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-copper-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm text-stone-400">Venue</div>
                  <div className="font-medium text-stone-100">{ticket.venue_name || 'Maguey Nightclub'}</div>
                  <div className="text-sm text-stone-400">{venueAddress}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="text-xs text-stone-500 text-center">
                  Ticket ID: {ticket.ticket_id}
                </div>
                <div className="text-xs text-stone-500 text-center mt-1">
                  Order ID: {ticket.order_id.slice(0, 8)}...
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="w-full border-white/20 text-stone-300 hover:bg-white/10 rounded-sm" 
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {isDownloading ? 'Downloading...' : 'Download'}
            </Button>
            <Button 
              variant="outline" 
              className="w-full border-white/20 text-stone-300 hover:bg-white/10 rounded-sm"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>

          {/* Wallet Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="w-full border-white/20 text-stone-300 hover:bg-white/10 rounded-sm"
              onClick={handleAddToAppleWallet}
            >
              <Wallet className="w-4 h-4 mr-2" />
              Apple Wallet
            </Button>
            <Button 
              variant="outline" 
              className="w-full border-white/20 text-stone-300 hover:bg-white/10 rounded-sm"
              onClick={handleAddToGoogleWallet}
            >
              <Wallet className="w-4 h-4 mr-2" />
              Google Wallet
            </Button>
          </div>

          {/* Important Info */}
          <div className="glass-panel rounded-sm p-4">
            <h3 className="font-semibold mb-2 text-sm text-stone-200">Important Information</h3>
            <ul className="text-xs text-stone-400 space-y-1">
              <li>• Valid government-issued ID required at entrance</li>
              <li>• Arrive 30 minutes before event time</li>
              <li>• Screenshot this ticket for offline access</li>
              <li>• Do not share your QR code with anyone</li>
              <li>• Tickets are non-transferable and non-refundable</li>
            </ul>
          </div>

          {/* Navigation Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button className="w-full bg-copper-400 hover:bg-copper-500 text-forest-950 rounded-sm" asChild>
              <Link to="/account">My Tickets</Link>
            </Button>
            <Button variant="outline" className="w-full border-white/20 text-stone-300 hover:bg-white/10 rounded-sm" asChild>
              <Link to="/">View More Events</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Ticket;
