import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { type Event, getCheckoutUrlForEvent } from "@/lib/events-service";

interface EventHeroSliderProps {
  events: Event[];
  getEventDateLabel: (event: Event) => string;
  getEventTimeLabel: (event: Event) => string;
  getGenreBadgeClass: (genre: string | null) => string;
}

export const EventHeroSlider = ({
  events,
  getEventDateLabel,
  getEventTimeLabel,
  getGenreBadgeClass,
}: EventHeroSliderProps) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleEventClick = async (eventId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const checkoutUrl = await getCheckoutUrlForEvent(eventId);
    if (checkoutUrl) {
      navigate(checkoutUrl);
    } else {
      console.error("No ticket types found for event:", eventId);
    }
  };

  useEffect(() => {
    if (events.length === 0) return;

    const imageUrls = events.map(
      (event) =>
        event.image_url ||
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&h=900&fit=crop",
    );

    const loadImages = async () => {
      setIsLoading(true);
      const loadPromises = imageUrls.map((url) => {
        return new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.src = url;
          img.onload = () => resolve(url);
          img.onerror = () => resolve(url); // Fallback to URL even if image fails
        });
      });

      const loaded = await Promise.all(loadPromises);
      setLoadedImages(loaded);
      setIsLoading(false);
    };

    loadImages();
  }, [events]);

  useEffect(() => {
    if (events.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % events.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [events.length]);

  if (events.length === 0 || isLoading) {
    return null;
  }

  const currentEvent = events[currentIndex];
  const currentImage = loadedImages[currentIndex];
  const dateLabel = getEventDateLabel(currentEvent);
  const timeLabel = getEventTimeLabel(currentEvent);
  const genreBadgeClass = getGenreBadgeClass(currentEvent.genre);

  const slideVariants = {
    initial: {
      scale: 1.1,
      opacity: 0,
    },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: [0.645, 0.045, 0.355, 1.0] as const,
      },
    },
    exit: {
      scale: 0.95,
      opacity: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  const contentVariants = {
    initial: {
      opacity: 0,
      y: 30,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        delay: 0.2,
      },
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.4,
      },
    },
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Background Image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentEvent.id}
          initial="initial"
          animate="visible"
          exit="exit"
          variants={slideVariants}
          className="absolute inset-0"
        >
          <img
            src={currentImage}
            alt={currentEvent.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
        </motion.div>
      </AnimatePresence>

      {/* Content Overlay */}
      <div className="absolute inset-0 z-50 flex items-end md:items-center">
        <div className="container mx-auto px-4 pb-8 md:pb-0 w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentEvent.id}
              initial="initial"
              animate="visible"
              exit="exit"
              variants={contentVariants}
              className="max-w-4xl"
            >
              {/* Genre Badge */}
              <div className="mb-4">
                <Badge
                  className={`${genreBadgeClass} text-sm px-4 py-1.5 backdrop-blur-sm border-2`}
                >
                  {currentEvent.genre || "Featured Event"}
                </Badge>
              </div>

              {/* Event Name */}
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-4 text-white drop-shadow-2xl leading-tight tracking-tight">
                {currentEvent.name.toUpperCase()}
              </h1>

              {/* Event Details */}
              <div className="flex flex-wrap items-center gap-4 md:gap-6 mb-6">
                <div className="flex items-center gap-2 text-base md:text-lg lg:text-xl font-semibold text-white drop-shadow-lg bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full">
                  <Calendar className="w-5 h-5 md:w-6 md:h-6 text-primary shrink-0" />
                  <span>{dateLabel}</span>
                </div>
                {timeLabel && (
                  <div className="flex items-center gap-2 text-base md:text-lg lg:text-xl font-semibold text-white drop-shadow-lg bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full">
                    <Clock className="w-5 h-5 md:w-6 md:h-6 text-secondary shrink-0" />
                    <span>{timeLabel}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-base md:text-lg lg:text-xl font-semibold text-white drop-shadow-lg bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full">
                  <MapPin className="w-5 h-5 md:w-6 md:h-6 text-vip shrink-0" />
                  <span>
                    {currentEvent.venue_name || "Maguey Nightclub"},{" "}
                    {currentEvent.city || "Wilmington"}
                  </span>
                </div>
              </div>

              {/* CTA Button */}
              <Button
                size="lg"
                className="bg-gradient-primary hover:shadow-glow-primary transition-all text-lg px-8 py-6 rounded-full font-bold group shadow-2xl"
                onClick={(e) => handleEventClick(currentEvent.id, e)}
              >
                Get Tickets Now
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>

              {/* Slide Indicators */}
              {events.length > 1 && (
                <div className="flex gap-2 mt-8">
                  {events.map((event, index) => (
                    <button
                      key={event.id}
                      onClick={() => setCurrentIndex(index)}
                      className={`h-2 rounded-full transition-all ${
                        index === currentIndex
                          ? "bg-primary w-8 shadow-lg shadow-primary/50"
                          : "bg-white/40 w-2 hover:bg-white/60"
                      }`}
                      aria-label={`Go to ${event.name}`}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
