import { useEffect } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { getPurchaseSiteBaseUrl } from "@/lib/purchaseSiteConfig";

interface CheckoutDrawerProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CheckoutDrawer({ eventId, isOpen, onClose }: CheckoutDrawerProps) {
  const purchaseBaseUrl = getPurchaseSiteBaseUrl();
  const iframeSrc = `${purchaseBaseUrl}/checkout?event=${eventId}&embed=true`;

  // Derive origin for postMessage validation (strips path)
  let purchaseSiteOrigin = purchaseBaseUrl;
  try {
    purchaseSiteOrigin = new URL(purchaseBaseUrl).origin;
  } catch {
    // purchaseBaseUrl already looks like an origin
  }

  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== purchaseSiteOrigin) return;
      if (event.data?.type === 'purchase_complete') {
        onClose();
        toast.success("Purchase complete! Check your email for tickets.");
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, purchaseSiteOrigin, onClose]);

  // Trap keyboard focus and close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Ticket Checkout"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="relative z-10 w-full sm:w-[520px] h-[88vh] sm:h-[720px] bg-[#0a0a0a] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-white/10">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
          <span className="text-white font-semibold text-sm tracking-wide">BUY TICKETS</span>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            aria-label="Close checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Embedded checkout iframe */}
        <iframe
          src={iframeSrc}
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
          title="Ticket Checkout"
          loading="eager"
        />
      </div>
    </div>
  );
}
