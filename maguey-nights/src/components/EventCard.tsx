import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { type EventAvailability } from "@/services/eventService";
import { getCheckoutUrlForEvent, getWaitlistUrl } from "@/lib/purchaseSiteConfig";

interface EventCardProps {
  image: string;
  artist: string;
  schedule: string;
  location: string;
  eventId?: string;
  purchaseUrl?: string;
  availability?: EventAvailability;
  category?: string;
  status?: string;
  tags?: string[];
  bannerUrl?: string;
  variant?: 'default' | 'flyer';
}

const getCategoryStyles = (category?: string) => {
  const normalized = category?.toLowerCase() || "";

  if (normalized.includes("reggaeton")) {
    return {
      gradient: "from-[#320044] via-[#22002f] to-[#0f0018]",
      badge: "bg-pink-500/90 text-white",
      button: "bg-pink-500 hover:bg-pink-400 text-white"
    };
  }

  if (normalized.includes("cumbia")) {
    return {
      gradient: "from-[#0f3b2d] via-[#0b2a1f] to-[#050f0d]",
      badge: "bg-emerald-500/90 text-white",
      button: "bg-emerald-500 hover:bg-emerald-400 text-white"
    };
  }

  if (normalized.includes("regional")) {
    return {
      gradient: "from-[#402400] via-[#281700] to-[#120900]",
      badge: "bg-amber-500/90 text-black",
      button: "bg-amber-500 hover:bg-amber-400 text-black"
    };
  }

  if (normalized.includes("special") || normalized.includes("holiday")) {
    return {
      gradient: "from-[#2f0034] via-[#1f0022] to-[#0b0010]",
      badge: "bg-purple-500/90 text-white",
      button: "bg-purple-500 hover:bg-purple-400 text-white"
    };
  }

  return {
    gradient: "from-[#1a1a1d] via-[#111113] to-[#050506]",
    badge: "bg-white/10 text-white/80",
    button: "bg-white/15 hover:bg-white/20 text-white"
  };
};

const EventCard = ({
  image,
  artist,
  schedule,
  location,
  eventId,
  purchaseUrl,
  availability,
  category,
  status,
  tags = [],
  bannerUrl,
  variant = 'default'
}: EventCardProps) => {
  const totalAvailable = availability?.ticketTypes.reduce((sum, tt) => sum + tt.available, 0) || 0;
  const isSoldOut = totalAvailable === 0 && availability !== undefined;
  const isLowStock = totalAvailable > 0 && totalAvailable <= 10;

  const fallbackPurchaseUrl = eventId ? getCheckoutUrlForEvent(eventId) : "";
  const finalPurchaseUrl = purchaseUrl || fallbackPurchaseUrl;
  const waitlistUrl = eventId ? getWaitlistUrl(eventId, artist) : "";
  const finalActionUrl = isSoldOut && waitlistUrl ? waitlistUrl : finalPurchaseUrl;
  const hasPurchaseUrl = finalActionUrl && finalActionUrl.trim() !== "";

  // Use flyer image if available, otherwise use regular image
  const displayImage = bannerUrl || image;
  const categoryStyles = getCategoryStyles(category);

  // Check if we have a flyer image (banner_url or image_url that's not a placeholder)
  // Also check if it's a valid URL (starts with http) or a valid local path
  const hasFlyerImage = displayImage && 
    displayImage !== '/placeholder.svg' && 
    !displayImage.includes('placeholder') &&
    displayImage.trim() !== '';
  const isFlyer = variant === 'flyer' || hasFlyerImage;

  const availabilityLabel = (() => {
    if (!availability) return null;
    if (isSoldOut) return "Sold Out";
    if (isLowStock) return `Only ${totalAvailable} left`;
    return "Tickets Available";
  })();

  const statusLabel =
    status && status.toLowerCase() !== "published"
      ? status
          .split(/[_\s]+/)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ")
      : null;

  const cardBody = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`group relative flex h-full overflow-hidden rounded-[32px] border border-white/10 ${isFlyer ? 'bg-black' : `bg-gradient-to-br ${categoryStyles.gradient}`} transition-transform duration-500 hover:-translate-y-1 hover:shadow-[0_40px_80px_-40px_rgba(255,0,140,0.35)]`}
      style={{ willChange: "transform, opacity" }}
    >
      {/* Background flyer image */}
      {displayImage && hasFlyerImage && (
        <>
          <img
            src={displayImage}
            alt={artist}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain object-center transition-transform duration-700 group-hover:scale-105"
            onError={(e) => {
              // Fallback to gradient if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          {/* Dark gradient overlay for text readability - stronger at bottom where text is */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/85" />
          {/* Additional overlay for better contrast on text areas */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />
        </>
      )}
      
      {/* Fallback gradient background if no flyer image or image fails to load */}
      {!hasFlyerImage && (
        <div className={`absolute inset-0 bg-gradient-to-br ${categoryStyles.gradient}`} />
      )}

      <div className="relative flex flex-1 flex-col justify-between p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {category && (
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${categoryStyles.badge} drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] backdrop-blur-sm`}>
                {category}
              </span>
            )}
            {statusLabel && (
              <Badge className="bg-white/10 text-white border-white/20 uppercase tracking-wider">
                {statusLabel}
              </Badge>
            )}
          </div>
          {availabilityLabel && (
            <Badge className="bg-white/10 text-white border-white/20 backdrop-blur-sm">
              {availabilityLabel}
            </Badge>
          )}
        </div>

        <div className="mt-10 flex-1">
          <h3 className="text-2xl font-extrabold uppercase tracking-wide text-white md:text-[26px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {artist}
          </h3>
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            {schedule}
          </p>
          <p className="mt-3 text-sm text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
            {location}
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3">
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 3).map((tag, index) => (
                <Badge
                  key={index}
                  className="bg-white/10 text-white/70 border border-white/15 text-[11px] uppercase tracking-wider"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Button
            className={`w-full rounded-full px-6 py-6 text-sm font-bold uppercase tracking-[0.3em] ${categoryStyles.button} transition-all duration-300 shadow-lg drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]`}
            disabled={!hasPurchaseUrl}
          >
            {isSoldOut ? "Join Waitlist" : "Get Tickets"}
          </Button>
        </div>
      </div>
    </motion.div>
  );

  if (hasPurchaseUrl) {
    return (
      <a href={finalActionUrl} target="_self" className="block h-full">
        {cardBody}
      </a>
    );
  }

  return <div className="block h-full opacity-80">{cardBody}</div>;
};

export default EventCard;
