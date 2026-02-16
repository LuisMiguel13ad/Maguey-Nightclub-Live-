// Backend API for ticket validation and scanning
// This would typically be implemented in a separate backend service

interface TicketValidationRequest {
  qrCode: string;
  scannerId: string;
  location: string;
}

interface TicketValidationResponse {
  success: boolean;
  ticket?: {
    orderId: string;
    eventId: string;
    event: {
      artist: string;
      date: string;
      time: string;
      venue: string;
      address: string;
    };
    customer: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      dateOfBirth: string;
    };
    tickets: {[key: string]: number};
    tables: {[key: string]: number};
    total: number;
    status: 'valid' | 'used' | 'expired' | 'cancelled' | 'invalid';
    scannedAt?: string;
    scannedBy?: string;
    qrCode: string;
  };
  error?: string;
  message?: string;
}

interface ScanLog {
  id: string;
  orderId: string;
  qrCode: string;
  scannerId: string;
  location: string;
  timestamp: string;
  result: 'success' | 'failure';
  error?: string;
}

// Mock database for demonstration
const mockTickets = new Map<string, any>();
const scanLogs: ScanLog[] = [];

// Initialize with sample data
const initializeMockData = () => {
  const sampleTickets = [
    {
      orderId: 'MAG-1703123456789',
      eventId: 'reggaeton-fridays',
      event: {
        artist: 'REGGUETON FRIDAYS',
        date: 'OCT 25 FRIDAY',
        time: '10:00 PM - 3:00 AM',
        venue: 'MAGUEY DELAWARE',
        address: '123 Main Street, Wilmington, DE 19801'
      },
      customer: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@email.com',
        phone: '(555) 123-4567',
        dateOfBirth: '1995-06-15'
      },
      tickets: { 'general-admission': 2, 'vip-ticket': 1 },
      tables: { 'standard-table': 1 },
      total: 345.60,
      status: 'valid' as const,
      qrCode: 'MAG-1703123456789|REGGUETON FRIDAYS|OCT 25 FRIDAY',
      createdAt: '2024-10-20T10:30:00Z',
      expiresAt: '2024-10-26T03:00:00Z'
    },
    {
      orderId: 'MAG-1703123456790',
      eventId: 'regional-mexican-night',
      event: {
        artist: 'REGIONAL MEXICAN NIGHT',
        date: 'OCT 26 SATURDAY',
        time: '9:00 PM - 2:00 AM',
        venue: 'MAGUEY DELAWARE',
        address: '123 Main Street, Wilmington, DE 19801'
      },
      customer: {
        firstName: 'Maria',
        lastName: 'Garcia',
        email: 'maria.garcia@email.com',
        phone: '(555) 987-6543',
        dateOfBirth: '1992-03-22'
      },
      tickets: { 'general-admission': 4 },
      tables: {},
      total: 129.60,
      status: 'valid' as const,
      qrCode: 'MAG-1703123456790|REGIONAL MEXICAN NIGHT|OCT 26 SATURDAY',
      createdAt: '2024-10-21T14:20:00Z',
      expiresAt: '2024-10-27T02:00:00Z'
    }
  ];

  sampleTickets.forEach(ticket => {
    mockTickets.set(ticket.qrCode, ticket);
  });
};

// Initialize mock data
initializeMockData();

// Validate ticket by QR code
export const validateTicket = async (request: TicketValidationRequest): Promise<TicketValidationResponse> => {
  try {
    const { qrCode, scannerId, location } = request;
    
    // Log the scan attempt
    const scanLog: ScanLog = {
      id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: qrCode.split('|')[0],
      qrCode,
      scannerId,
      location,
      timestamp: new Date().toISOString(),
      result: 'failure'
    };

    // Find ticket by QR code
    const ticket = mockTickets.get(qrCode);
    
    if (!ticket) {
      scanLog.error = 'Ticket not found';
      scanLogs.push(scanLog);
      
      return {
        success: false,
        error: 'Invalid ticket code',
        message: 'This ticket code is not recognized in our system.'
      };
    }

    // Check if ticket is already used
    if (ticket.status === 'used') {
      scanLog.error = 'Ticket already used';
      scanLogs.push(scanLog);
      
      return {
        success: false,
        error: 'Ticket already used',
        message: `This ticket was already scanned on ${new Date(ticket.scannedAt!).toLocaleString()} by ${ticket.scannedBy}`
      };
    }

    // Check if ticket is cancelled
    if (ticket.status === 'cancelled') {
      scanLog.error = 'Ticket cancelled';
      scanLogs.push(scanLog);
      
      return {
        success: false,
        error: 'Ticket cancelled',
        message: 'This ticket has been cancelled and is no longer valid.'
      };
    }

    // Check if ticket is expired
    const now = new Date();
    const expiresAt = new Date(ticket.expiresAt);
    
    if (now > expiresAt) {
      ticket.status = 'expired';
      scanLog.error = 'Ticket expired';
      scanLogs.push(scanLog);
      
      return {
        success: false,
        error: 'Ticket expired',
        message: 'This ticket has expired and is no longer valid.'
      };
    }

    // Validate event date (ticket can only be used on event day)
    const eventDate = new Date(ticket.event.date);
    const today = new Date();
    const isEventDay = eventDate.toDateString() === today.toDateString();
    
    if (!isEventDay) {
      scanLog.error = 'Ticket not valid for today';
      scanLogs.push(scanLog);
      
      return {
        success: false,
        error: 'Invalid event date',
        message: `This ticket is only valid for ${ticket.event.date}, not today.`
      };
    }

    // Mark ticket as used
    ticket.status = 'used';
    ticket.scannedAt = new Date().toISOString();
    ticket.scannedBy = scannerId;

    // Log successful scan
    scanLog.result = 'success';
    scanLogs.push(scanLog);

    return {
      success: true,
      ticket: {
        ...ticket,
        status: 'used'
      },
      message: 'Ticket validated successfully!'
    };

  } catch (error) {
    console.error('Ticket validation error:', error);
    
    return {
      success: false,
      error: 'Validation error',
      message: 'An error occurred while validating the ticket.'
    };
  }
};

