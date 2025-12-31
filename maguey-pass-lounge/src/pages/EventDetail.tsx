import { useState, useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Calendar, MapPin, Music, Twitter, Facebook, Loader2, AlertCircle, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AuthButton } from "@/components/AuthButton";
import { getEventWithTicketsAndAvailability, type EventWithTickets, type EventAvailability } from "@/lib/events-service";
import { WaitlistForm } from "@/components/WaitlistForm";
import { VIPTableSection } from "@/components/VIPTableSection";

const EventDetail = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState<EventWithTickets | null>(null);
  const [availability, setAvailability] = useState<EventAvailability | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load event data
  useEffect(() => {
    if (eventId) {
      getEventWithTicketsAndAvailability(eventId)
        .then((data) => {
          if (data) {
            setEvent(data);
            setAvailability(data.availability || null);
          }
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching event:", error);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [eventId]);


  // Helper to get availability for a ticket type
  const getTicketAvailability = (ticketCode: string) => {
    if (!availability) return null;
    return availability.ticketTypes.find(t => t.ticketTypeCode === ticketCode);
  };

  // Check if event is completely sold out
  const isEventSoldOut = () => {
    if (!availability || !event?.ticketTypes) return false;
    const allSoldOut = event.ticketTypes.every(ticket => {
      const avail = getTicketAvailability(ticket.code);
      return avail ? avail.available <= 0 : false;
    });
    return allSoldOut && event.ticketTypes.length > 0;
  };

  const eventSoldOut = isEventSoldOut();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect if event not found
  if (!event) {
    return <Navigate to="/" replace />;
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return {
      day: days[date.getDay()],
      month: months[date.getMonth()],
      dayNum: date.getDate(),
    };
  };

  // Format date for VIP component (e.g., "Friday, December 26, 2025")
  const formatDateForVIP = (dateString: string) => {
    const date = new Date(dateString);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const dateInfo = formatDate(event.event_date);

  const getFormattedTime = (time: string) => {
    if (!time) return "";
    const [hourStr, minuteStr] = time.split(":");
    if (!hourStr || !minuteStr) return time;
    const date = new Date();
    date.setHours(Number(hourStr), Number(minuteStr));
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const eventImage = event.image_url || "/placeholder.svg";
  const venueName = event.venue_name || "Maguey Nightclub";
  const venueAddress = event.venue_address || "123 Nightlife Ave";
  const venueCity = event.city || "Wilmington, DE";

  const handleBuyTickets = (ticketId: string) => {
    const params = new URLSearchParams();
    if (eventId) {
      params.set("event", eventId);
    }
    params.set("ticket", ticketId);
    window.location.href = `/checkout?${params.toString()}`;
  };

  const getTicketDisplayName = (ticketName: string) => {
    // Format ticket names to match Wynn style
    if (ticketName.toLowerCase().includes('female')) {
      return 'FEMALE - GENERAL ADMISSION';
    }
    if (ticketName.toLowerCase().includes('male')) {
      return 'MALE - GENERAL ADMISSION';
    }
    if (ticketName.toLowerCase().includes('expedited')) {
      return 'EXPEDITED ENTRY ADMISSION';
    }
    // Removed VIP - GENERAL ADMISSION - we only want GA tickets + VIP table reservations
    return ticketName.toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <Music className="w-6 h-6 text-primary" />
              <span className="text-sm">← Back to Events</span>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Hero Section with Event Image */}
      <section className="relative h-[340px] md:h-[420px] lg:h-[500px] w-full overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={eventImage}
            alt={event.name}
            className="w-full h-full object-contain object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
        
        <div className="relative z-10 container mx-auto px-4 h-full flex flex-col justify-end pb-6">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3">
              {event.name.toUpperCase()}
            </h1>
            
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
              <div className="text-white text-base md:text-lg font-semibold tracking-wide">
                {dateInfo.day}, {dateInfo.month} {dateInfo.dayNum}
              </div>
              <div className="text-white text-sm md:text-base">
                Start Time @ {getFormattedTime(event.event_time)}
              </div>
            </div>

            <Badge className="bg-primary/90 text-white border-none px-3 py-1.5 text-xs md:text-sm mb-5">
              {venueName.toUpperCase()}
            </Badge>

            <div className="flex flex-wrap gap-3">
              <Button 
                className="bg-white text-background hover:bg-white/90 px-5 py-2.5 text-sm md:text-base"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('tickets')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                BUY TICKETS
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area - Two Column Layout */}
      <section id="tickets" className="py-12 bg-[#f5f5f0]">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-[1fr,400px] gap-8 max-w-7xl mx-auto">
            
            {/* Left Column - Ticket Selection */}
            <div className="bg-white/90 backdrop-blur-sm rounded-lg p-8" style={{
              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 14px, rgba(0,0,0,0.02) 14px, rgba(0,0,0,0.02) 28px)`
            }}>
              <h2 className="text-2xl font-bold text-foreground mb-6 tracking-wide">LOCATION TYPE</h2>

              {/* Group tickets by category */}
              {(() => {
                // Group tickets by category
                const groupedTickets = event.ticketTypes.reduce((acc, ticket) => {
                  const category = ticket.category || 'general';
                  if (!acc[category]) {
                    acc[category] = [];
                  }
                  acc[category].push(ticket);
                  return acc;
                }, {} as Record<string, typeof event.ticketTypes>);

                // Category display order and labels
                const categoryOrder: Array<{ key: string; label: string; badgeClass: string }> = [
                  { key: 'vip', label: 'VIP', badgeClass: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/50' },
                  { key: 'service', label: 'Service', badgeClass: 'bg-purple-500/20 text-purple-700 border-purple-500/50' },
                  { key: 'section', label: 'Sections', badgeClass: 'bg-blue-500/20 text-blue-700 border-blue-500/50' },
                  { key: 'general', label: 'General Admission', badgeClass: 'bg-gray-500/20 text-gray-700 border-gray-500/50' },
                ];

                return (
                  <div className="space-y-6">
                    {categoryOrder.map(({ key, label, badgeClass }) => {
                      const tickets = groupedTickets[key];
                      if (!tickets || tickets.length === 0) return null;
                      
                      // Filter out VIP ticket types - we only want GA tickets + VIP table reservations
                      const filteredTickets = tickets.filter(ticket => {
                        const nameLower = ticket.name.toLowerCase();
                        // Completely exclude VIP admission tickets
                        // Only show: Female, Male, Expedited, General Admission
                        const isVipTicket = nameLower.includes('vip') && !nameLower.includes('expedited');
                        return !isVipTicket;
                      });

                      if (filteredTickets.length === 0) {
                        return null;
                      }

                      // Sort tickets by display_order if available
                      const sortedTickets = [...filteredTickets].sort((a, b) => 
                        (a.display_order || 0) - (b.display_order || 0)
                      );

                      return (
                        <div key={key} className="space-y-3">
                          {key !== 'general' && (
                            <div className="flex items-center gap-3">
                              <Badge className={badgeClass}>
                                {label}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {sortedTickets.length} {sortedTickets.length === 1 ? 'option' : 'options'}
                              </span>
                            </div>
                          )}
              <div className="space-y-4">
                            {sortedTickets.map((ticket) => {
                  const totalPrice = (ticket.price + ticket.fee).toFixed(2);
                              const ticketAvail = getTicketAvailability(ticket.code);
                              const isSoldOut = ticketAvail ? ticketAvail.available <= 0 : false;
                              const isLowStock = ticketAvail ? ticketAvail.available > 0 && ticketAvail.available <= 5 : false;
                              
                  return (
                    <div
                      key={ticket.id}
                      className={`group relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-white to-gray-50/50 p-6 transition-all duration-300 hover:shadow-lg hover:border-border/60 ${isSoldOut ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex-1 space-y-3">
                          {/* Ticket Type Header */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              {key === 'general' && (
                                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                                  {label}
                                </div>
                              )}
                              <div className="text-xl font-bold text-foreground">
                                {getTicketDisplayName(ticket.name)}
                              </div>
                              {ticket.section_name && (
                                <Badge variant="outline" className="text-xs mt-1 border-border/60">
                                  {ticket.section_name}
                                </Badge>
                              )}
                            </div>
                            {isSoldOut && (
                              <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs font-medium">
                                Sold Out
                              </Badge>
                            )}
                          </div>

                          {/* Description */}
                          {ticket.section_description && (
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {ticket.section_description}
                            </p>
                          )}

                          {/* Price */}
                          <div className="pt-2">
                            <span className="text-3xl font-bold text-foreground">
                              ${totalPrice}
                            </span>
                          </div>
                        </div>

                        {/* Buy Button */}
                        <div className="flex items-center">
                          <Button
                            onClick={() => handleBuyTickets(ticket.id)}
                            disabled={isSoldOut}
                            className="bg-[#8B2635] hover:bg-[#7a1f2d] text-white px-8 py-6 text-sm font-semibold tracking-wider uppercase shadow-md hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {isSoldOut ? 'SOLD OUT' : 'BUY TICKETS'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* VIP Table Reservation CTA */}
              {event?.id && (
                <div className="mt-6 p-6 bg-gradient-to-r from-amber-900/30 to-yellow-900/30 border border-amber-500/30 rounded-xl">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <Wine className="w-5 h-5 text-amber-400" />
                      <h3 className="text-lg font-bold text-amber-400">VIP Bottle Service</h3>
                    </div>
                    <p className="text-gray-300 text-sm">
                      Reserve a premium table with bottle service for your group • Starting at $600
                    </p>
                    <Link 
                      to={`/events/${event.id}/vip-tables`}
                      className="w-full py-4 px-6 bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg rounded-lg transition-all shadow-lg hover:shadow-xl text-center"
                    >
                      Reserve Your Table
                    </Link>
                    <p className="text-amber-500/70 text-xs text-center">
                      ⚠️ Table reservation does not include event entry. All guests must purchase GA tickets.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Event Information */}
            {eventSoldOut && (
              <div className="col-span-full mb-6">
                <WaitlistForm
                  eventName={event.name}
                  ticketTypes={event.ticketTypes?.filter(t => !t.name.toLowerCase().includes('vip')).map(ticket => {
                    const avail = getTicketAvailability(ticket.code);
                    return {
                      id: ticket.id,
                      name: ticket.name,
                      isSoldOut: avail ? avail.available <= 0 : false,
                    };
                  })}
                  onSuccess={() => {
                    // Optionally refresh or show message
                  }}
                />
              </div>
            )}

            {/* VIP Table Reservations Section - Full width below ticket types */}
            {event?.id && (
              <div className="col-span-full">
                <VIPTableSection eventId={event.id} />
              </div>
            )}

            {/* Waitlist Form - Show if event is completely sold out */}
            {eventSoldOut && (
              <div className="col-span-full mb-6">
                <WaitlistForm
                  eventName={event.name}
                  ticketTypes={event.ticketTypes?.filter(t => !t.name.toLowerCase().includes('vip')).map(ticket => {
                    const avail = getTicketAvailability(ticket.code);
                    return {
                      id: ticket.id,
                      name: ticket.name,
                      isSoldOut: avail ? avail.available <= 0 : false,
                    };
                  })}
                  onSuccess={() => {
                    // Optionally refresh or show message
                  }}
                />
              </div>
            )}

            {/* Right Column - Event Information */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-8">
              {/* Event Poster */}
              <div className="mb-6">
                <div className="aspect-[3/4] relative overflow-hidden rounded-lg mb-4 bg-black/5">
                  <img
                    src={eventImage}
                    alt={event.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Age Restriction */}
              <div className="mb-6 pb-6 border-b border-border/30">
                <p className="text-sm text-foreground leading-relaxed">
                  ALL GUESTS MUST BE AT LEAST 21 YEARS OF AGE WITH A VALID GOVERNMENT ISSUED ID TO BE PRESENTED AT THE TIME OF CHECK-IN.
                </p>
              </div>

              {/* Social Sharing */}
              <div className="mb-6 pb-6 border-b border-border/30 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-foreground"
                  asChild
                >
                  <a 
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${event.name} - ${venueName}`)}&url=${encodeURIComponent(window.location.href)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Twitter className="w-4 h-4 mr-2" />
                    X Tweet
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-foreground"
                  asChild
                >
                  <a 
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Facebook className="w-4 h-4 mr-2" />
                    f Share
                  </a>
                </Button>
              </div>

              {/* Venue Location */}
              <div className="mb-6 pb-6 border-b border-border/30">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <div className="font-semibold text-foreground">{venueName}</div>
                    <div className="text-sm text-muted-foreground">{venueAddress}</div>
                    <div className="text-sm text-muted-foreground">{venueCity}</div>
                  </div>
                </div>
              </div>

              {/* Information Links */}
              <div className="space-y-2">
                <Link 
                  to="/policies" 
                  className="block text-[#8B2635] hover:underline text-sm font-medium"
                >
                  Frequently Asked Questions
                </Link>
                <Link 
                  to="/policies" 
                  className="block text-[#8B2635] hover:underline text-sm font-medium"
                >
                  Policies
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Event Description Section */}
      <section className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">About This Event</h2>
          <p className="text-muted-foreground leading-relaxed text-lg">
            {event.description}
          </p>
        </div>
      </section>
    </div>
  );
};

export default EventDetail;
