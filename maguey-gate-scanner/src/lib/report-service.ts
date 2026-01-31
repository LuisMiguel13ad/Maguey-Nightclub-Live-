// @ts-nocheck
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  eventName?: string;
  ticketTier?: string;
  scanResult?: 'valid' | 'invalid' | 'used';
  scannedBy?: string;
}

export interface ScanLogData {
  scanned_at: string;
  ticket_id?: string | null;
  scan_result: string;
  tier?: string | null;
  override_used?: boolean | null;
  override_reason?: string | null;
  scanned_by?: string | null;
  metadata?: any;
}

export interface RevenueReportData {
  date: string;
  event_name: string;
  ticket_type: string;
  tickets_sold: number;
  tickets_scanned: number;
  revenue: number;
  scan_rate: number;
}

export interface StaffPerformanceData {
  staff_id: string;
  staff_name: string;
  total_scans: number;
  valid_scans: number;
  invalid_scans: number;
  avg_scan_time_ms: number;
  override_count: number;
}

/**
 * Export scan logs to CSV format
 */
export const exportScanLogsCSV = (
  logs: ScanLogData[],
  filename?: string
): void => {
  const headers = [
    "Time",
    "Ticket ID",
    "Result",
    "Tier",
    "Override Used",
    "Override Reason",
    "Scanned By",
    "Scan Duration (ms)",
  ];

  const rows = logs.map(log => [
    new Date(log.scanned_at).toLocaleString(),
    log.ticket_id || log.metadata?.ticket_id || "-",
    log.scan_result,
    log.tier || log.metadata?.tier || "-",
    log.override_used ? "Yes" : "No",
    log.override_reason || "-",
    log.scanned_by || "System",
    log.metadata?.scan_duration_ms || "-",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  downloadFile(csvContent, `text/csv;charset=utf-8;`, filename || `scan-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`);
};

/**
 * Export scan logs to PDF format
 */
export const exportScanLogsPDF = (
  logs: ScanLogData[],
  filters?: ReportFilters,
  filename?: string
): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const lineHeight = 7;
  let yPos = margin + 10;

  // Title
  doc.setFontSize(18);
  doc.text("Scan Logs Report", margin, yPos);
  yPos += 10;

  // Filters info
  if (filters) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    if (filters.startDate || filters.endDate) {
      const dateRange = `${filters.startDate ? format(filters.startDate, 'MMM d, yyyy') : 'Start'} - ${filters.endDate ? format(filters.endDate, 'MMM d, yyyy') : 'End'}`;
      doc.text(`Date Range: ${dateRange}`, margin, yPos);
      yPos += 5;
    }
    if (filters.eventName) {
      doc.text(`Event: ${filters.eventName}`, margin, yPos);
      yPos += 5;
    }
    if (filters.ticketTier) {
      doc.text(`Tier: ${filters.ticketTier}`, margin, yPos);
      yPos += 5;
    }
    yPos += 5;
  }

  // Table headers
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'bold');
  const headers = ["Time", "Ticket ID", "Result", "Tier", "Scanned By"];
  const colWidths = [35, 40, 25, 30, 40];
  let xPos = margin;

  headers.forEach((header, index) => {
    doc.text(header, xPos, yPos);
    xPos += colWidths[index];
  });
  yPos += lineHeight;

  // Table rows
  doc.setFont(undefined, 'normal');
  logs.forEach((log, index) => {
    // Check if we need a new page
    if (yPos > pageHeight - margin - 10) {
      doc.addPage();
      yPos = margin + 10;
    }

    const row = [
      format(new Date(log.scanned_at), 'MMM d, HH:mm'),
      (log.ticket_id || log.metadata?.ticket_id || "-").substring(0, 20),
      log.scan_result,
      (log.tier || log.metadata?.tier || "-").substring(0, 15),
      (log.scanned_by || "System").substring(0, 20),
    ];

    xPos = margin;
    row.forEach((cell, cellIndex) => {
      doc.text(String(cell), xPos, yPos);
      xPos += colWidths[cellIndex];
    });
    yPos += lineHeight;
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Page ${i} of ${totalPages} | Generated ${format(new Date(), 'MMM d, yyyy HH:mm')}`,
      margin,
      pageHeight - 5
    );
  }

  doc.save(filename || `scan-logs-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

/**
 * Export scan logs to Excel format
 */
export const exportScanLogsExcel = (
  logs: ScanLogData[],
  filters?: ReportFilters,
  filename?: string
): void => {
  const headers = [
    "Time",
    "Ticket ID",
    "Result",
    "Tier",
    "Override Used",
    "Override Reason",
    "Scanned By",
    "Scan Duration (ms)",
  ];

  const rows = logs.map(log => [
    new Date(log.scanned_at),
    log.ticket_id || log.metadata?.ticket_id || "",
    log.scan_result,
    log.tier || log.metadata?.tier || "",
    log.override_used ? "Yes" : "No",
    log.override_reason || "",
    log.scanned_by || "System",
    log.metadata?.scan_duration_ms || 0,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();

  // Add metadata sheet
  if (filters) {
    const metadataRows = [
      ["Report Metadata"],
      ["Generated", new Date().toISOString()],
      [],
    ];
    if (filters.startDate) {
      metadataRows.push(["Start Date", format(filters.startDate, 'yyyy-MM-dd')]);
    }
    if (filters.endDate) {
      metadataRows.push(["End Date", format(filters.endDate, 'yyyy-MM-dd')]);
    }
    if (filters.eventName) {
      metadataRows.push(["Event", filters.eventName]);
    }
    if (filters.ticketTier) {
      metadataRows.push(["Tier", filters.ticketTier]);
    }
    metadataRows.push(["Total Records", logs.length]);

    const metadataSheet = XLSX.utils.aoa_to_sheet(metadataRows);
    XLSX.utils.book_append_sheet(workbook, metadataSheet, "Metadata");
  }

  // Set column widths
  worksheet['!cols'] = [
    { wch: 20 }, // Time
    { wch: 30 }, // Ticket ID
    { wch: 12 }, // Result
    { wch: 15 }, // Tier
    { wch: 15 }, // Override Used
    { wch: 30 }, // Override Reason
    { wch: 25 }, // Scanned By
    { wch: 18 }, // Scan Duration
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Scan Logs");
  XLSX.writeFile(workbook, filename || `scan-logs-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

/**
 * Export revenue report to Excel
 */
export const exportRevenueReportExcel = (
  data: RevenueReportData[],
  filename?: string
): void => {
  const headers = [
    "Date",
    "Event Name",
    "Ticket Type",
    "Tickets Sold",
    "Tickets Scanned",
    "Revenue",
    "Scan Rate (%)",
  ];

  const rows = data.map(item => [
    item.date,
    item.event_name,
    item.ticket_type,
    item.tickets_sold,
    item.tickets_scanned,
    item.revenue,
    item.scan_rate.toFixed(2),
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Date
    { wch: 25 }, // Event Name
    { wch: 20 }, // Ticket Type
    { wch: 15 }, // Tickets Sold
    { wch: 15 }, // Tickets Scanned
    { wch: 15 }, // Revenue
    { wch: 15 }, // Scan Rate
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Revenue Report");
  XLSX.writeFile(workbook, filename || `revenue-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

/**
 * Export staff performance report to Excel
 */
export const exportStaffPerformanceExcel = (
  data: StaffPerformanceData[],
  filename?: string
): void => {
  const headers = [
    "Staff Name",
    "Total Scans",
    "Valid Scans",
    "Invalid Scans",
    "Success Rate (%)",
    "Avg Scan Time (ms)",
    "Override Count",
  ];

  const rows = data.map(item => [
    item.staff_name,
    item.total_scans,
    item.valid_scans,
    item.invalid_scans,
    item.total_scans > 0 ? ((item.valid_scans / item.total_scans) * 100).toFixed(2) : "0.00",
    item.avg_scan_time_ms.toFixed(0),
    item.override_count,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();

  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, // Staff Name
    { wch: 15 }, // Total Scans
    { wch: 15 }, // Valid Scans
    { wch: 15 }, // Invalid Scans
    { wch: 18 }, // Success Rate
    { wch: 20 }, // Avg Scan Time
    { wch: 15 }, // Override Count
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Staff Performance");
  XLSX.writeFile(workbook, filename || `staff-performance-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

/**
 * Fetch scan logs with filters
 */
export const fetchScanLogs = async (
  filters?: ReportFilters
): Promise<ScanLogData[]> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  let query = supabase
    .from("scan_logs")
    .select("*")
    .order("scanned_at", { ascending: false });

  if (filters?.startDate) {
    query = query.gte("scanned_at", filters.startDate.toISOString());
  }
  if (filters?.endDate) {
    query = query.lte("scanned_at", filters.endDate.toISOString());
  }
  if (filters?.scanResult) {
    query = query.eq("scan_result", filters.scanResult);
  }
  if (filters?.scannedBy) {
    query = query.eq("scanned_by", filters.scannedBy);
  }

  const { data, error } = await query.limit(10000); // Limit to prevent memory issues

  if (error) throw error;

  // Apply additional filters that require ticket data
  let filteredData = data || [];
  
  if (filters?.eventName || filters?.ticketTier) {
    const ticketIds = filteredData
      .map(log => log.ticket_id || log.metadata?.ticket_id)
      .filter(Boolean);

    if (ticketIds.length > 0) {
      let ticketQuery = supabase
        .from("tickets")
        .select("id, event_name, tier")
        .in("id", ticketIds);

      const { data: tickets, error: ticketError } = await ticketQuery;

      if (!ticketError && tickets) {
        const ticketMap = new Map(tickets.map(t => [t.id, t]));
        
        filteredData = filteredData.filter(log => {
          const ticketId = log.ticket_id || log.metadata?.ticket_id;
          const ticket = ticketId ? ticketMap.get(ticketId) : null;
          
          if (filters.eventName && ticket?.event_name !== filters.eventName) {
            return false;
          }
          if (filters.ticketTier && ticket?.tier !== filters.ticketTier) {
            return false;
          }
          return true;
        });
      }
    }
  }

  return filteredData as ScanLogData[];
};

/**
 * Fetch revenue report data
 */
export const fetchRevenueReport = async (
  filters?: ReportFilters
): Promise<RevenueReportData[]> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  let query = supabase
    .from("tickets")
    .select("event_name, ticket_type, purchase_date, scanned_at, price_paid, tier");

  if (filters?.startDate) {
    query = query.gte("purchase_date", filters.startDate.toISOString());
  }
  if (filters?.endDate) {
    query = query.lte("purchase_date", filters.endDate.toISOString());
  }
  if (filters?.eventName) {
    query = query.eq("event_name", filters.eventName);
  }
  if (filters?.ticketTier) {
    query = query.eq("tier", filters.ticketTier);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Group by date, event, and ticket type
  const grouped = new Map<string, RevenueReportData>();

  (data || []).forEach(ticket => {
    const date = format(new Date(ticket.purchase_date), 'yyyy-MM-dd');
    const key = `${date}|${ticket.event_name}|${ticket.ticket_type}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, {
        date,
        event_name: ticket.event_name,
        ticket_type: ticket.ticket_type,
        tickets_sold: 0,
        tickets_scanned: 0,
        revenue: 0,
        scan_rate: 0,
      });
    }

    const item = grouped.get(key)!;
    item.tickets_sold++;
    const price = typeof ticket.price_paid === 'string' 
      ? parseFloat(ticket.price_paid) 
      : (ticket.price_paid || 0);
    item.revenue += price;
    
    if (ticket.scanned_at) {
      item.tickets_scanned++;
    }
  });

  // Calculate scan rates
  Array.from(grouped.values()).forEach(item => {
    item.scan_rate = item.tickets_sold > 0 
      ? (item.tickets_scanned / item.tickets_sold) * 100 
      : 0;
  });

  return Array.from(grouped.values()).sort((a, b) => 
    a.date.localeCompare(b.date) || a.event_name.localeCompare(b.event_name)
  );
};

/**
 * Fetch staff performance data
 */
export const fetchStaffPerformance = async (
  filters?: ReportFilters
): Promise<StaffPerformanceData[]> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  let query = supabase
    .from("scan_logs")
    .select("scanned_by, scan_result, scan_duration_ms, override_used");

  if (filters?.startDate) {
    query = query.gte("scanned_at", filters.startDate.toISOString());
  }
  if (filters?.endDate) {
    query = query.lte("scanned_at", filters.endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) throw error;

  // Group by staff member
  const grouped = new Map<string, StaffPerformanceData>();

  (data || []).forEach(log => {
    const staffId = log.scanned_by || "unknown";
    
    if (!grouped.has(staffId)) {
      grouped.set(staffId, {
        staff_id: staffId,
        staff_name: staffId, // Will be replaced with actual name if available
        total_scans: 0,
        valid_scans: 0,
        invalid_scans: 0,
        avg_scan_time_ms: 0,
        override_count: 0,
      });
    }

    const item = grouped.get(staffId)!;
    item.total_scans++;
    
    if (log.scan_result === 'valid') {
      item.valid_scans++;
    } else {
      item.invalid_scans++;
    }

    if (log.scan_duration_ms) {
      const currentAvg = item.avg_scan_time_ms;
      const count = item.total_scans;
      item.avg_scan_time_ms = ((currentAvg * (count - 1)) + log.scan_duration_ms) / count;
    }

    if (log.override_used) {
      item.override_count++;
    }
  });

  // Try to get staff names from auth.users
  const staffIds = Array.from(grouped.keys()).filter(id => id !== "unknown");
  if (staffIds.length > 0) {
    try {
      const { data: users } = await supabase.auth.admin.listUsers();
      if (users) {
        users.users.forEach(user => {
          if (grouped.has(user.id)) {
            grouped.get(user.id)!.staff_name = user.email?.split('@')[0] || user.id;
          }
        });
      }
    } catch (error) {
      // Admin API might not be available, use IDs as names
      console.warn("Could not fetch user names:", error);
    }
  }

  return Array.from(grouped.values()).sort((a, b) => 
    b.total_scans - a.total_scans
  );
};

/**
 * Export event attendance (scanned tickets) to CSV
 */
export const exportEventAttendanceCSV = async (
  eventName: string,
  filename?: string
): Promise<void> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("ticket_id, guest_name, guest_email, ticket_type, tier, scanned_at, scanned_by, purchase_date")
    .eq("event_name", eventName)
    .not("scanned_at", "is", null)
    .order("scanned_at", { ascending: false });

  if (error) throw error;

  const headers = [
    "Ticket ID",
    "Guest Name",
    "Guest Email",
    "Ticket Type",
    "Tier",
    "Scanned At",
    "Scanned By",
    "Purchase Date",
  ];

  const rows = (tickets || []).map(ticket => [
    ticket.ticket_id || "-",
    ticket.guest_name || "-",
    ticket.guest_email || "-",
    ticket.ticket_type || "-",
    ticket.tier || "-",
    ticket.scanned_at ? new Date(ticket.scanned_at).toLocaleString() : "-",
    ticket.scanned_by || "System",
    ticket.purchase_date ? new Date(ticket.purchase_date).toLocaleString() : "-",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  downloadFile(csvContent, `text/csv;charset=utf-8;`, filename || `attendance-${eventName}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
};

/**
 * Export event attendance to PDF
 */
export const exportEventAttendancePDF = async (
  eventName: string,
  filename?: string
): Promise<void> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("ticket_id, guest_name, guest_email, ticket_type, tier, scanned_at, scanned_by, purchase_date")
    .eq("event_name", eventName)
    .not("scanned_at", "is", null)
    .order("scanned_at", { ascending: false });

  if (error) throw error;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const lineHeight = 7;
  let yPos = margin + 10;

  // Title
  doc.setFontSize(18);
  doc.text(`Attendance Report: ${eventName}`, margin, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, margin, yPos);
  doc.text(`Total Attendees: ${tickets?.length || 0}`, margin, yPos + 5);
  yPos += 15;

  // Table headers
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'bold');
  const headers = ["Guest Name", "Email", "Ticket Type", "Scanned At"];
  const colWidths = [50, 60, 35, 45];
  let xPos = margin;

  headers.forEach((header, index) => {
    doc.text(header, xPos, yPos);
    xPos += colWidths[index];
  });
  yPos += lineHeight;

  // Table rows
  doc.setFont(undefined, 'normal');
  (tickets || []).forEach((ticket) => {
    if (yPos > pageHeight - margin - 10) {
      doc.addPage();
      yPos = margin + 10;
    }

    const row = [
      (ticket.guest_name || "-").substring(0, 30),
      (ticket.guest_email || "-").substring(0, 35),
      (ticket.ticket_type || "-").substring(0, 20),
      ticket.scanned_at ? format(new Date(ticket.scanned_at), 'MMM d, HH:mm') : "-",
    ];

    xPos = margin;
    row.forEach((cell, cellIndex) => {
      doc.text(String(cell), xPos, yPos);
      xPos += colWidths[cellIndex];
    });
    yPos += lineHeight;
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Page ${i} of ${totalPages} | Generated ${format(new Date(), 'MMM d, yyyy HH:mm')}`,
      margin,
      pageHeight - 5
    );
  }

  doc.save(filename || `attendance-${eventName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

/**
 * Export event orders to CSV
 */
export const exportEventOrdersCSV = async (
  eventName: string,
  filename?: string
): Promise<void> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  // First get the event ID from the event name
  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("name", eventName)
    .single();

  if (eventError || !eventData) {
    throw new Error(`Event "${eventName}" not found`);
  }

  const { data: orders, error } = await supabase
    .from<any>("orders")
    .select("id, purchaser_name, purchaser_email, total, status, created_at, completed_at, event_id, events(name)")
    .eq("event_id", eventData.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const headers = [
    "Order ID",
    "Customer Name",
    "Customer Email",
    "Customer Phone",
    "Ticket Type",
    "Quantity",
    "Total Amount",
    "Status",
    "Created At",
    "Completed At",
  ];

  const rows = (orders || []).map(order => {
    return [
      order.id || "-",
      order.purchaser_name || "-",
      order.purchaser_email || "-",
      "-", // customer_phone not in orders table
      "-", // ticket_type not in orders table
      0,
      typeof order.total === 'string' ? parseFloat(order.total).toFixed(2) : (Number(order.total || 0) / 100).toFixed(2),
      order.status || "-",
      order.created_at ? new Date(order.created_at).toLocaleString() : "-",
      order.completed_at ? new Date(order.completed_at).toLocaleString() : "-",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  downloadFile(csvContent, `text/csv;charset=utf-8;`, filename || `orders-${eventName}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
};

/**
 * Export event orders to PDF
 */
export const exportEventOrdersPDF = async (
  eventName: string,
  filename?: string
): Promise<void> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  // First get the event ID from the event name
  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("name", eventName)
    .single();

  if (eventError || !eventData) {
    throw new Error(`Event "${eventName}" not found`);
  }

  const { data: orders, error } = await supabase
    .from<any>("orders")
    .select("id, purchaser_name, purchaser_email, total, status, created_at, completed_at, event_id, events(name)")
    .eq("event_id", eventData.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const lineHeight = 7;
  let yPos = margin + 10;

  // Title
  doc.setFontSize(18);
  doc.text(`Orders Report: ${eventName}`, margin, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, margin, yPos);
  
  const totalRevenue = (orders || []).reduce((sum, order) => {
    const amount = typeof order.total === 'string' ? parseFloat(order.total) : (Number(order.total || 0) / 100);
    return sum + amount;
  }, 0);
  
  doc.text(`Total Orders: ${orders?.length || 0} | Total Revenue: $${totalRevenue.toFixed(2)}`, margin, yPos + 5);
  yPos += 15;

  // Table headers
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'bold');
  const headers = ["Customer", "Email", "Type", "Qty", "Amount", "Status"];
  const colWidths = [40, 50, 25, 15, 25, 25];
  let xPos = margin;

  headers.forEach((header, index) => {
    doc.text(header, xPos, yPos);
    xPos += colWidths[index];
  });
  yPos += lineHeight;

  // Table rows
  doc.setFont(undefined, 'normal');
  (orders || []).forEach((order) => {
    if (yPos > pageHeight - margin - 10) {
      doc.addPage();
      yPos = margin + 10;
    }

    const amount = typeof order.total === 'string' ? parseFloat(order.total) : (Number(order.total || 0) / 100);
    const row = [
      (order.purchaser_name || "-").substring(0, 25),
      (order.purchaser_email || "-").substring(0, 30),
      "-", // ticket_type not in orders table
      "0",
      `$${amount.toFixed(2)}`,
      (order.status || "-").substring(0, 15),
    ];

    xPos = margin;
    row.forEach((cell, cellIndex) => {
      doc.text(String(cell), xPos, yPos);
      xPos += colWidths[cellIndex];
    });
    yPos += lineHeight;
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Page ${i} of ${totalPages} | Generated ${format(new Date(), 'MMM d, yyyy HH:mm')}`,
      margin,
      pageHeight - 5
    );
  }

  doc.save(filename || `orders-${eventName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

/**
 * Interface for discrepancy data
 */
export interface DiscrepancyReportData {
  id: string;
  checked_at: string;
  db_revenue: number;
  stripe_revenue: number;
  discrepancy_amount: number;
  discrepancy_percent: number;
  resolved_at: string | null;
  resolution_notes: string | null;
  period_start: string | null;
  period_end: string | null;
}

/**
 * Export revenue discrepancies to CSV
 */
export const exportDiscrepanciesCSV = (
  discrepancies: DiscrepancyReportData[],
  filename?: string
): void => {
  const headers = [
    "Date Checked",
    "DB Revenue",
    "Stripe Revenue",
    "Discrepancy",
    "Discrepancy %",
    "Period Start",
    "Period End",
    "Status",
    "Resolution Notes",
  ];

  const rows = discrepancies.map(d => [
    new Date(d.checked_at).toLocaleString(),
    `$${d.db_revenue.toFixed(2)}`,
    `$${d.stripe_revenue.toFixed(2)}`,
    `$${d.discrepancy_amount.toFixed(2)}`,
    `${d.discrepancy_percent.toFixed(2)}%`,
    d.period_start ? format(new Date(d.period_start), 'yyyy-MM-dd') : "-",
    d.period_end ? format(new Date(d.period_end), 'yyyy-MM-dd') : "-",
    d.resolved_at ? "Resolved" : "Unresolved",
    d.resolution_notes || "-",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  downloadFile(csvContent, `text/csv;charset=utf-8;`, filename || `revenue-discrepancies-${format(new Date(), 'yyyy-MM-dd')}.csv`);
};

/**
 * Fetch revenue discrepancies
 */
export const fetchDiscrepancies = async (
  limit: number = 100
): Promise<DiscrepancyReportData[]> => {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  // Use type assertion since revenue_discrepancies may not be in generated types
  const { data, error } = await (supabase as any)
    .from("revenue_discrepancies")
    .select("*")
    .order("checked_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []) as DiscrepancyReportData[];
};

/**
 * Helper function to download files
 */
const downloadFile = (content: string, mimeType: string, filename: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


