import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { localStorageService } from '@/lib/localStorage';

export interface RefundInfo {
  isRefunded: boolean;
  refundStatus: 'none' | 'refunded' | 'voided' | 'partial_refund';
  refundedAt?: string;
  refundAmount?: number;
  refundReason?: string;
  orderId?: string;
  orderStatus?: string;
  orderRefundedAt?: string;
  paymentStatus?: string;
  paymentRefundAmount?: number;
  stripePaymentIntentId?: string;
}

/**
 * Check if a ticket is refunded or voided
 * @param ticket - Ticket object or ticket ID
 * @returns Promise<RefundInfo>
 */
export const getTicketRefundInfo = async (ticket: any): Promise<RefundInfo> => {
  if (!ticket) {
    return {
      isRefunded: false,
      refundStatus: 'none',
    };
  }

  const isConfigured = isSupabaseConfigured();

  if (isConfigured) {
    try {
      const ticketId = typeof ticket === 'string' ? ticket : ticket.id;

      // Get ticket refund status
      const ticketRefundStatus = ticket.refund_status || 'none';
      const ticketRefundedAt = ticket.refunded_at;
      const ticketRefundAmount = ticket.refund_amount ? parseFloat(ticket.refund_amount) : undefined;
      const ticketRefundReason = ticket.refund_reason;

      // Check if ticket is refunded
      const isTicketRefunded = ticketRefundStatus === 'refunded' || ticketRefundStatus === 'voided';

      // Get order and payment info if order_id exists
      let orderId: string | undefined;
      let orderStatus: string | undefined;
      let orderRefundedAt: string | undefined;
      let paymentStatus: string | undefined;
      let paymentRefundAmount: number | undefined;
      let stripePaymentIntentId: string | undefined;

      if (ticket.order_id) {
        orderId = ticket.order_id;

        // Fetch order details
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('status, refunded_at, stripe_payment_intent_id')
          .eq('id', ticket.order_id)
          .maybeSingle();

        if (!orderError && order) {
          orderStatus = order.status;
          orderRefundedAt = order.refunded_at;
          stripePaymentIntentId = order.stripe_payment_intent_id;

          // If order is refunded but ticket isn't marked, consider it refunded
          if (order.status === 'refunded' && !isTicketRefunded) {
            return {
              isRefunded: true,
              refundStatus: 'refunded',
              refundedAt: orderRefundedAt,
              orderId,
              orderStatus,
              orderRefundedAt,
              stripePaymentIntentId,
            };
          }

          // Fetch payment details
          if (order.stripe_payment_intent_id) {
            const { data: payment, error: paymentError } = await supabase
              .from('payments')
              .select('status, refund_amount')
              .eq('stripe_payment_intent_id', order.stripe_payment_intent_id)
              .maybeSingle();

            if (!paymentError && payment) {
              paymentStatus = payment.status;
              paymentRefundAmount = payment.refund_amount 
                ? parseFloat(payment.refund_amount) 
                : undefined;
            }
          }
        }
      }

      // Determine if refunded (check ticket status, order status, or payment status)
      const isRefunded = isTicketRefunded || 
                        orderStatus === 'refunded' || 
                        paymentStatus === 'refunded';

      return {
        isRefunded,
        refundStatus: isRefunded ? (ticketRefundStatus || 'refunded') : 'none',
        refundedAt: ticketRefundedAt || orderRefundedAt,
        refundAmount: ticketRefundAmount || paymentRefundAmount,
        refundReason: ticketRefundReason,
        orderId,
        orderStatus,
        orderRefundedAt,
        paymentStatus,
        paymentRefundAmount,
        stripePaymentIntentId,
      };
    } catch (error: any) {
      console.error('getTicketRefundInfo error:', error);
      return {
        isRefunded: false,
        refundStatus: 'none',
      };
    }
  } else {
    // Local storage mode
    const refundStatus = ticket.refund_status || ticket.metadata?.refund_status || 'none';
    const isRefunded = refundStatus === 'refunded' || refundStatus === 'voided';

    return {
      isRefunded,
      refundStatus: refundStatus as 'none' | 'refunded' | 'voided' | 'partial_refund',
      refundedAt: ticket.refunded_at || ticket.metadata?.refunded_at,
      refundAmount: ticket.refund_amount || ticket.metadata?.refund_amount,
      refundReason: ticket.refund_reason || ticket.metadata?.refund_reason,
    };
  }
};

/**
 * Check if ticket can be scanned (not refunded)
 * @param ticket - Ticket object
 * @returns Promise<{ allowed: boolean; reason?: string; refundInfo?: RefundInfo }>
 */
export const checkRefundBeforeScan = async (
  ticket: any
): Promise<{ allowed: boolean; reason?: string; refundInfo?: RefundInfo }> => {
  const refundInfo = await getTicketRefundInfo(ticket);

  if (refundInfo.isRefunded) {
    const refundDate = refundInfo.refundedAt 
      ? new Date(refundInfo.refundedAt).toLocaleDateString()
      : 'unknown date';
    
    const reason = refundInfo.refundStatus === 'voided'
      ? `This ticket has been voided (refunded on ${refundDate}). Entry denied.`
      : `This ticket has been refunded (refunded on ${refundDate}). Entry denied.`;

    return {
      allowed: false,
      reason,
      refundInfo,
    };
  }

  return {
    allowed: true,
    refundInfo,
  };
};

/**
 * Get Stripe payment dashboard URL for order
 * @param stripePaymentIntentId - Stripe payment intent ID
 * @returns Stripe dashboard URL or null
 */
export const getStripePaymentUrl = (stripePaymentIntentId?: string): string | null => {
  if (!stripePaymentIntentId) return null;
  
  // Stripe dashboard URL format
  // Note: This requires the Stripe account to be accessible
  // In production, you might want to use Stripe API to generate a secure link
  return `https://dashboard.stripe.com/payments/${stripePaymentIntentId}`;
};

/**
 * Mark a ticket as refunded
 * @param ticketId - Ticket ID
 * @param refundAmount - Amount refunded
 * @param refundReason - Reason for refund
 * @param refundedBy - User ID who processed refund
 * @returns Promise<{ success: boolean; error?: string }>
 */
export const markTicketAsRefunded = async (
  ticketId: string,
  refundAmount?: number,
  refundReason?: string,
  refundedBy?: string
): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase is not configured',
    };
  }

  try {
    const { error } = await supabase
      .from('tickets')
      .update({
        refund_status: 'refunded',
        refunded_at: new Date().toISOString(),
        refund_amount: refundAmount,
        refund_reason: refundReason,
        refunded_by: refundedBy,
      })
      .eq('id', ticketId);

    if (error) {
      console.error('Error marking ticket as refunded:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('markTicketAsRefunded error:', error);
    return {
      success: false,
      error: error.message || 'Failed to mark ticket as refunded',
    };
  }
};




