import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Loader2,
  Instagram,
  Facebook,
  RefreshCw,
  AlertCircle,
  Crown,
  ArrowRight,
  Music2,
  Mic2,
  Ghost,
  Ticket,
  Plus,
} from "lucide-react";
import { supabase, type Event } from "@/lib/supabase";
import { getCheckoutUrlForEvent } from "@/lib/events-service";
import { HeroCarousel } from "@/components/HeroCarousel";
import { CustomCursor } from "@/components/CustomCursor";
import { AuthButton } from "@/components/AuthButton";
import { cn } from "@/lib/utils";

const genreIcons: Record<string, React.ReactNode> = {
  Reggaeton: <Music2 className="w-5 h-5" />,
  "Regional Mexican": <Mic2 className="w-5 h-5" />,
  Cumbia: <Music2 className="w-5 h-5" />,
  Party: <Ghost className="w-5 h-5" />,
};

const genreColors: Record<string, { text: string; border: string; bg: string }> = {
  Reggaeton: {
    text: "text-copper-400",
    border: "border-copper-400/30 hover:border-copper-400/50",
    bg: "bg-copper-400/5",
  },
  "Regional Mexican": {
    text: "text-bronze-400",
    border: "border-bronze-400/30 hover:border-bronze-400/50",
    bg: "bg-bronze-400/5",
  },
  Cumbia: {
    text: "text-purple-400",
    border: "border-purple-400/30 hover:border-purple-400/50",
    bg: "bg-purple-400/5",
  },
  Party: {
    text: "text-pink-400",
    border: "border-pink-400/30 hover:border-pink-400/50",
    bg: "bg-pink-400/5",
  },
};

