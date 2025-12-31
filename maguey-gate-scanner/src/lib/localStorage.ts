// Local storage service for development mode when Supabase is not available
export interface Ticket {
  id: string;
  ticket_id: string;
  qr_token?: string;
  qr_signature?: string;
  event_name: string;
  ticket_type: string;
  purchase_date: string;
  is_used: boolean;
  scanned_at?: string;
  scanned_by?: string;
  guest_name?: string;
  guest_email?: string;
  price_paid?: number;
  guest_phone?: string;
  metadata?: {
    phone?: string;
    [key: string]: any;
  };
  created_at: string;
  status?: string;
}

export interface ScanLog {
  id: string;
  ticket_id?: string;
  scanned_by?: string;
  scan_result: string;
  scanned_at: string;
  metadata?: any;
  override_used?: boolean;
  override_reason?: string | null;
}

const STORAGE_KEYS = {
  TICKETS: 'maguey_tickets',
  SCAN_LOGS: 'maguey_scan_logs',
  USER: 'maguey_user',
  EVENTS: 'maguey_events',
};

export const localStorageService = {
  // Ticket operations
  getTickets: (): Ticket[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.TICKETS);
    if (stored) {
      return JSON.parse(stored);
    }
    // Initialize with sample tickets
    const sampleTickets: Ticket[] = [
      {
        id: '1',
        ticket_id: 'MGY-2025-001',
        qr_token: 'MGY-2025-001',
        event_name: 'Friday Night Sessions',
        ticket_type: 'VIP',
        purchase_date: new Date().toISOString(),
        is_used: false,
        status: 'issued',
        guest_name: 'Alex Rivera',
        guest_email: 'alex@example.com',
        price_paid: 50,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        ticket_id: 'MGY-2025-002',
        qr_token: 'MGY-2025-002',
        event_name: 'Friday Night Sessions',
        ticket_type: 'General Admission',
        purchase_date: new Date().toISOString(),
        is_used: false,
        status: 'issued',
        guest_name: 'Sam Chen',
        guest_email: 'sam@example.com',
        price_paid: 25,
        created_at: new Date().toISOString(),
      },
      {
        id: '3',
        ticket_id: 'MGY-2025-003',
        qr_token: 'MGY-2025-003',
        event_name: 'Saturday Fiesta',
        ticket_type: 'VIP',
        purchase_date: new Date().toISOString(),
        is_used: false,
        status: 'issued',
        guest_name: 'Jordan Martinez',
        guest_email: 'jordan@example.com',
        price_paid: 60,
        created_at: new Date().toISOString(),
      },
    ];
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(sampleTickets));
    return sampleTickets;
  },

  saveTicket: (ticket: Ticket): void => {
    const tickets = localStorageService.getTickets();
    const existingIndex = tickets.findIndex(t => t.id === ticket.id);
    if (existingIndex >= 0) {
      tickets[existingIndex] = ticket;
    } else {
      tickets.push(ticket);
    }
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
  },

  createTicket: (ticketData: Omit<Ticket, 'id' | 'created_at' | 'purchase_date' | 'is_used'>): Ticket => {
    const tickets = localStorageService.getTickets();
    const newTicket: Ticket = {
      ...ticketData,
      id: Date.now().toString(),
      purchase_date: new Date().toISOString(),
      is_used: false,
      status: 'issued',
      qr_token: ticketData.ticket_id,
      created_at: new Date().toISOString(),
      price_paid: ticketData.price_paid,
    };
    tickets.push(newTicket);
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
    return newTicket;
  },

  deleteTicket: (id: string): void => {
    const tickets = localStorageService.getTickets();
    const filtered = tickets.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(filtered));
  },

  // Scan log operations
  getScanLogs: (): ScanLog[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.SCAN_LOGS);
    return stored ? JSON.parse(stored) : [];
  },

  addScanLog: (log: Omit<ScanLog, 'id' | 'scanned_at'>): void => {
    const logs = localStorageService.getScanLogs();
    const newLog: ScanLog = {
      ...log,
      id: Date.now().toString(),
      scanned_at: new Date().toISOString(),
    };
    logs.push(newLog);
    localStorage.setItem(STORAGE_KEYS.SCAN_LOGS, JSON.stringify(logs));
  },

  // User operations
  setUser: (user: any): void => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  getUser: (): any => {
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    return stored ? JSON.parse(stored) : null;
  },

  clearUser: (): void => {
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  // Event operations
  getEvents: (): string[] => {
    const defaultEvents = [
      'Perreo Fridays',
      'Regional Mexicano',
      'Cumbia Nights'
    ];
    
    const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (stored) {
      const existingEvents = JSON.parse(stored);
      // Filter out any events with day text in parentheses
      const hasEventsWithDayText = existingEvents.some((event: string) => 
        event.includes('(Saturday)') || event.includes('(Sunday)') || event.includes('(Friday)')
      );
      
      // If we found events with day text, or if we don't have exactly the 3 default events, reset to defaults
      if (hasEventsWithDayText || existingEvents.length !== 3 || 
          !defaultEvents.every(e => existingEvents.includes(e))) {
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(defaultEvents));
        return defaultEvents;
      }
      
      return existingEvents;
    }
    
    // Initialize with default events
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(defaultEvents));
    return defaultEvents;
  },

  addEvent: (eventName: string): void => {
    const events = localStorageService.getEvents();
    if (!events.includes(eventName)) {
      events.push(eventName);
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    }
  },
};

export const isSupabaseConfigured = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return !!(url && key && url !== 'https://placeholder.supabase.co' && key !== 'placeholder-key');
};

