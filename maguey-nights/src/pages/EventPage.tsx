import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MapPin, Info, ShoppingCart, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { fetchEventById, fetchEventAvailability, type EventDisplay, type EventAvailability } from "@/services/eventService";
import { getPurchaseEventUrl } from "@/lib/purchaseSiteConfig";

const EventPage = () => {
  const { eventId } = useParams();
  const [activeTab, setActiveTab] = useState("tickets");
  const [selectedTables, setSelectedTables] = useState<{[key: string]: number}>({});
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    partySize: "",
    comments: ""
  });
  const [event, setEvent] = useState<EventDisplay | null>(null);
  const [availability, setAvailability] = useState<EventAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch event from database
  useEffect(() => {
    if (!eventId) {
      setError("Event ID is required");
      setLoading(false);
      return;
    }

    const loadEvent = async () => {
      try {
        setLoading(true);
        setError(null);
        const eventData = await fetchEventById(eventId);
        if (!eventData) {
          setError("Event not found");
          return;
        }
        setEvent(eventData);

        // Fetch availability
        const avail = await fetchEventAvailability(eventData.artist);
        if (avail) {
          setAvailability(avail);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event");
        console.error("Error loading event:", err);
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  // Optimized motion variants for better performance
  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  };

  // VIP Table options
  const vipTables = [
    {
      id: "owners-table",
      name: "Owner's Table",
      description: "Our Owner's Tables are the crown jewels of the main room. They offer the most exceptional & direct views of the DJ and Stage. These U-shaped booths are the most premium inside tables and can accommodate up to 15 guests.",
      fbMinimum: 18000,
      payNow: 3610,
      maxGuests: 15
    },
    {
      id: "small-stage",
      name: "Small Stage",
      description: "Small Stage tables offer exclusive access to the backstage area and surround the DJ Booth; they can accommodate 6 guests.",
      fbMinimum: 12000,
      payNow: 2410,
      maxGuests: 6
    },
    {
      id: "lower-dance-floor",
      name: "Lower Dance Floor",
      description: "Lower Dance Floor tables are located directly on dance floor. These U-shaped booths offer direct views of the DJ and Dance Floor; they are closest to the action and can accommodate up to 12 guests.",
      fbMinimum: 12000,
      payNow: 2410,
      maxGuests: 12
    },
    {
      id: "upper-dance-floor",
      name: "Upper Dance Floor",
      description: "Upper Dance Floor tables are elevated U-shaped booths with the best inside views of the DJ and Dance Floor. They can accommodate up to 12 guests.",
      fbMinimum: 12000,
      payNow: 2410,
      maxGuests: 12
    },
    {
      id: "premium-section",
      name: "Premium Section Outside",
      description: "Premium Sections Outside are our best Poolside Section tables with the best views of the DJ. They are large L-shaped couches which can accommodate 12 guests.",
      fbMinimum: 6000,
      payNow: 1210,
      maxGuests: 12
    },
    {
      id: "large-side-stage",
      name: "Large Side Stage Patio",
      description: "Large Side Stage tables are exclusive access tables with amazing views of the DJ and are located in the VIP backstage area; they can accommodate up to 10 guests.",
      fbMinimum: 6000,
      payNow: 1210,
      maxGuests: 10
    },
    {
      id: "third-tier",
      name: "3rd Tier Section",
      description: "3rd Tier Sections are U-shaped booths which can accommodate up to 8 guests.",
      fbMinimum: 5000,
      payNow: 1010,
      maxGuests: 8
    },
    {
      id: "platform-section",
      name: "Platform Section",
      description: "Platform Sections are large L-shaped couches located on the outside platform/outside dance floor with direct views of the DJ. 15 guests can be accommodated.",
      fbMinimum: 4000,
      payNow: 810,
      maxGuests: 15
    },
    {
      id: "back-wall",
      name: "Back Wall",
      description: "Back Wall booths are slightly elevated U-shaped booths which can accommodate up to 6 guests.",
      fbMinimum: 3500,
      payNow: 710,
      maxGuests: 6
    },
    {
      id: "small-side-stage",
      name: "Small Side Stage Patio",
      description: "Small Side Stage tables are exclusive access tables with amazing views of the DJ and are located in the VIP backstage area; they can accommodate up to 6 guests.",
      fbMinimum: 3000,
      payNow: 610,
      maxGuests: 6
    },
    {
      id: "poolside-section",
      name: "Poolside Section",
      description: "Poolside Sections are large L-shaped couches which can accommodate 12 guests.",
      fbMinimum: 2500,
      payNow: 510,
      maxGuests: 12
    },
    {
      id: "four-top",
      name: "4 Top Table",
      description: "4 Tops are our smaller, more intimate tables located throughout the main room. They can accommodate up to 4 guests.",
      fbMinimum: 2000,
      payNow: 410,
      maxGuests: 4
    },
    {
      id: "best-available",
      name: "Best Available",
      description: "Best Available tables are our entry level option for Bottle Service Reservations; these include a table with no specific location requested. The table location will be assigned upon arrival.",
      fbMinimum: 1500,
      payNow: 310,
      maxGuests: 6
    }
  ];

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <Navigation />
        <Loader2 className="w-8 h-8 animate-spin text-[#39B54A] mb-4" />
        <p className="text-lg">Loading event...</p>
        <Footer />
      </div>
    );
  }

  // Show error state
  if (error || !event) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <Navigation />
        <h1 className="text-4xl font-bold mb-4">Event Not Found</h1>
        <p className="text-lg">{error || "The event you are looking for does not exist."}</p>
        <a href="/upcoming-events" className="mt-6 text-[#39B54A] hover:underline">
          Back to Events
        </a>
        <Footer />
      </div>
    );
  }

  // Calculate availability stats
  const totalAvailable = availability?.ticketTypes.reduce((sum, tt) => sum + tt.available, 0) || 0;
  const isSoldOut = totalAvailable === 0;
  const purchaseUrl = getPurchaseEventUrl(eventId, event?.artist);

  const handleTableSelection = (tableId: string, guests: number) => {
    setSelectedTables(prev => ({
      ...prev,
      [tableId]: guests
    }));
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
  };

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      {/* Hero Section */}
      <section className="relative h-96 w-full overflow-hidden bg-black">
        {/* Event background image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${event.image})`,
            backgroundPosition: 'center center',
            backgroundSize: 'cover'
          }}
        >
          <div className="absolute inset-0 bg-black/70"></div>
        </div>
        
        {/* Availability Badge */}
        {availability && (
          <div className="absolute top-4 right-4 z-20">
            {isSoldOut ? (
              <Badge className="bg-red-500/90 text-white border-red-600 shadow-lg text-lg px-4 py-2">
                SOLD OUT
              </Badge>
            ) : totalAvailable <= 10 ? (
              <Badge className="bg-orange-500/90 text-white border-orange-600 shadow-lg text-lg px-4 py-2">
                Only {totalAvailable} left!
              </Badge>
            ) : (
              <Badge className="bg-green-500/90 text-white border-green-600 shadow-lg text-lg px-4 py-2">
                Tickets Available
              </Badge>
            )}
          </div>
        )}
        
        {/* Event details overlay */}
        <div className="relative z-10 h-full flex items-end pb-8 pl-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-white"
          >
            <h1 className="text-6xl md:text-8xl font-black tracking-wider mb-2 drop-shadow-[0_0_30px_rgba(255,0,180,0.25)]">
              {event.artist}
            </h1>
            <p className="text-xl md:text-2xl font-semibold tracking-wide drop-shadow-lg text-white/90">
              {event.date}
            </p>
            <p className="text-lg md:text-xl font-medium tracking-wide drop-shadow-lg text-white/80">
              Start Time @ {event.time}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="inline-block bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                {event.venue}
              </span>
              {availability && availability.ticketTypes.length > 0 && (
                <a href={purchaseUrl} target="_blank" rel="noopener noreferrer">
                  <Button 
                    className="bg-[#39B54A] hover:bg-[#39B54A]/90 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSoldOut}
                  >
                    {isSoldOut ? 'SOLD OUT' : 'BUY TICKETS'}
                  </Button>
                </a>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <section className="bg-black border-b border-white/10">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="flex space-x-8"
          >
            <button
              onClick={() => setActiveTab("tickets")}
              className={`py-4 px-2 border-b-2 font-semibold text-sm tracking-wide transition-all duration-300 ${
                activeTab === "tickets" 
                  ? "border-[#39B54A] text-[#39B54A]" 
                  : "border-transparent text-white/60 hover:text-white hover:border-white/30"
              }`}
            >
              BUY TICKETS
            </button>
            <button
              onClick={() => setActiveTab("seating")}
              className={`py-4 px-2 border-b-2 font-semibold text-sm tracking-wide transition-all duration-300 ${
                activeTab === "seating" 
                  ? "border-[#39B54A] text-[#39B54A]" 
                  : "border-transparent text-white/60 hover:text-white hover:border-white/30"
              }`}
            >
              SEATING
            </button>
            <button
              onClick={() => setActiveTab("reservations")}
              className={`py-4 px-2 border-b-2 font-semibold text-sm tracking-wide transition-all duration-300 ${
                activeTab === "reservations" 
                  ? "border-[#39B54A] text-[#39B54A]" 
                  : "border-transparent text-white/60 hover:text-white hover:border-white/30"
              }`}
            >
              RESERVATIONS
            </button>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8 px-4 bg-black">
        <div className="container mx-auto max-w-7xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            
            {/* Left Column - Booking Options */}
            <div className="space-y-6">
              {activeTab === "tickets" && (
                <div className="bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl p-6">
                  <h3 className="text-xl font-black text-white mb-4 tracking-wider">LOCATION TYPE</h3>
                  {availability && availability.ticketTypes.length > 0 ? (
                    <div className="space-y-4">
                      {availability.ticketTypes.map((ticketType) => {
                        const isTicketSoldOut = ticketType.available <= 0;
                        const isLowStock = ticketType.available > 0 && ticketType.available <= 5;
                        return (
                          <div 
                            key={ticketType.ticketTypeCode}
                            className={`flex items-center justify-between bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 ${isTicketSoldOut ? 'opacity-60' : ''}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-white font-semibold">{ticketType.ticketTypeCode}</h4>
                                {isTicketSoldOut ? (
                                  <Badge className="bg-red-500/20 text-red-300 border-red-500/50 text-xs">
                                    SOLD OUT
                                  </Badge>
                                ) : isLowStock ? (
                                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/50 text-xs">
                                    {ticketType.available} left
                                  </Badge>
                                ) : (
                                  <Badge className="bg-green-500/20 text-green-300 border-green-500/50 text-xs">
                                    {ticketType.available} available
                                  </Badge>
                                )}
                              </div>
                              <p className="text-white/60 text-sm">
                                {ticketType.sold} of {ticketType.total} sold
                              </p>
                            </div>
                            <a href={purchaseUrl} target="_blank" rel="noopener noreferrer">
                              <Button 
                                className="group bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/15 font-semibold rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.25)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isTicketSoldOut}
                              >
                                <span className="relative">
                                  {isTicketSoldOut ? 'SOLD OUT' : 'BUY TICKETS'}
                                  <span className="absolute -inset-1 -z-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow" />
                                </span>
                              </Button>
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-white/60 mb-4">Ticket information not available</p>
                      <a href={purchaseUrl} target="_blank" rel="noopener noreferrer">
                        <Button className="bg-[#39B54A] hover:bg-[#39B54A]/90 text-white">
                          View on Purchase Site
                        </Button>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "seating" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-white tracking-wider">3D VIP TABLE MAP</h3>
                    <Button className="group bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/15 font-semibold rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.25)] transition-all duration-300">
                      <span className="relative">
                        3D VIP TABLE MAP
                        <span className="absolute -inset-1 -z-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow" />
                      </span>
                    </Button>
                  </div>
                  
                  <p className="text-white/60 text-sm">
                    Please Select Guests Number on an Item and then click on the Checkout button at the bottom
                  </p>

                  <div className="space-y-4">
                    {vipTables.map((table) => (
                      <div key={table.id} className="bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="text-white font-bold text-lg">{table.name}</h4>
                            <p className="text-white/70 text-sm mt-1">{table.description}</p>
                          </div>
                          <button className="text-blue-400 hover:text-blue-300 ml-4">
                            <Info className="w-5 h-5" />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-white">
                            <p className="text-sm text-white/60">F&B Minimum*</p>
                            <p className="text-lg font-bold">${table.fbMinimum.toLocaleString()}.00</p>
                            <p className="text-sm text-white/60">Pay Now</p>
                            <p className="text-lg font-bold text-[#39B54A]">${table.payNow.toLocaleString()}.00</p>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="text-center">
                              <label className="text-white text-sm block mb-1">Guests</label>
                              <select 
                                className="bg-white/10 backdrop-blur-md text-white rounded-2xl px-3 py-2 border border-white/20"
                                value={selectedTables[table.id] || 0}
                                onChange={(e) => handleTableSelection(table.id, parseInt(e.target.value))}
                              >
                                {Array.from({length: table.maxGuests + 1}, (_, i) => (
                                  <option key={i} value={i}>{i}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h4 className="text-white font-bold mb-4">PROMO CODE</h4>
                    <div className="flex space-x-4">
                      <Input 
                        placeholder="HAVE A PROMO CODE?" 
                        className="bg-white/10 backdrop-blur-md text-white border-white/20 rounded-2xl"
                      />
                      <Button className="bg-[#39B54A] hover:bg-[#39B54A]/90 text-white font-bold">
                        APPLY
                      </Button>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <Button className="w-full bg-[#39B54A] hover:bg-[#39B54A]/90 text-white font-bold text-lg py-4">
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      CHECKOUT
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "reservations" && (
                <div className="bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl p-6">
                  <h3 className="text-2xl font-black text-white mb-4 tracking-wider">Bottle Service Inquiry</h3>
                  <p className="text-white/70 mb-6">
                    Fill this form to request a reservation – Asterisks (*) indicate required fields.
                  </p>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-white text-sm block mb-2">First Name *</label>
                        <Input
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleFormChange}
                          className="bg-white/10 backdrop-blur-md text-white border-white/20 rounded-2xl"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-white text-sm block mb-2">Last Name *</label>
                        <Input
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleFormChange}
                          className="bg-white/10 backdrop-blur-md text-white border-white/20 rounded-2xl"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-white text-sm block mb-2">Email *</label>
                      <Input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleFormChange}
                        className="bg-white/10 backdrop-blur-md text-white border-white/20 rounded-2xl"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="text-white text-sm block mb-2">Phone *</label>
                      <Input
                        name="phone"
                        value={formData.phone}
                        onChange={handleFormChange}
                        className="bg-white/10 backdrop-blur-md text-white border-white/20 rounded-2xl"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="text-white text-sm block mb-2">Party Size *</label>
                      <Input
                        name="partySize"
                        value={formData.partySize}
                        onChange={handleFormChange}
                        className="bg-white/10 backdrop-blur-md text-white border-white/20 rounded-2xl"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="text-white text-sm block mb-2">Comments</label>
                      <Textarea
                        name="comments"
                        value={formData.comments}
                        onChange={handleFormChange}
                        placeholder="Special Instructions, comments, etc."
                        className="bg-white/10 backdrop-blur-md text-white border-white/20 rounded-2xl"
                        rows={4}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="newsletter" className="rounded" />
                      <label htmlFor="newsletter" className="text-white/70 text-sm">
                        I would like to sign up for Maguey Newsletter. Learn more about Maguey Privacy Policy here.
                      </label>
                    </div>
                    
                    <Button 
                      type="submit"
                      className="w-full group bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/15 font-semibold text-lg py-4 rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.25)] transition-all duration-300"
                    >
                      <span className="relative">
                        SUBMIT REQUEST
                        <span className="absolute -inset-1 -z-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow" />
                      </span>
                    </Button>
                  </form>
                </div>
              )}
            </div>

            {/* Right Column - Event Details */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.6 }}
              className="space-y-6"
            >
              <div className="relative bg-black/10 rounded-lg">
                <img
                  src={event.image}
                  alt={event.artist}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-96 object-contain rounded-lg"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent rounded-lg"></div>
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="text-2xl font-bold">{event.artist}</h3>
                  <p className="text-lg">{event.date}</p>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-6">
                {event.description && (
                  <p className="text-gray-300 text-sm mb-4">
                    {event.description}
                  </p>
                )}
                <p className="text-gray-300 text-sm mb-4">
                  ALL GUESTS MUST BE AT LEAST 21 YEARS OF AGE WITH A VALID GOVERNMENT ISSUED ID TO BE PRESENTED AT THE TIME OF CHECK-IN.
                </p>
                
                <div className="flex space-x-4 mb-4">
                  <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                    Tweet
                  </Button>
                  <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                    Share
                  </Button>
                </div>
                
                <div className="flex items-center space-x-2 text-gray-300 mb-4">
                  <MapPin className="w-4 h-4" />
                  <span>{event.venue}</span>
                </div>
                <p className="text-gray-400 text-sm mb-4">{event.address}</p>
                
                <div className="space-y-2">
                  <a href="#" className="text-blue-400 hover:text-blue-300 text-sm block">
                    Frequently Asked Questions
                  </a>
                  <a href="#" className="text-blue-400 hover:text-blue-300 text-sm block">
                    Policies
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default EventPage;