import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Ticket, Crown } from 'lucide-react';
import { type Event } from '@/lib/supabase';
import { getCheckoutUrlForEvent } from '@/lib/events-service';
import { cn } from '@/lib/utils';

interface HeroCarouselProps {
  events: Event[];
  getEventDateLabel: (event: Event) => string;
  getEventTimeLabel: (event: Event) => string;
}

// Color schemes for different event genres
const genreThemes: Record<string, { accent: string; badge: string; glow: string }> = {
  'Reggaeton': {
    accent: 'text-copper-400',
    badge: 'border-copper-400/30 text-copper-400 bg-copper-400/5',
    glow: 'shadow-[0_0_10px_rgba(94,234,212,0.8)]',
  },
  'Regional Mexican': {
    accent: 'text-bronze-400',
    badge: 'border-bronze-400/30 text-bronze-400 bg-bronze-400/5',
    glow: 'shadow-[0_0_10px_rgba(212,163,115,0.8)]',
  },
  'Cumbia': {
    accent: 'text-purple-400',
    badge: 'border-purple-400/30 text-purple-400 bg-purple-400/5',
    glow: 'shadow-[0_0_10px_rgba(192,132,252,0.8)]',
  },
  'Party': {
    accent: 'text-pink-400',
    badge: 'border-pink-400/30 text-pink-400 bg-pink-400/5',
    glow: 'shadow-[0_0_10px_rgba(244,114,182,0.8)]',
  },
  'default': {
    accent: 'text-copper-400',
    badge: 'border-copper-400/30 text-copper-400 bg-copper-400/5',
    glow: 'shadow-[0_0_10px_rgba(94,234,212,0.8)]',
  },
};

// Placeholder images for when there are no events
const placeholderImages = [
  {
    url: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=2940&auto=format&fit=crop',
    title: 'The Party Starts Here',
  },
  {
    url: 'https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=2940&auto=format&fit=crop',
    title: 'Unforgettable Nights',
  },
  {
    url: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?q=80&w=2940&auto=format&fit=crop',
    title: 'Where Memories Are Made',
  },
  {
    url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=2940&auto=format&fit=crop',
    title: 'Feel The Rhythm',
  },
];