const Events = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const revealRefs = useRef<(HTMLElement | null)[]>([]);

  const handleEventClick = async (eventId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const checkoutUrl = await getCheckoutUrlForEvent(eventId);
    if (checkoutUrl) {
      navigate(checkoutUrl);
    }
  };

  const loadEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .eq("status", "published")
        .eq("is_active", true)
        .gte("event_date", today)
        .order("event_date", { ascending: true });

      if (eventsError) {
        setError(`Database error: ${eventsError.message}`);
        setEvents([]);
        return;
      }

      if (!eventsData || eventsData.length === 0) {
        setEvents([]);
        setError(null);
        return;
      }

      setEvents(eventsData);
      setError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to load events: ${errorMessage}`);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Intersection Observer for reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
          }
        });
      },
      { threshold: 0.1 }
    );

    revealRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [events]);

  const getGenreColors = (genre: string | null) => {
    return genreColors[genre || ""] || genreColors.Reggaeton;
  };

  const getEventDateLabel = (event: Event) => {
    try {
      const date = new Date(`${event.event_date}T${event.event_time}`);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return event.event_date;
    }
  };

  const getEventTimeLabel = (event: Event) => {
    if (!event.event_time) return "";
    const [hourStr, minuteStr] = event.event_time.split(":");
    if (!hourStr || !minuteStr) return event.event_time;
    const date = new Date();
    date.setHours(Number(hourStr), Number(minuteStr));
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-forest-950">
        <Loader2 className="w-8 h-8 animate-spin text-copper-400" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
          Initializing System...
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

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 px-6 md:px-10 py-8 flex justify-between items-center text-stone-300">
        {/* Logo */}
        <Link
          to="/"
          className="font-mono text-xs tracking-[0.2em] uppercase mix-blend-difference z-50 relative group"
        >
          MAGUEY <span className="text-copper-400">/</span> DE
        </Link>


        {/* Right Side */}
        <div className="flex items-center gap-4 md:gap-8 z-50">
          <button
            onClick={() => setTicketModalOpen(true)}
            className="group relative flex items-center gap-3 pl-1.5 pr-5 py-1.5 rounded-full border border-white/5 bg-forest-950/40 backdrop-blur-xl transition-all duration-500 hover:border-copper-400/30 hover:bg-forest-900/60"
          >
            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center border border-white/5 text-stone-400 group-hover:text-copper-400 group-hover:border-copper-400/30 transition-all duration-500">
              <Ticket className="w-3 h-3" />
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 group-hover:text-stone-200 transition-colors">
                Guest List
              </span>
              <span className="w-1 h-1 rounded-full bg-stone-600 group-hover:bg-copper-400 group-hover:shadow-[0_0_8px_rgba(94,234,212,0.8)] transition-all duration-500" />
            </div>
          </button>

          <AuthButton />
        </div>
      </nav>

      {/* Hero Carousel */}
      <header className="relative w-full h-screen overflow-hidden">
        <HeroCarousel
          events={events}
          getEventDateLabel={getEventDateLabel}
          getEventTimeLabel={getEventTimeLabel}
        />
      </header>

      <main>
        {/* Events Section */}
        <section
          id="events"
          className="relative py-32 md:py-48 overflow-hidden border-b border-white/5"
        >
          {/* Grid Background */}
          <div className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-[0.03] z-0">
            <svg width="100%" height="100%">
              <pattern
                id="grid"
                width="60"
                height="60"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 60 0 L 0 0 0 60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-copper-400"
                />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <div className="relative z-20 max-w-7xl mx-auto px-6">
            {/* Header */}
            <div
              ref={(el) => (revealRefs.current[0] = el)}
              className="reveal flex flex-col md:flex-row justify-between items-end mb-24"
            >
              <div>
                <h2 className="font-serif text-4xl md:text-5xl text-stone-100 mb-4 leading-tight">
                  Upcoming
                  <br />
                  <span className="italic text-copper-400">Events.</span>
                </h2>
                <p className="font-mono text-xs text-stone-500 leading-relaxed max-w-sm tracking-wide">
                  Your next unforgettable night awaits. Secure your spot at Wilmington's premier Latin nightclub.
                </p>
              </div>
              <button
                onClick={() => loadEvents()}
                disabled={isLoading}
                className="mt-8 md:mt-0 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-400 hover:text-copper-400 transition-colors flex items-center gap-2 group"
              >
                <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
                Refresh Events
              </button>
            </div>

            {/* Error State */}
            {error && (
              <div className="max-w-2xl mx-auto mb-16">
                <div className="glass-panel rounded-sm p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                  <h3 className="font-serif text-xl text-stone-100 mb-2">System Error</h3>
                  <p className="font-mono text-xs text-stone-500 mb-6">{error}</p>
                  <button
                    onClick={() => loadEvents()}
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-copper-400 hover:text-copper-500 transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            )}

            {/* Empty State */}
            {events.length === 0 && !error && (
              <div className="max-w-2xl mx-auto">
                <div className="glass-panel rounded-sm p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-copper-400/10 flex items-center justify-center mx-auto mb-6">
                    <Calendar className="w-8 h-8 text-copper-400" />
                  </div>
                  <h3 className="font-serif text-2xl text-stone-100 mb-4">
                    Frequencies Incoming
                  </h3>
                  <p className="font-mono text-xs text-stone-500 mb-8 max-w-md mx-auto">
                    New rituals are being calibrated. Join our network to receive
                    first-access notifications.
                  </p>
                  <button className="font-mono text-[10px] uppercase tracking-[0.2em] text-forest-950 bg-copper-400 hover:bg-copper-500 px-6 py-3 rounded-sm transition-colors">
                    Join Network
                  </button>
                </div>
              </div>
            )}

            {/* Event Cards Grid */}
            {events.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {events.map((event, index) => {
                  const colors = getGenreColors(event.genre);
                  const icon = genreIcons[event.genre || ""] || <Music2 className="w-5 h-5" />;

                  return (
                    <div
                      key={event.id}
                      ref={(el) => (revealRefs.current[index + 1] = el)}
                      className="reveal event-card group relative aspect-[4/5] rounded-sm overflow-hidden cursor-pointer"
                      style={{ transitionDelay: `${index * 0.1}s` }}
                      onClick={(e) => handleEventClick(event.id, e)}
                    >
                      {/* Image */}
                      <img
                        src={event.flyer_url || event.image_url || "https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=2940&auto=format&fit=crop"}
                        alt={event.name}
                        className="absolute inset-0 w-full h-full object-cover opacity-60"
                      />

                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/50 to-transparent" />

                      {/* Content */}
                      <div className="absolute bottom-0 left-0 w-full p-8 z-20">
                        {/* Date Badge */}
                        <div className="flex items-center gap-3 mb-4">
                          <span
                            className={cn(
                              "font-mono text-[9px] uppercase tracking-widest border px-2 py-1",
                              colors.text,
                              colors.border,
                              colors.bg
                            )}
                          >
                            {getEventDateLabel(event)}
                          </span>
                        </div>

                        {/* Event Name */}
                        <h3
                          className={cn(
                            "font-serif text-2xl text-stone-100 mb-2 transition-colors",
                            `group-hover:${colors.text}`
                          )}
                        >
                          {event.name}
                        </h3>

                        {/* Expanding Line */}
                        <div className="h-px w-12 bg-white/20 mb-4 line-expand" />

                        {/* Venue & Time */}
                        <p className="font-mono text-[10px] text-stone-400 uppercase tracking-widest">
                          {event.venue_name || "Maguey Delaware"} / {getEventTimeLabel(event)}
                        </p>
                      </div>

                      {/* Hover Icon */}
                      <div
                        className={cn(
                          "absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                          colors.text
                        )}
                      >
                        {icon}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* VIP Experience Section */}
        <section
          id="experience"
          ref={(el) => (revealRefs.current[events.length + 1] = el)}
          className="reveal max-w-7xl mx-auto px-6 py-32 md:py-48"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 h-auto md:h-[600px] border border-white/10">
            {/* Image Side */}
            <div className="relative h-[400px] md:h-full overflow-hidden group">
              <div className="absolute inset-0 bg-forest-950/20 group-hover:bg-transparent transition-colors duration-700 z-10" />
              <img
                src="https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=2940&auto=format&fit=crop"
                className="w-full h-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-105 saturate-0 contrast-125 group-hover:saturate-50"
                alt="VIP Experience"
              />
              <div className="absolute bottom-8 left-8 z-20">
                <span className="font-mono text-[10px] bg-white text-forest-950 px-3 py-1 uppercase tracking-widest">
                  Zone 01: VIP Section
                </span>
              </div>
            </div>

            {/* Content Side */}
            <div className="relative bg-forest-900/30 backdrop-blur-xl border-l border-white/10 p-12 lg:p-16 flex flex-col justify-center">
              {/* Grid Lines */}
              <div className="vip-grid-lines" />

              {/* Crown Icon */}
              <div className="absolute top-6 right-6">
                <Crown className="text-bronze-400 w-6 h-6 opacity-50 animate-pulse" />
              </div>

              <div className="relative z-10 space-y-8">
                <span className="font-mono text-[10px] text-bronze-400 tracking-[0.2em] uppercase border-b border-bronze-400/20 pb-2 inline-block">
                  VIP Experience
                </span>

                <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-stone-100 leading-none">
                  Reserve Your
                  <br />
                  <span className="italic text-copper-400">VIP Table.</span>
                </h2>

                <p className="font-mono text-xs text-stone-400 leading-relaxed border-l-2 border-bronze-400/30 pl-6">
                  Skip the line. Get bottle service, dedicated staff, and the best views 
                  in the house. Your night, your way.
                </p>

                {/* Stats */}
                <div className="pt-8 grid grid-cols-2 gap-px bg-white/10 border border-white/10">
                  <div className="bg-forest-900/80 p-6">
                    <span className="block font-serif text-2xl text-stone-200">20+</span>
                    <span className="block font-mono text-[9px] text-stone-500 uppercase mt-1 tracking-widest">
                      Premium Tables
                    </span>
                  </div>
                  <div className="bg-forest-900/80 p-6">
                    <span className="block font-serif text-2xl text-stone-200">100%</span>
                    <span className="block font-mono text-[9px] text-stone-500 uppercase mt-1 tracking-widest">
                      Dedicated Staff
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <Link
                  to="/vip-tables"
                  className="inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-bronze-400 hover:text-bronze-500 transition-colors group"
                >
                  Reserve Your Table
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-forest-900/20 relative z-20">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
            <div>
              <h4 className="font-serif text-2xl text-stone-200 mb-2">MAGUEY</h4>
              <p className="font-mono text-[9px] text-stone-500 uppercase tracking-[0.2em]">
                Wilmington, Delaware
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-8 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-400">
              <a href="#" className="hover:text-copper-400 transition-colors">
                Manifesto
              </a>
              <a href="#" className="hover:text-copper-400 transition-colors">
                Private Events
              </a>
              <a href="#" className="hover:text-copper-400 transition-colors">
                Contact
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 border-t border-white/5 pt-12">
            <div className="space-y-2">
              <span className="block font-mono text-[9px] text-stone-600 uppercase tracking-widest mb-4">
                Location
              </span>
              <p className="font-serif text-stone-300">
                3320 Old Capitol Trail
                <br />
                Wilmington, DE 19808
              </p>
            </div>
            <div className="space-y-2">
              <span className="block font-mono text-[9px] text-stone-600 uppercase tracking-widest mb-4">
                Contact
              </span>
              <p className="font-serif text-stone-300">
                <a href="tel:3026602669" className="hover:text-copper-400 transition-colors">
                  (302) 660-2669
                </a>
                <br />
                <a
                  href="mailto:info@elmagueydelaware.com"
                  className="hover:text-copper-400 transition-colors"
                >
                  info@elmagueydelaware.com
                </a>
              </p>
            </div>
            <div className="space-y-2">
              <span className="block font-mono text-[9px] text-stone-600 uppercase tracking-widest mb-4">
                Social
              </span>
              <div className="flex gap-4">
                <a
                  href="https://instagram.com/magueynightclub"
                  target="_blank"
                  rel="noreferrer"
                  className="text-stone-400 hover:text-copper-400 transition-colors"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="https://facebook.com/magueynightclub"
                  target="_blank"
                  rel="noreferrer"
                  className="text-stone-400 hover:text-copper-400 transition-colors"
                >
                  <Facebook className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-white/5 pt-8 font-mono text-[9px] text-stone-600 uppercase tracking-widest">
            <div>© {new Date().getFullYear()} Maguey Nightclub</div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-copper-400 animate-pulse" />
              System Operational
            </div>
          </div>
        </div>
      </footer>

      {/* Ticket Modal */}
      {ticketModalOpen && (
        <div
          className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 transition-all duration-500",
            ticketModalOpen ? "modal-visible" : "modal-hidden"
          )}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-forest-950/90 backdrop-blur-3xl"
            onClick={() => setTicketModalOpen(false)}
          />

          {/* Modal Content */}
          <div
            className={cn(
              "relative z-[110] w-full max-w-5xl glass-panel rounded-sm overflow-hidden border border-white/10 shadow-2xl shadow-black/50 transition-transform duration-600",
              ticketModalOpen ? "modal-content-visible" : "modal-content-hidden"
            )}
          >
            {/* Close Button */}
            <button
              onClick={() => setTicketModalOpen(false)}
              className="absolute top-6 right-6 text-stone-500 hover:text-white transition-colors z-50"
            >
              <Plus className="w-6 h-6 rotate-45" />
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 h-auto lg:h-[600px]">
              {/* Left Side - Login */}
              <div className="p-10 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/5 bg-gradient-to-br from-white/5 to-transparent">
                <div>
                  <div className="flex items-center gap-3 mb-10 opacity-60">
                    <Ticket className="w-4 h-4 text-copper-400" />
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-stone-400">
                      Guest List Access
                    </span>
                  </div>

                  <h2 className="font-serif text-3xl text-stone-100 mb-2">Secure Entry</h2>
                  <p className="font-mono text-xs text-stone-500 mb-12 tracking-wide">
                    Enter your credentials to manage reservations.
                  </p>

                  <div className="space-y-8">
                    <Link
                      to="/login"
                      className="block w-full group flex items-center justify-between bg-stone-100/5 hover:bg-stone-100/10 border border-white/10 rounded-sm px-6 py-4 transition-all duration-300"
                    >
                      <span className="font-mono text-[10px] text-stone-300 uppercase tracking-[0.2em] group-hover:text-copper-400 transition-colors">
                        Sign In
                      </span>
                      <ArrowRight className="w-4 h-4 text-stone-500 group-hover:translate-x-1 transition-transform" />
                    </Link>

                    <Link
                      to="/signup"
                      className="block w-full group flex items-center justify-between bg-stone-100/5 hover:bg-stone-100/10 border border-white/10 rounded-sm px-6 py-4 transition-all duration-300"
                    >
                      <span className="font-mono text-[10px] text-stone-300 uppercase tracking-[0.2em] group-hover:text-copper-400 transition-colors">
                        Create Account
                      </span>
                      <ArrowRight className="w-4 h-4 text-stone-500 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>

                <div className="mt-12 lg:mt-0 font-mono text-[9px] text-stone-600 flex items-center gap-2 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-copper-400 animate-pulse" />
                  Secure Connection
                </div>
              </div>

              {/* Right Side - Actions */}
              <div className="p-10 lg:p-16 flex flex-col justify-center relative overflow-hidden">
                {/* Grid Background */}
                <div className="absolute inset-0 z-0 opacity-[0.05] pointer-events-none">
                  <svg width="100%" height="100%">
                    <pattern
                      id="modal-grid"
                      width="40"
                      height="40"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 40 0 L 0 0 0 40"
                        fill="none"
                        stroke="white"
                        strokeWidth="0.5"
                      />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#modal-grid)" />
                  </svg>
                </div>

                <div className="relative z-10">
                  <div className="mb-10 inline-block px-3 py-1 rounded-full border border-bronze-400/30 bg-bronze-500/5">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-bronze-400">
                      Tables Available
                    </span>
                  </div>

                  <h2 className="font-serif text-3xl text-stone-100 mb-6">
                    Initiate Reservation
                  </h2>

                  <p className="font-mono text-[10px] leading-loose text-stone-400 mb-10 border-l border-white/10 pl-4 tracking-wide">
                    Capacity is strictly limited by venue biological constraints. We accept
                    table requests on a rolling basis.
                  </p>

                  <div className="space-y-4">
                    <Link
                      to="/vip-tables"
                      className="block w-full py-4 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-bronze-400/50 transition-all text-left px-6 group"
                      onClick={() => setTicketModalOpen(false)}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-stone-300">
                          Reserve VIP Table
                        </span>
                        <Plus className="text-bronze-400 w-4 h-4" />
                      </div>
                    </Link>

                    {events.length > 0 && (
                      <button
                        onClick={() => {
                          setTicketModalOpen(false);
                          handleEventClick(events[0].id, { preventDefault: () => {} } as React.MouseEvent);
                        }}
                        className="w-full py-4 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-copper-400/50 transition-all text-left px-6 group"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-stone-300">
                            General Admission
                          </span>
                          <Plus className="text-copper-400 w-4 h-4" />
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