// Get scan history
export const getScanHistory = async (limit: number = 50): Promise<ScanLog[]> => {
  return scanLogs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
};

// Get scan statistics
export const getScanStats = async (date?: string): Promise<{
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  successRate: number;
  scansByHour: {[key: string]: number};
  topScanners: {scannerId: string, count: number}[];
}> => {
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const dayScans = scanLogs.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate >= startOfDay && logDate <= endOfDay;
  });

  const totalScans = dayScans.length;
  const successfulScans = dayScans.filter(log => log.result === 'success').length;
  const failedScans = totalScans - successfulScans;
  const successRate = totalScans > 0 ? (successfulScans / totalScans) * 100 : 0;

  // Group scans by hour
  const scansByHour: {[key: string]: number} = {};
  dayScans.forEach(log => {
    const hour = new Date(log.timestamp).getHours();
    const hourKey = `${hour}:00`;
    scansByHour[hourKey] = (scansByHour[hourKey] || 0) + 1;
  });

  // Get top scanners
  const scannerCounts: {[key: string]: number} = {};
  dayScans.forEach(log => {
    scannerCounts[log.scannerId] = (scannerCounts[log.scannerId] || 0) + 1;
  });

  const topScanners = Object.entries(scannerCounts)
    .map(([scannerId, count]) => ({ scannerId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalScans,
    successfulScans,
    failedScans,
    successRate,
    scansByHour,
    topScanners
  };
};

// Cancel ticket
export const cancelTicket = async (qrCode: string, reason: string): Promise<{success: boolean, error?: string}> => {
  try {
    const ticket = mockTickets.get(qrCode);
    
    if (!ticket) {
      return {
        success: false,
        error: 'Ticket not found'
      };
    }

    if (ticket.status === 'used') {
      return {
        success: false,
        error: 'Cannot cancel used ticket'
      };
    }

    ticket.status = 'cancelled';
    ticket.cancelledAt = new Date().toISOString();
    ticket.cancellationReason = reason;

    return {
      success: true
    };

  } catch (error) {
    console.error('Cancel ticket error:', error);
    return {
      success: false,
      error: 'Failed to cancel ticket'
    };
  }
};

// Get ticket details
export const getTicketDetails = async (qrCode: string): Promise<{success: boolean, ticket?: any, error?: string}> => {
  try {
    const ticket = mockTickets.get(qrCode);
    
    if (!ticket) {
      return {
        success: false,
        error: 'Ticket not found'
      };
    }

    return {
      success: true,
      ticket
    };

  } catch (error) {
    console.error('Get ticket details error:', error);
    return {
      success: false,
      error: 'Failed to get ticket details'
    };
  }
};

// API route handlers
export const ticketValidationHandlers = {
  // POST /api/validate-ticket
  validateTicket: async (req: any, res: any) => {
    try {
      const result = await validateTicket(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  },

  // GET /api/scan-history
  getScanHistory: async (req: any, res: any) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const history = await getScanHistory(limit);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // GET /api/scan-stats
  getScanStats: async (req: any, res: any) => {
    try {
      const stats = await getScanStats(req.query.date);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // POST /api/cancel-ticket
  cancelTicket: async (req: any, res: any) => {
    try {
      const { qrCode, reason } = req.body;
      const result = await cancelTicket(qrCode, reason);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // GET /api/ticket-details/:qrCode
  getTicketDetails: async (req: any, res: any) => {
    try {
      const { qrCode } = req.params;
      const result = await getTicketDetails(qrCode);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