export function HeroCarousel({ events, getEventDateLabel, getEventTimeLabel }: HeroCarouselProps) {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Show event slides if available, otherwise show placeholders
  const hasEvents = events.length > 0;
  const slides = hasEvents
    ? events.slice(0, 5).map(event => ({ type: 'event' as const, event }))
    : placeholderImages.map((placeholder, index) => ({ type: 'placeholder' as const, placeholder, index }));

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    // Resume autoplay after 10 seconds
    setTimeout(() => setIsAutoPlaying(true), 10000);
  }, []);

  // Auto-advance slides
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, slides.length]);

  const handleGetTickets = async (eventId: string) => {
    const checkoutUrl = await getCheckoutUrlForEvent(eventId);
    if (checkoutUrl) {
      navigate(checkoutUrl);
    }
  };

  const getTheme = (genre: string | null) => {
    return genreThemes[genre || ''] || genreThemes.default;
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-forest-950">
      {/* Slides */}
      {slides.map((slide, index) => {
        const isActive = index === currentSlide;

        // Placeholder slide
        if (slide.type === 'placeholder') {
          const placeholder = slide.placeholder!;
          return (
            <div
              key={`placeholder-${slide.index}`}
              className={cn(
                'carousel-slide',
                isActive && 'active-slide'
              )}
            >
              {/* Background Image */}
              <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-forest-950/60 z-10" />
                <img
                  src={placeholder.url}
                  alt={placeholder.title}
                  className="w-full h-full object-cover animate-slow-pan opacity-70 grayscale-[20%]"
                />
              </div>

              {/* Content */}
              <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-6 slide-content">
                {/* Badge */}
                <div className="inline-flex items-center gap-3 mb-8 px-4 py-2 border border-copper-400/30 rounded-full bg-forest-950/40 backdrop-blur-md opacity-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-copper-400 shadow-[0_0_10px_rgba(94,234,212,0.8)]" />
                  <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-copper-400">
                    Wilmington, Delaware
                  </span>
                </div>

                {/* Title */}
                <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-stone-100 tracking-tight leading-none mb-8 drop-shadow-2xl opacity-0">
                  {placeholder.title.split(' ').slice(0, -1).join(' ')}{' '}
                  <span className="italic font-light block mt-2 text-4xl md:text-6xl lg:text-7xl text-copper-400">
                    {placeholder.title.split(' ').slice(-1)[0]}
                  </span>
                </h1>

                {/* Description */}
                <p className="max-w-md mx-auto font-mono text-[10px] md:text-xs text-stone-400 leading-relaxed tracking-widest mt-8 border-t border-white/10 pt-8 uppercase opacity-0">
                  Maguey Nightclub
                  <br />
                  Events Coming Soon
                </p>

                {/* CTA Button */}
                <div className="flex flex-col sm:flex-row gap-4 mt-10 opacity-0">
                  <a
                    href="#events"
                    className="group flex items-center justify-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-copper-400/50 rounded-sm transition-all duration-500"
                  >
                    <Ticket className="w-4 h-4 text-copper-400" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-200 group-hover:text-copper-400 transition-colors">
                      Get Notified
                    </span>
                    <ArrowRight className="w-4 h-4 text-stone-500 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>
            </div>
          );
        }

        // Event slide
        const event = slide.event!;
        const theme = getTheme(event.genre);
        const hasVipTables = true; // You could check this from event data

        return (
          <div
            key={event.id}
            className={cn(
              'carousel-slide',
              isActive && 'active-slide'
            )}
          >
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 bg-forest-950/70 z-10" />
              <img
                src={event.flyer_url || event.image_url || 'https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=2940&auto=format&fit=crop'}
                alt={event.name}
                className="w-full h-full object-cover animate-slow-pan opacity-60 grayscale-[30%]"
              />
            </div>

            {/* Content */}
            <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-6 slide-content">
              {/* Date Badge */}
              <div className={cn(
                'inline-flex items-center gap-3 mb-8 px-4 py-2 border rounded-full bg-forest-950/40 backdrop-blur-md opacity-0',
                theme.badge
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full bg-current', theme.glow)} />
                <span className="font-mono text-[9px] tracking-[0.2em] uppercase">
                  {getEventDateLabel(event)} • {getEventTimeLabel(event)}
                </span>
              </div>

              {/* Event Name */}
              <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-stone-100 tracking-tight leading-none mb-8 drop-shadow-2xl opacity-0">
                {event.name.split(' ').map((word, i, arr) => (
                  <span key={i}>
                    {i === arr.length - 1 ? (
                      <span className={cn('italic font-light block mt-2 text-4xl md:text-6xl lg:text-7xl', theme.accent)}>
                        {word}
                      </span>
                    ) : (
                      <>{word} </>
                    )}
                  </span>
                ))}
              </h1>

              {/* Description */}
              <p className="max-w-md mx-auto font-mono text-[10px] md:text-xs text-stone-400 leading-relaxed tracking-widest mt-8 border-t border-white/10 pt-8 uppercase opacity-0">
                {event.venue_name || 'Maguey Delaware'}
                <br />
                {event.genre || 'Live Entertainment'}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mt-10 opacity-0">
                <button
                  onClick={() => handleGetTickets(event.id)}
                  className="group flex items-center justify-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-copper-400/50 rounded-sm transition-all duration-500"
                >
                  <Ticket className="w-4 h-4 text-copper-400" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-200 group-hover:text-copper-400 transition-colors">
                    Get Tickets
                  </span>
                  <ArrowRight className="w-4 h-4 text-stone-500 group-hover:translate-x-1 transition-transform" />
                </button>

                {hasVipTables && (
                  <Link
                    to={`/events/${event.id}/vip-tables`}
                    className="group flex items-center justify-center gap-3 px-8 py-4 bg-bronze-400/10 hover:bg-bronze-400/20 border border-bronze-400/30 hover:border-bronze-400/50 rounded-sm transition-all duration-500"
                  >
                    <Crown className="w-4 h-4 text-bronze-400" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-200 group-hover:text-bronze-400 transition-colors">
                      VIP Tables
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Navigation Dots */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 flex gap-3">
        {slides.map((slide, index) => {
          const theme = slide.event ? getTheme(slide.event.genre) : { accent: 'text-copper-400' };
          
          return (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                'h-1 rounded-full transition-all duration-500',
                index === currentSlide
                  ? cn('w-12', theme.accent.replace('text-', 'bg-'))
                  : 'w-8 bg-white/20 hover:bg-white/40'
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}

