/**
 * Events Data
 * Centralized event data used across the application
 */

export interface Event {
  id: string;
  name: string;
  date: string;
  time: string;
  genre: string;
  image: string;
  venue: string;
  city: string;
  address: string;
  description: string;
  tickets: Array<{
    id: string;
    name: string;
    price: number;
    fee: number;
    description: string;
    limit: number;
  }>;
  tables: Array<{
    id: string;
    name: string;
    capacity: string;
    minimum: number;
    perks: string[];
  }>;
}

export const mockEvents: Event[] = [
  {
    id: "1",
    name: "Reggaeton Nights",
    date: "2025-11-14",
    time: "10:00 PM",
    genre: "Reggaeton",
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=1200&fit=crop",
    venue: "Maguey Nightclub",
    city: "Wilmington, DE",
    address: "123 Main St, Wilmington, DE 19801",
    description: "The hottest Reggaeton beats with special guest DJs. Experience an unforgettable night of music, dancing, and premium bottle service.",
    tickets: [
      { id: "ga", name: "Male General Admission", price: 25, fee: 5, description: "Includes Fees & Taxes", limit: 10 },
      { id: "female-ga", name: "Female GA", price: 20, fee: 4, description: "Includes Fees & Taxes", limit: 10 },
      { id: "vip", name: "VIP Entry", price: 50, fee: 8, description: "Includes Fees & Taxes • Priority Entry", limit: 5 },
      { id: "expedited", name: "Expedited Entry", price: 40, fee: 6, description: "Includes Fees & Taxes • Skip the Line", limit: 10 },
    ],
    tables: [
      {
        id: "standard",
        name: "Standard Table",
        capacity: "4-6 Guests",
        minimum: 350,
        perks: ["Dedicated Table", "Reserved Seating"],
      },
      {
        id: "premium",
        name: "Premium Table",
        capacity: "8 Guests",
        minimum: 750,
        perks: ["Dedicated Server", "Premium Location", "Bottle Service"],
      },
      {
        id: "owners",
        name: "Owner's Table",
        capacity: "10+ Guests",
        minimum: 1500,
        perks: ["Ultimate VIP", "Best Location", "Complimentary Starters", "Priority Service"],
      },
    ],
  },
  {
    id: "2",
    name: "Cumbia Fest",
    date: "2025-11-15",
    time: "9:00 PM",
    genre: "Cumbia",
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=1200&fit=crop",
    venue: "Maguey Nightclub",
    city: "Wilmington, DE",
    address: "123 Main St, Wilmington, DE 19801",
    description: "Dance all night to the best Cumbia rhythms. Join us for an authentic Latin music experience with live performers and DJ sets.",
    tickets: [
      { id: "ga", name: "Male General Admission", price: 25, fee: 5, description: "Includes Fees & Taxes", limit: 10 },
      { id: "female-ga", name: "Female GA", price: 20, fee: 4, description: "Includes Fees & Taxes", limit: 10 },
      { id: "vip", name: "VIP Entry", price: 50, fee: 8, description: "Includes Fees & Taxes • Priority Entry", limit: 5 },
      { id: "expedited", name: "Expedited Entry", price: 40, fee: 6, description: "Includes Fees & Taxes • Skip the Line", limit: 10 },
    ],
    tables: [
      {
        id: "standard",
        name: "Standard Table",
        capacity: "4-6 Guests",
        minimum: 350,
        perks: ["Dedicated Table", "Reserved Seating"],
      },
      {
        id: "premium",
        name: "Premium Table",
        capacity: "8 Guests",
        minimum: 750,
        perks: ["Dedicated Server", "Premium Location", "Bottle Service"],
      },
      {
        id: "owners",
        name: "Owner's Table",
        capacity: "10+ Guests",
        minimum: 1500,
        perks: ["Ultimate VIP", "Best Location", "Complimentary Starters", "Priority Service"],
      },
    ],
  },
  {
    id: "3",
    name: "Regional Mexican Night",
    date: "2025-11-16",
    time: "10:00 PM",
    genre: "Regional Mexican",
    image: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&h=1200&fit=crop",
    venue: "Maguey Nightclub",
    city: "Wilmington, DE",
    address: "123 Main St, Wilmington, DE 19801",
    description: "Authentic Regional Mexican music and vibes. Experience traditional sounds with a modern twist in an unforgettable atmosphere.",
    tickets: [
      { id: "ga", name: "Male General Admission", price: 25, fee: 5, description: "Includes Fees & Taxes", limit: 10 },
      { id: "female-ga", name: "Female GA", price: 20, fee: 4, description: "Includes Fees & Taxes", limit: 10 },
      { id: "vip", name: "VIP Entry", price: 50, fee: 8, description: "Includes Fees & Taxes • Priority Entry", limit: 5 },
      { id: "expedited", name: "Expedited Entry", price: 40, fee: 6, description: "Includes Fees & Taxes • Skip the Line", limit: 10 },
    ],
    tables: [
      {
        id: "standard",
        name: "Standard Table",
        capacity: "4-6 Guests",
        minimum: 350,
        perks: ["Dedicated Table", "Reserved Seating"],
      },
      {
        id: "premium",
        name: "Premium Table",
        capacity: "8 Guests",
        minimum: 750,
        perks: ["Dedicated Server", "Premium Location", "Bottle Service"],
      },
      {
        id: "owners",
        name: "Owner's Table",
        capacity: "10+ Guests",
        minimum: 1500,
        perks: ["Ultimate VIP", "Best Location", "Complimentary Starters", "Priority Service"],
      },
    ],
  },
  {
    id: "4",
    name: "Latin Remix Festival",
    date: "2025-12-05",
    time: "9:30 PM",
    genre: "Latin Mix",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=1200&fit=crop",
    venue: "Maguey Nightclub",
    city: "Wilmington, DE",
    address: "123 Main St, Wilmington, DE 19801",
    description: "A fusion of Reggaeton, Bachata, and Salsa all night long with rotating DJs and surprise performers.",
    tickets: [
      { id: "ga", name: "Male General Admission", price: 30, fee: 6, description: "Includes Fees & Taxes", limit: 12 },
      { id: "vip", name: "VIP Balcony", price: 60, fee: 10, description: "Includes Fees & Taxes • Balcony Access", limit: 6 },
      { id: "meet-greet", name: "Meet & Greet", price: 90, fee: 12, description: "Includes Fees & Taxes • Artist Meet & Greet", limit: 4 },
    ],
    tables: [
      {
        id: "remix-standard",
        name: "Remix Table",
        capacity: "4 Guests",
        minimum: 400,
        perks: ["Reserved Seating", "Welcome Shots"],
      },
      {
        id: "remix-vip",
        name: "Remix VIP",
        capacity: "6-8 Guests",
        minimum: 900,
        perks: ["Premium Location", "Bottle Service", "Dedicated Server"],
      },
    ],
  },
  {
    id: "5",
    name: "Salsa Sensation",
    date: "2025-12-06",
    time: "9:00 PM",
    genre: "Salsa",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&h=1200&fit=crop",
    venue: "Maguey Nightclub",
    city: "Wilmington, DE",
    address: "123 Main St, Wilmington, DE 19801",
    description: "Live salsa bands and dance instructors kick off a fiery night on the dance floor.",
    tickets: [
      { id: "ga", name: "Male General Admission", price: 22, fee: 4, description: "Includes Fees & Taxes", limit: 14 },
      { id: "lesson", name: "Dance Lesson + GA", price: 35, fee: 6, description: "Includes Fees & Taxes • 45min Lesson", limit: 20 },
      { id: "vip", name: "VIP Dance Floor", price: 55, fee: 8, description: "Includes Fees & Taxes • Front of Stage", limit: 8 },
    ],
    tables: [
      {
        id: "salsa-standard",
        name: "Salsa Table",
        capacity: "4-6 Guests",
        minimum: 320,
        perks: ["Reserved Seating", "Complimentary Chips & Salsa"],
      },
      {
        id: "salsa-vip",
        name: "Salsa VIP",
        capacity: "8 Guests",
        minimum: 780,
        perks: ["Premium Location", "Bottle Service", "Priority Entry"],
      },
    ],
  },
  {
    id: "6",
    name: "New Year's Eve Countdown",
    date: "2025-12-07",
    time: "9:00 PM",
    genre: "NYE Celebration",
    image: "https://images.unsplash.com/photo-1464375117522-1311d6a5b81a?w=800&h=1200&fit=crop",
    venue: "Maguey Nightclub",
    city: "Wilmington, DE",
    address: "123 Main St, Wilmington, DE 19801",
    description: "Ring in the New Year with confetti blasts, champagne toasts, and special guest DJs spinning until sunrise.",
    tickets: [
      { id: "early", name: "Early Bird", price: 45, fee: 8, description: "Includes Fees & Taxes", limit: 50 },
      { id: "ga", name: "Male General Admission", price: 65, fee: 10, description: "Includes Fees & Taxes", limit: 80 },
      { id: "champagne", name: "Champagne Experience", price: 120, fee: 15, description: "Includes Fees & Taxes • Midnight Champagne", limit: 30 },
    ],
    tables: [
      {
        id: "nye-standard",
        name: "Countdown Table",
        capacity: "6 Guests",
        minimum: 900,
        perks: ["Bottle Service", "Party Favors", "Champagne Toast"],
      },
      {
        id: "nye-premium",
        name: "Countdown VIP",
        capacity: "10 Guests",
        minimum: 1800,
        perks: ["VIP Balcony", "Dedicated Server", "Premium Bubbles"],
      },
    ],
  },
  {
    id: "7",
    name: "Bachata Bliss",
    date: "2026-01-03",
    time: "8:30 PM",
    genre: "Bachata",
    image: "https://images.unsplash.com/photo-1519861155730-0b5fbf2d3f5d?w=800&h=1200&fit=crop",
    venue: "Maguey Nightclub",
    city: "Wilmington, DE",
    address: "123 Main St, Wilmington, DE 19801",
    description: "Smooth bachata grooves with guest instructors and live performances. Perfect for the passionate and the curious alike.",
    tickets: [
      { id: "ga", name: "Male General Admission", price: 18, fee: 3, description: "Includes Fees & Taxes", limit: 20 },
      { id: "couples", name: "Couples Pass", price: 32, fee: 5, description: "Includes Fees & Taxes • Entry for Two", limit: 25 },
      { id: "vip", name: "Bachata VIP", price: 45, fee: 6, description: "Includes Fees & Taxes • Preferred Seating", limit: 10 },
    ],
    tables: [
      {
        id: "bachata-standard",
        name: "Bachata Lounge",
        capacity: "4 Guests",
        minimum: 250,
        perks: ["Intimate Setting", "Reserved Seating"],
      },
      {
        id: "bachata-vip",
        name: "Bachata VIP",
        capacity: "6 Guests",
        minimum: 600,
        perks: ["Dance Floor Access", "Bottle Service"],
      },
    ],
  },
  {
    id: "8",
    name: "Carnaval Glow Party",
    date: "2026-01-04",
    time: "10:00 PM",
    genre: "Carnaval",
    image: "https://images.unsplash.com/photo-1514525252534-9b7ee0f18b6a?w=800&h=1200&fit=crop",
    venue: "Maguey Nightclub",
    city: "Wilmington, DE",
    address: "123 Main St, Wilmington, DE 19801",
    description: "Neon lights, samba dancers, and booming drums. A high-energy celebration inspired by Latin America's greatest festivals.",
    tickets: [
      { id: "ga", name: "Male General Admission", price: 28, fee: 5, description: "Includes Fees & Taxes", limit: 30 },
      { id: "paint", name: "Glow Paint Package", price: 38, fee: 6, description: "Includes Fees & Taxes • Glow Paint Kit", limit: 25 },
      { id: "vip", name: "Carnaval VIP", price: 70, fee: 10, description: "Includes Fees & Taxes • Elevated Stage Viewing", limit: 12 },
    ],
    tables: [
      {
        id: "carnaval-standard",
        name: "Carnaval Cabana",
        capacity: "6-8 Guests",
        minimum: 650,
        perks: ["Glow Accessories", "Bottle Service", "Dedicated Host"],
      },
      {
        id: "carnaval-elite",
        name: "Carnaval Elite",
        capacity: "10 Guests",
        minimum: 1300,
        perks: ["Premium Location", "Custom Decor", "Champagne Toast"],
      },
    ],
  },
];

/**
 * Get event by ID
 */
export function getEventById(eventId: string): Event | undefined {
  return mockEvents.find(event => event.id === eventId);
}

