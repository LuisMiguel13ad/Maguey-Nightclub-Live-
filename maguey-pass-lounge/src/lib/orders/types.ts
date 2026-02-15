import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "../supabase";
import type { TicketData } from "../ticket-generator";
import type { SagaExecution } from "../sagas/saga-engine";

export type SupabaseTypedClient = SupabaseClient<any>;

export interface CheckoutSelectionItem {
  name: string;
  quantity: number;
  price: number;
  fee: number;
}

export type CheckoutSelectionRecord = Record<string, CheckoutSelectionItem>;

export interface OrderLineItem {
  ticketTypeId: string;
  quantity: number;
  unitPrice: number;
  unitFee: number;
  displayName: string;
}

export interface CreateOrderInput {
  eventId: string;
  purchaserEmail: string;
  purchaserName: string;
  purchaserUserId?: string | null;
  lineItems: OrderLineItem[];
  metadata?: Record<string, unknown>;
  ticketHolderName?: string;
  promoCodeId?: string | null;
}

export interface CreatedOrderResult {
  order: Order;
  lineItems: OrderLineItem[];
  ticketEmailPayloads: TicketData[];
}

export interface CreateOrderOptions {
  client?: SupabaseTypedClient;
  /** Client IP address for rate limiting */
  clientIP?: string;
}

export interface CreateOrderWithSagaOptions {
  client?: SupabaseTypedClient;
  /** Persist saga execution to database for debugging/recovery */
  persistSaga?: boolean;
  /** Callback for saga state changes */
  onSagaStateChange?: (execution: SagaExecution<unknown>) => void | Promise<void>;
}

export interface InsertTicketsParams {
  order: Order;
  event: {
    id: string;
    name: string;
    description?: string | null;
    image_url?: string | null;
    event_date: string;
    event_time: string;
    venue_name?: string | null;
    venue_address?: string | null;
    city?: string | null;
  };
  ticketTypeId: string;
  displayName: string;
  quantity: number;
  unitPrice: number;
  unitFee: number;
  attendeeName?: string | null;
  attendeeEmail?: string | null;
  client?: SupabaseTypedClient;
}

export interface BatchInsertTicketsParams {
  order: Order;
  event: InsertTicketsParams['event'];
  lineItems: Array<{
    ticketTypeId: string;
    displayName: string;
    quantity: number;
    unitPrice: number;
    unitFee: number;
  }>;
  attendeeName?: string | null;
  attendeeEmail?: string | null;
  client?: SupabaseTypedClient;
}

export interface OrdersQueryOptions {
  limit?: number;
  offset?: number;
  status?: string;
}

export interface AdminOrderRow {
  id: string;
  purchaser_email: string;
  purchaser_name: string | null;
  total: number;
  status: string;
  created_at: string;
}

export interface PaginatedOrderRow extends AdminOrderRow {
  event_id: string;
  event?: {
    id: string;
    name: string;
    event_date: string;
  } | null;
  ticket_count?: number;
}

export interface OrderFilters {
  /** Filter by order status */
  status?: string | null;
  /** Filter by event ID */
  eventId?: string | null;
  /** Filter by purchaser email (partial match) */
  email?: string | null;
  /** Filter by date range - start */
  dateFrom?: string | null;
  /** Filter by date range - end */
  dateTo?: string | null;
}

export interface TicketsQueryOptions {
  status?: "all" | "scanned" | "pending" | "refunded";
  limit?: number;
  offset?: number;
}

export interface AdminTicketRow {
  id: string;
  order_id: string;
  attendee_name: string | null;
  attendee_email: string | null;
  status: string;
  issued_at: string | null;
  scanned_at: string | null;
  qr_token: string | null;
  ticket_type_id: string;
  events: { name: string } | null;
  ticket_types: { name: string } | null;
}

export interface DashboardStats {
  totalEvents: number;
  totalOrders: number;
  totalRevenue: number;
  ticketsIssued: number;
  ticketsScanned: number;
}

export interface OrderSummary {
  totalOrders: number;
  totalRevenue: number;
  totalTicketsIssued: number;
  totalTicketsScanned: number;
}

export interface OrderReportRow {
  orderId: string;
  purchaserName: string | null;
  purchaserEmail: string | null;
  total: number;
  status: string;
  created_at: string;
  ticketCount: number;
}

export interface SummaryRange {
  start?: string;
  end?: string;
}

export interface UserTicket {
  id: string;
  ticket_id: string;
  order_id: string;
  event_id: string;
  event_name: string;
  event_image: string | null;
  event_date: string;
  event_time: string;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  ticket_type: string;
  ticket_type_name: string;
  ticket_category?: 'general' | 'vip' | 'service' | 'section';
  section_name?: string | null;
  section_description?: string | null;
  status: string;
  price: number;
  fee: number;
  total: number;
  attendee_name: string | null;
  attendee_email: string | null;
  issued_at: string;
  checked_in_at: string | null;
  expires_at: string;
  qr_code_url: string | null;
  qr_code_value: string | null;
}
