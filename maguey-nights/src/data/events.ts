// Centralized event data - Single source of truth
export interface Event {
  id: string;
  artist: string;
  date: string;
  time: string;
  price: string;
  description: string;
  features: string[];
  venue: string;
  address: string;
  image: string;
  eventId: string;
}

export const events: Event[] = [
  {
    id: "1",
    artist: "REGGUETON FRIDAYS",
    date: "OCT 25 FRIDAY",
    time: "10:00 PM - 3:00 AM",
    price: "$30 - $60",
    description: "The hottest reggaeton night featuring the latest hits from Bad Bunny, Karol G, J Balvin, and more. Dance to the beats that define Latin urban culture.",
    features: ["Latest Reggaeton Hits", "VIP Tables Available", "Bottle Service", "21+ Only"],
    venue: "MAGUEY DELAWARE",
    address: "123 Main Street, Wilmington, DE 19801",
    image: "event-reggaeton.jpg",
    eventId: "reggaeton-fridays"
  },
  {
    id: "2",
    artist: "REGIONAL MEXICAN NIGHT",
    date: "OCT 26 SATURDAY",
    time: "9:00 PM - 2:00 AM",
    price: "$40 - $80",
    description: "Authentic regional Mexican music featuring banda, norteño, and mariachi. Experience the rich musical traditions of Mexico with live performances.",
    features: ["Live Banda Performance", "Traditional Instruments", "Authentic Mexican Culture", "21+ Only"],
    venue: "MAGUEY DELAWARE",
    address: "123 Main Street, Wilmington, DE 19801",
    image: "event-fiesta.jpg",
    eventId: "regional-mexican-night"
  },
  {
    id: "3",
    artist: "CUMBIAS SUNDAY",
    date: "OCT 27 SUNDAY",
    time: "8:00 PM - 1:00 AM",
    price: "$25 - $50",
    description: "Relaxed Sunday vibes with the best cumbia music. Dance to classic and modern cumbia hits in a more intimate setting.",
    features: ["Classic Cumbia Hits", "Live DJ Sets", "Dance Lessons", "All Ages Welcome"],
    venue: "MAGUEY DELAWARE",
    address: "123 Main Street, Wilmington, DE 19801",
    image: "venue-mainstage.jpg",
    eventId: "cumbias-sunday"
  },
  {
    id: "4",
    artist: "REGGUETON FRIDAYS",
    date: "NOV 1 FRIDAY",
    time: "10:00 PM - 3:00 AM",
    price: "$30 - $60",
    description: "The hottest reggaeton night featuring the latest hits from Bad Bunny, Karol G, J Balvin, and more. Dance to the beats that define Latin urban culture.",
    features: ["Latest Reggaeton Hits", "VIP Tables Available", "Bottle Service", "21+ Only"],
    venue: "MAGUEY DELAWARE",
    address: "123 Main Street, Wilmington, DE 19801",
    image: "event-reggaeton.jpg",
    eventId: "reggaeton-fridays-2"
  },
  {
    id: "5",
    artist: "REGIONAL MEXICAN NIGHT",
    date: "NOV 2 SATURDAY",
    time: "9:00 PM - 2:00 AM",
    price: "$40 - $80",
    description: "Authentic regional Mexican music featuring banda, norteño, and mariachi. Experience the rich musical traditions of Mexico with live performances.",
    features: ["Live Banda Performance", "Traditional Instruments", "Authentic Mexican Culture", "21+ Only"],
    venue: "MAGUEY DELAWARE",
    address: "123 Main Street, Wilmington, DE 19801",
    image: "event-fiesta.jpg",
    eventId: "regional-mexican-night-2"
  },
  {
    id: "6",
    artist: "CUMBIAS SUNDAY",
    date: "NOV 3 SUNDAY",
    time: "8:00 PM - 1:00 AM",
    price: "$25 - $50",
    description: "Relaxed Sunday vibes with the best cumbia music. Dance to classic and modern cumbia hits in a more intimate setting.",
    features: ["Classic Cumbia Hits", "Live DJ Sets", "Dance Lessons", "All Ages Welcome"],
    venue: "MAGUEY DELAWARE",
    address: "123 Main Street, Wilmington, DE 19801",
    image: "venue-patio.jpg",
    eventId: "cumbias-sunday-2"
  },
  {
    id: "7",
    artist: "REGGUETON FRIDAYS",
    date: "NOV 8 FRIDAY",
    time: "10:00 PM - 3:00 AM",
    price: "$30 - $60",
    description: "The hottest reggaeton night featuring the latest hits from Bad Bunny, Karol G, J Balvin, and more. Dance to the beats that define Latin urban culture.",
    features: ["Latest Reggaeton Hits", "VIP Tables Available", "Bottle Service", "21+ Only"],
    venue: "MAGUEY DELAWARE",
    address: "123 Main Street, Wilmington, DE 19801",
    image: "event-reggaeton.jpg",
    eventId: "reggaeton-fridays-3"
  },
  {
    id: "8",
    artist: "DIA DE MUERTOS CELEBRATION",
    date: "NOV 9 SATURDAY",
    time: "9:00 PM - 2:00 AM",
    price: "$50 - $100",
    description: "Celebrate Dia de Muertos with traditional Mexican music, cultural decorations, and authentic traditions. Honor your loved ones with beautiful music and cultural celebration.",
    features: ["Dia de Muertos Theme", "Cultural Decorations", "Traditional Music", "21+ Only"],
    venue: "MAGUEY DELAWARE",
    address: "123 Main Street, Wilmington, DE 19801",
    image: "social-2.jpg",
    eventId: "dia-de-muertos-celebration"
  }
];

// Helper functions
export const getEventById = (eventId: string): Event | undefined => {
  return events.find(event => event.eventId === eventId);
};

export const getUpcomingEvents = (limit?: number): Event[] => {
  const upcoming = events.slice(0, limit || events.length);
  return upcoming;
};

export const getEventsByType = (type: 'reggaeton' | 'mexican' | 'cumbia' | 'special'): Event[] => {
  return events.filter(event => {
    if (type === 'reggaeton') return event.artist.includes('REGGUETON');
    if (type === 'mexican') return event.artist.includes('MEXICAN');
    if (type === 'cumbia') return event.artist.includes('CUMBIAS');
    if (type === 'special') return !event.artist.includes('FRIDAYS') && !event.artist.includes('MEXICAN') && !event.artist.includes('CUMBIAS');
    return false;
  });
};
