import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

// ============================================================================
// Cancel Event with Bulk Refunds
// ============================================================================
// Owner-initiated event cancellation
// - Validates event can be cancelled (hasn't started)
// - Refunds all VIP reservations via Stripe
// - Updates reservation statuses to cancelled
// - Resets event_vip_tables to available
// - Updates event status to cancelled
//
// Part of Phase 4 (VIP System Reliability) - Wave 2
// ============================================================================

interface CancellationRequest {
  eventId: string;
  cancelledBy: string;
  cancellationReason?: string;
}

interface RefundResult {
  reservationId: string;
  purchaserEmail: string;
  tableNumber: number;
  amountCents: number;
  refundId?: string;
  success: boolean;
  error?: string;
}

interface CancellationResult {
  success: boolean;
  eventId: string;
  cancelledAt: string;
  refundSummary: {
    total: number;
    successful: number;
    failed: number;
    totalRefundedCents: number;
  };
  refundDetails: RefundResult[];
  error?: string;
}

serve(async (req) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Initialize Stripe client
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Parse request body
    const { eventId, cancelledBy, cancellationReason }: CancellationRequest = await req.json();

    if (!eventId || !cancelledBy) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: eventId, cancelledBy" }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Processing cancellation request for event: ${eventId}`);

    // Step 1: Validate event can be cancelled
    const { data: validationData, error: validationError } = await supabase
      .rpc("can_cancel_event", { p_event_id: eventId })
      .single();

    if (validationError) {
      console.error("Validation error:", validationError);
      return new Response(
        JSON.stringify({ error: `Validation failed: ${validationError.message}` }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    if (!validationData.can_cancel) {
      console.log(`Event cannot be cancelled: ${validationData.reason}`);
      return new Response(
        JSON.stringify({
          error: validationData.reason,
          eventDate: validationData.event_date,
          eventTime: validationData.event_time,
          eventStatus: validationData.event_status,
        }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Event can be cancelled. Found ${validationData.refundable_count} refundable reservations`);
    console.log(`Total refund amount: $${(validationData.total_refund_cents / 100).toFixed(2)}`);

    // Step 2: Get all refundable reservations
    const { data: reservations, error: reservationsError } = await supabase
      .rpc("get_event_refundable_reservations", { p_event_id: eventId });

    if (reservationsError) {
      console.error("Error fetching reservations:", reservationsError);
      return new Response(
        JSON.stringify({ error: `Failed to fetch reservations: ${reservationsError.message}` }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    const refundResults: RefundResult[] = [];
    let successfulRefunds = 0;
    let failedRefunds = 0;
    let totalRefundedCents = 0;

    // Step 3: Process refunds for each reservation
    for (const reservation of (reservations || [])) {
      const result: RefundResult = {
        reservationId: reservation.reservation_id,
        purchaserEmail: reservation.purchaser_email,
        tableNumber: reservation.table_number,
        amountCents: reservation.amount_paid_cents,
        success: false,
      };

      try {
        console.log(`Processing refund for reservation ${reservation.reservation_id} (Table ${reservation.table_number})`);

        // Create Stripe refund
        const refund = await stripe.refunds.create({
          payment_intent: reservation.stripe_payment_intent_id,
          reason: "requested_by_customer",
          metadata: {
            event_id: eventId,
            reservation_id: reservation.reservation_id,
            cancelled_by: cancelledBy,
            cancellation_reason: cancellationReason || "Event cancelled by owner",
          },
        });

        result.refundId = refund.id;
        result.success = true;
        successfulRefunds++;
        totalRefundedCents += reservation.amount_paid_cents;

        console.log(`Refund created: ${refund.id} for $${(reservation.amount_paid_cents / 100).toFixed(2)}`);

        // Step 4: Update reservation status to cancelled with refund details
        const { error: updateError } = await supabase
          .from("vip_reservations")
          .update({
            status: "cancelled",
            refund_id: refund.id,
            refunded_at: new Date().toISOString(),
            cancellation_reason: cancellationReason || "Event cancelled by owner",
            cancelled_by: cancelledBy,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reservation.reservation_id);

        if (updateError) {
          console.error(`Failed to update reservation ${reservation.reservation_id}:`, updateError);
          result.error = `Refund created but failed to update reservation: ${updateError.message}`;
        }
      } catch (error) {
        console.error(`Failed to process refund for reservation ${reservation.reservation_id}:`, error);
        result.error = error.message || "Unknown error";
        result.success = false;
        failedRefunds++;
      }

      refundResults.push(result);
    }

    // Step 5: Reset event_vip_tables to available
    const { error: tablesError } = await supabase
      .from("event_vip_tables")
      .update({
        is_available: true,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);

    if (tablesError) {
      console.error("Error resetting table availability:", tablesError);
    } else {
      console.log("All tables reset to available");
    }

    // Step 6: Update event status to cancelled
    const { error: eventUpdateError } = await supabase
      .from("events")
      .update({
        cancellation_status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy,
        cancellation_reason: cancellationReason || "Event cancelled with full refunds",
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    if (eventUpdateError) {
      console.error("Error updating event status:", eventUpdateError);
      return new Response(
        JSON.stringify({
          error: `Refunds processed but failed to update event: ${eventUpdateError.message}`,
          refundSummary: {
            total: refundResults.length,
            successful: successfulRefunds,
            failed: failedRefunds,
            totalRefundedCents,
          },
          refundDetails: refundResults,
        }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Step 7: Return detailed results
    const result: CancellationResult = {
      success: true,
      eventId,
      cancelledAt: new Date().toISOString(),
      refundSummary: {
        total: refundResults.length,
        successful: successfulRefunds,
        failed: failedRefunds,
        totalRefundedCents,
      },
      refundDetails: refundResults,
    };

    console.log(`Event cancellation complete. ${successfulRefunds}/${refundResults.length} refunds successful`);
    console.log(`Total refunded: $${(totalRefundedCents / 100).toFixed(2)}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Event cancellation error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Unknown error",
        success: false,
      }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
