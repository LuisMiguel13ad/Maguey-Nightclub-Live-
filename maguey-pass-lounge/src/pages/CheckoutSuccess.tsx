import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Mail, Download, Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomCursor } from "@/components/CustomCursor";

const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [purchaserEmail, setPurchaserEmail] = useState<string | null>(null);
  const [ticketCount, setTicketCount] = useState<number | null>(null);

  const sessionId = searchParams.get("session_id");
  const orderIdParam = searchParams.get("orderId");
  const emailParam = searchParams.get("email");

  useEffect(() => {
    if (orderIdParam) {
      setOrderId(orderIdParam);
      if (emailParam) {
        setPurchaserEmail(emailParam);
      }

      const stored = sessionStorage.getItem("maguey:lastOrder");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.order?.id === orderIdParam) {
            setTicketCount(parsed?.tickets?.length ?? null);
            setPurchaserEmail(parsed?.purchaserEmail ?? emailParam ?? null);
          }
          sessionStorage.removeItem("maguey:lastOrder");
        } catch (error) {
          console.warn("Failed to parse stored order cache:", error);
        }
      }

      setIsLoading(false);
      return;
    }

    // Verify payment with backend and get order details
    const verifyPayment = async () => {
      if (!sessionId) {
        setIsLoading(false);
        return;
      }

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        const response = await fetch(`${apiUrl}/verify-payment?session_id=${sessionId}`);
        
        if (response.ok) {
          const data = await response.json();
          setOrderId(data.orderId);
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
      } finally {
        setIsLoading(false);
      }
    };

    verifyPayment();
  }, [sessionId, orderIdParam, emailParam]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-forest-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-copper-400" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Confirming Payment...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest-950 text-stone-300 overflow-x-hidden">
      {/* Custom Cursor */}
      <CustomCursor />
      
      {/* Noise Overlay */}
      <div className="noise-overlay" />
      
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
        <svg width="100%" height="100%">
          <pattern id="success-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-copper-400" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#success-grid)" />
        </svg>
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-white/5 bg-forest-950/80 backdrop-blur-md sticky top-0">
        <div className="container mx-auto px-4 py-4">
          <Link to="/" className="font-mono text-xs tracking-[0.2em] uppercase group">
            MAGUEY <span className="text-copper-400">/</span> DE
          </Link>
        </div>
      </header>

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-500/30">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="font-serif text-4xl text-stone-100 mb-2">
            Payment <span className="italic text-copper-400">Successful</span>
          </h1>
          <p className="text-stone-400">Your tickets have been confirmed and sent to your email</p>
        </div>

        <div className="glass-panel rounded-sm p-6 space-y-6">
          <div className="bg-copper-400/5 border border-copper-400/20 rounded-sm p-4 flex items-start gap-3">
            <Mail className="w-5 h-5 text-copper-400 flex-shrink-0 mt-0.5" />
            <p className="text-stone-300 text-sm">
              Check your email for your digital tickets. They've been sent to the email address you provided.
            </p>
          </div>

          {purchaserEmail && (
            <p className="text-sm text-stone-400">
              Tickets sent to <span className="text-stone-200 font-medium">{purchaserEmail}</span>
              {ticketCount ? ` • ${ticketCount} ticket${ticketCount === 1 ? "" : "s"}` : ""}
            </p>
          )}

          <div className="space-y-4">
            <div>
              <h2 className="font-serif text-xl text-stone-100 mb-4">What's Next?</h2>
              <ul className="space-y-3 text-stone-400">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-copper-400 shrink-0 mt-0.5" />
                  <span>Check your email for your tickets with QR codes</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-copper-400 shrink-0 mt-0.5" />
                  <span>Screenshot or download your tickets for offline access</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-copper-400 shrink-0 mt-0.5" />
                  <span>Bring a valid government-issued ID to the event</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-copper-400 shrink-0 mt-0.5" />
                  <span>Arrive 30 minutes before the event start time</span>
                </li>
              </ul>
            </div>

            {orderId && (
              <div className="pt-4 border-t border-white/10">
                <p className="text-sm text-stone-500">
                  Order ID: <span className="font-mono text-stone-400">{orderId}</span>
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button asChild className="flex-1 bg-copper-400 hover:bg-copper-500 text-forest-950 rounded-sm">
              <Link to="/account">
                <Download className="w-4 h-4 mr-2" />
                View My Tickets
              </Link>
            </Button>
            <Button variant="outline" asChild className="flex-1 border-white/20 text-stone-300 hover:bg-white/10 rounded-sm">
              <Link to="/">
                <Share2 className="w-4 h-4 mr-2" />
                Browse More Events
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccess;

