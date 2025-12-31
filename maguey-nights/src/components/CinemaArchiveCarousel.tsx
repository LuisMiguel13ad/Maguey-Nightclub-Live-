import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { EventDisplay } from "@/services/eventService";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { getPurchaseEventUrl } from "@/lib/purchaseSiteConfig";

interface CinemaArchiveCarouselProps {
  events: EventDisplay[];
}

const DISTRESS_TEXTURE = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E`;

type FilterType = "ALL" | "THIS WEEK" | "NEXT WEEK" | "ALL MONTH" | "NEXT MONTH";

export function CinemaArchiveCarousel({ events }: CinemaArchiveCarouselProps) {
  const [filter, setFilter] = useState<FilterType>("THIS WEEK");
  // -1 indicates no card is active (all spines)
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [isPaused, setIsPaused] = useState(false);
  
  // Helper to parse YYYY-MM-DD as local date
  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const cleanDateStr = dateStr.split('T')[0];
    const [year, month, day] = cleanDateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Memoize filtered events to avoid recalculation on every render
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Use safe local date parsing
      const eventDate = parseDate(event.eventDate);
      eventDate.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (filter === "THIS WEEK") {
        // Next 7 days including today
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + 6);
        return eventDate >= today && eventDate <= endOfWeek;
      }
      
      if (filter === "NEXT WEEK") {
        // 7 days starting from next week
        const startOfNextWeek = new Date(today);
        startOfNextWeek.setDate(today.getDate() + 7);
        
        const endOfNextWeek = new Date(startOfNextWeek);
        endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
        
        return eventDate >= startOfNextWeek && eventDate <= endOfNextWeek;
      }

      if (filter === "ALL MONTH") {
        // Events in the current calendar month (upcoming)
        return eventDate >= today && 
               eventDate.getMonth() === today.getMonth() && 
               eventDate.getFullYear() === today.getFullYear();
      }
      
      if (filter === "NEXT MONTH") {
        const nextMonthDate = new Date(today);
        nextMonthDate.setMonth(today.getMonth() + 1);
        // Handle year wrap automatically by Date
        
        return eventDate.getMonth() === nextMonthDate.getMonth() && 
               eventDate.getFullYear() === nextMonthDate.getFullYear();
      }
      
      // "ALL" filter
      return true;
    });
  }, [events, filter]);

  // Handle filter change
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setActiveIndex(-1); // Reset to spine view on filter change
  };

  // Determine if we should marquee or just show static
  const shouldMarquee = filteredEvents.length > 4;

  // Marquee Logic
  const marqueeEvents = useMemo(() => {
    if (!shouldMarquee) return filteredEvents;
    
    // Ensure we have enough items for a smooth loop
    const items = [...filteredEvents];
    while (items.length < 10) {
      items.push(...filteredEvents);
    }
    // Add another set for the loop transition
    return [...items, ...items]; 
  }, [filteredEvents, shouldMarquee]);

  if (events.length === 0) return null;

  const displayEvents = shouldMarquee ? marqueeEvents : filteredEvents;
  const currentEvent = activeIndex >= 0 ? displayEvents[activeIndex % displayEvents.length] : displayEvents[0];
  
  // Render Filter Buttons Helper
  const FilterButton = ({ type, label }: { type: FilterType; label: string }) => (
    <button 
      onClick={() => handleFilterChange(type)}
      className={cn(
          "px-4 py-1.5 text-xs font-medium rounded shadow-sm transition-all whitespace-nowrap cursor-pointer hover:scale-105 active:scale-95 z-50 relative",
          filter === type ? "bg-zinc-100 text-zinc-950 scale-105" : "hover:bg-zinc-800 hover:text-white text-zinc-500"
      )}
    >
      {label}
    </button>
  );

  // Handle case where no events match filter
  if (filteredEvents.length === 0) {
      return (
        <div className="flex flex-col w-full min-h-screen bg-black overflow-hidden text-zinc-300 font-sans">
            {/* Filter Navigation */}
            <nav className="w-full flex justify-center py-8 z-30">
                <div className="flex flex-wrap justify-center items-center gap-1 bg-zinc-900/50 p-1 rounded-lg backdrop-blur-sm border border-zinc-800/50 max-w-full overflow-x-auto">
                  <FilterButton type="ALL" label="ALL" />
                  <FilterButton type="THIS WEEK" label="THIS WEEK" />
                  <FilterButton type="NEXT WEEK" label="NEXT WEEK" />
                  <FilterButton type="ALL MONTH" label="ALL MONTH" />
                  <FilterButton type="NEXT MONTH" label="NEXT MONTH" />
                </div>
            </nav>
            
            {/* Empty State */}
            <main className="flex-1 flex flex-col items-center justify-center opacity-50 min-h-[400px]">
                <p className="text-lg tracking-widest uppercase">NO EVENTS FOUND FOR {filter}</p>
                <button onClick={() => handleFilterChange("ALL")} className="mt-4 text-xs text-red-500 hover:text-red-400 tracking-widest underline cursor-pointer z-50">
                    VIEW ALL EVENTS
                </button>
            </main>
        </div>
      );
  }

  // Safe date parsing for display
  const eventDate = parseDate(currentEvent?.eventDate || new Date().toISOString());
  const year = eventDate.getFullYear();
  const formattedDate = eventDate.toLocaleDateString("en-US", { month: '2-digit', day: '2-digit', year: 'numeric' });
  const currentCleanTitle = currentEvent?.artist ? currentEvent.artist.split(' - ')[0] : '';
  // Generate purchase URL for current event
  const currentPurchaseUrl = currentEvent ? (currentEvent.purchaseUrl || getPurchaseEventUrl(currentEvent.id || currentEvent.eventId, currentEvent.artist)) : '';

  return (
    <div className="flex flex-col w-full min-h-screen bg-black overflow-hidden text-zinc-300 font-sans">
      {/* Filter Navigation */}
      <nav className="w-full flex justify-center py-8 z-30 relative">
        <div className="flex flex-wrap justify-center items-center gap-1 bg-zinc-900/80 p-1.5 rounded-lg backdrop-blur-md border border-zinc-800/50 pointer-events-auto max-w-full overflow-x-auto shadow-lg">
          <FilterButton type="ALL" label="ALL" />
          <FilterButton type="THIS WEEK" label="THIS WEEK" />
          <FilterButton type="NEXT WEEK" label="NEXT WEEK" />
          <FilterButton type="ALL MONTH" label="ALL MONTH" />
          <FilterButton type="NEXT MONTH" label="NEXT MONTH" />
        </div>
      </nav>

      {/* Carousel Container (Marquee or Static) */}
      <main className="flex-1 relative flex items-center justify-center w-full perspective-container py-10 z-10 overflow-hidden">
        <motion.div 
          className={cn(
            "flex items-center gap-6 px-12 perspective-dramatic",
            !shouldMarquee && "justify-center w-full"
          )}
          animate={shouldMarquee && activeIndex === -1 && !isPaused ? { x: ["0%", "-50%"] } : {}}
          transition={{ 
            repeat: Infinity, 
            ease: "linear", 
            duration: shouldMarquee ? displayEvents.length * 2 : 0 
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {displayEvents.map((event, index) => {
            const isActive = activeIndex === index;
            const eventDate = parseDate(event.eventDate);
            const formattedDate = eventDate.toLocaleDateString("en-US", { month: '2-digit', day: '2-digit', year: 'numeric' });
            const topDate = eventDate.toLocaleDateString("en-US", { month: 'long', day: 'numeric' }).toUpperCase();
            const cleanTitle = event.artist.split(' - ')[0];
            // Ensure purchaseUrl is always available, generate if missing
            const purchaseUrl = event.purchaseUrl || getPurchaseEventUrl(event.id || event.eventId, event.artist);

            return (
              <div
                key={`${event.id}-${index}`}
                onClick={(e) => {
                    // Don't toggle if clicking on interactive elements
                    const target = e.target as HTMLElement;
                    if (target.closest('a') || target.closest('button')) {
                      return; // Let the link/button handle the click
                    }
                    
                    if (isActive) {
                        setActiveIndex(-1); // Close if already active
                    } else {
                        setActiveIndex(index); // Open this specific one
                    }
                }}
                className={cn(
                  "relative cursor-pointer transition-all duration-500 ease-out group vhs-scene preserve-3d flex-shrink-0",
                  isActive
                    ? "w-[360px] h-[540px] z-20 mx-8 scale-100"
                    : "w-16 h-[480px] hover:w-20 opacity-60 hover:opacity-100 z-10 grayscale hover:grayscale-0"
                )}
                style={{ perspective: "1000px" }}
              >
                <div
                  className={cn(
                    "w-full h-full relative shadow-2xl transition-transform duration-500 transform-style-preserve-3d",
                    isActive && "translate-z-[20px]"
                  )}
                  style={{
                     transform: isActive ? "rotateY(0deg) translateZ(20px)" : "none"
                  }}
                >
                  {isActive ? (
                    /* Active Card (Face) */
                    <>
                      {/* Front Face */}
                      <div className="absolute inset-0 w-full h-full bg-zinc-900 overflow-hidden rounded-sm border-r border-white/10">
                        <img
                          src={event.image || "/placeholder.svg"}
                          className="w-full h-full object-cover opacity-90"
                          alt={cleanTitle}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 mix-blend-multiply" />

                        {/* Texture Overlay */}
                        <div
                          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-15"
                          style={{
                            backgroundImage: `url("${DISTRESS_TEXTURE}")`,
                          }}
                        />

                        {/* Box Content */}
                        <div className="absolute top-6 left-0 w-full text-center z-10 flex justify-center">
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-sm shadow-lg hover:border-red-500/50 transition-colors duration-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                            <span className="text-white text-xs font-bold tracking-[0.2em] uppercase drop-shadow-md">
                                {topDate}
                            </span>
                          </div>
                        </div>

                        <div className="absolute bottom-12 left-6 right-6 z-10">
                          <h3 className="text-3xl font-serif text-white leading-tight mb-3 drop-shadow-lg uppercase">
                            {cleanTitle}
                          </h3>
                        </div>

                      </div>

                      {/* 3D Spine Side (simulated) */}
                      <div
                        className="absolute top-0 bottom-0 -left-[20px] w-10 bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-4 overflow-hidden origin-right"
                        style={{
                          transform: "rotateY(-90deg) translateX(-20px)",
                        }}
                      >
                        {/* Active Spine Background Image Overlay */}
                        <div 
                            className="absolute inset-0 opacity-60" 
                            style={{ 
                                backgroundImage: `url(${event.image || "/placeholder.svg"})`, 
                                backgroundSize: 'cover', 
                                backgroundPosition: 'center' 
                            }} 
                        />
                        <div className="absolute inset-0 bg-black/70" />

                        <div className="relative z-10 flex-1 writing-mode-vertical text-xs tracking-[0.15em] text-white font-medium uppercase rotate-180 whitespace-nowrap flex items-center gap-4 drop-shadow-lg">
                          <span className="font-bold">{cleanTitle}</span>
                          <span className="opacity-90 text-[10px]">{formattedDate}</span>
                        </div>
                        <div className="relative z-10 mt-4 w-4 h-4 rounded-full bg-red-600/50" />
                      </div>
                    </>
                  ) : (
                    /* Inactive Spine View */
                    <div
                      className={cn(
                        "w-full h-full relative overflow-hidden border-l border-r border-white/5 shadow-lg flex flex-col items-center py-6 justify-between transition-colors bg-zinc-900"
                      )}
                    >
                      {/* Spine Background Image Overlay */}
                      <div 
                          className="absolute inset-0 opacity-60" 
                          style={{ 
                              backgroundImage: `url(${event.image || "/placeholder.svg"})`, 
                              backgroundSize: 'cover', 
                              backgroundPosition: 'center' 
                          }} 
                      />
                      <div className="absolute inset-0 bg-black/60" />

                      {/* Vertical Title */}
                      <div className="relative z-10 flex-1 flex items-center justify-center py-4 overflow-hidden">
                        <h4
                          className={cn(
                            "writing-mode-vertical text-sm font-medium tracking-widest uppercase whitespace-nowrap drop-shadow-lg rotate-180 flex items-center gap-3 text-white"
                          )}
                        >
                          <span className="font-semibold">{cleanTitle}</span>
                          <span className="text-[10px] opacity-90 font-mono">{formattedDate}</span>
                        </h4>
                      </div>

                      {/* Texture */}
                      <div
                        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30 z-20"
                        style={{
                          backgroundImage: `url("${DISTRESS_TEXTURE}")`,
                        }}
                      />

                      {/* Scuff Marks (CSS) */}
                      <div className="absolute top-20 left-0 w-full h-12 bg-black/20 blur-sm rotate-3 transform z-20" />
                      <div className="absolute bottom-32 left-0 w-full h-8 bg-white/5 blur-sm -rotate-6 transform z-20" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </motion.div>
      </main>

      {/* Info Footer */}
      <footer className="w-full pb-8 pt-4 z-30 relative bg-gradient-to-t from-black via-black/90 to-transparent">
        {/* Event Details - Only show if an event is selected */}
        <div className={cn(
            "text-center space-y-3 pointer-events-auto transition-all duration-300 mb-8",
            activeIndex === -1 ? "opacity-0" : "opacity-100"
        )}>
          {currentEvent?.category && (
             <p className="text-xs md:text-sm text-red-500 font-medium tracking-[0.2em] uppercase">
               {currentEvent.category}
             </p>
          )}
          <h2 className="text-4xl font-serif tracking-tight text-zinc-100 max-w-3xl mx-auto leading-tight">
            {currentCleanTitle || "Select an Event"}
          </h2>
          <div className="flex items-center justify-center gap-3 text-xs tracking-widest text-red-500/90 mb-6">
            <span>{currentEvent?.locationLine || "WILMINGTON"}</span>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span className="text-zinc-400">{year}</span>
          </div>
          
          {/* Buy Tickets Button */}
          {currentPurchaseUrl && (
            <a
              href={currentPurchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-black hover:bg-zinc-200 text-sm font-bold tracking-[0.2em] uppercase rounded transition-all group/btn cursor-pointer shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
            >
              <span className="mr-3">Buy Tickets</span>
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </a>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="w-full flex justify-between px-8 mt-4 text-[10px] tracking-widest text-zinc-600 uppercase pointer-events-auto border-t border-zinc-900/50 pt-6">
          <p>© Archive Rights Reserved.</p>
          <div className="flex gap-4">
            <span className="hover:text-zinc-400 cursor-pointer transition">
              FB
            </span>
            <span className="hover:text-zinc-400 cursor-pointer transition">
              TW
            </span>
            <span className="hover:text-zinc-400 cursor-pointer transition">
              IG
            </span>
          </div>
        </div>
      </footer>

      <style>{`
        .writing-mode-vertical {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .perspective-container {
          perspective: 1000px;
        }
        .perspective-dramatic {
          perspective: 500px;
        }
      `}</style>
    </div>
  );
}