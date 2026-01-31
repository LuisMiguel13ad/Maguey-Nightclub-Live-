import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRevenueRequest {
  eventId?: string;
  startDate: string;
  endDate: string;
}

interface VerifyRevenueResponse {
  dbRevenue: number;
  stripeRevenue: number;
  hasDiscrepancy: boolean;
  discrepancyAmount: number;
  discrepancyPercent: number;
  checkedAt: string;
  breakdown?: {
    ticketRevenue: number;
    vipRevenue: number;
    stripeTransactionCount: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize clients
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Parse request body
    const body: VerifyRevenueRequest = await req.json();

    // Validate required fields
    if (!body.startDate || !body.endDate) {
      return new Response(
        JSON.stringify({ error: "startDate and endDate are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return new Response(
        JSON.stringify({ error: "Invalid date format. Use ISO 8601 format." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Convert to timestamps for Stripe API (seconds)
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    // ========================================
    // 1. Fetch database revenue
    // ========================================

    // Query tickets table for ticket revenue
    let ticketQuery = supabase
      .from("tickets")
      .select("price")
      .gte("created_at", body.startDate)
      .lte("created_at", body.endDate);

    if (body.eventId) {
      ticketQuery = ticketQuery.eq("event_id", body.eventId);
    }

    const { data: tickets, error: ticketError } = await ticketQuery;

    if (ticketError) {
      console.error("Error fetching tickets:", ticketError);
      throw new Error(`Database error: ${ticketError.message}`);
    }

    const ticketRevenue = tickets?.reduce((sum, t) => sum + (t.price || 0), 0) || 0;

    // Query vip_reservations for VIP revenue
    // Only count confirmed, checked_in, or completed reservations
    let vipQuery = supabase
      .from("vip_reservations")
      .select("amount_paid_cents")
      .in("status", ["confirmed", "checked_in", "completed"])
      .gte("created_at", body.startDate)
      .lte("created_at", body.endDate);

    if (body.eventId) {
      vipQuery = vipQuery.eq("event_id", body.eventId);
    }

    const { data: vipReservations, error: vipError } = await vipQuery;

    if (vipError) {
      console.error("Error fetching VIP reservations:", vipError);
      throw new Error(`Database error: ${vipError.message}`);
    }

    // VIP amounts are stored in cents, convert to dollars
    const vipRevenue = vipReservations?.reduce(
      (sum, v) => sum + ((v.amount_paid_cents || 0) / 100),
      0
    ) || 0;

    const dbTotalRevenue = ticketRevenue + vipRevenue;

    // ========================================
    // 2. Fetch Stripe revenue
    // ========================================

    let stripeRevenue = 0;
    let stripeTransactionCount = 0;
    let hasMore = true;
    let startingAfter: string | undefined;

    try {
      while (hasMore) {
        const params: Stripe.BalanceTransactionListParams = {
          created: { gte: startTimestamp, lte: endTimestamp },
          type: "charge",
          limit: 100,
        };

        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const transactions = await stripe.balanceTransactions.list(params);

        // Sum positive amounts (charges)
        // Note: amount is in cents
        for (const transaction of transactions.data) {
          if (transaction.amount > 0) {
            // If eventId is specified, we'd need to filter by metadata
            // However, balance transactions don't have direct event_id access
            // For now, we sum all charges in the period
            // A more precise filter would require fetching the source charge
            stripeRevenue += transaction.amount;
            stripeTransactionCount++;
          }
        }

        hasMore = transactions.has_more;
        if (transactions.data.length > 0) {
          startingAfter = transactions.data[transactions.data.length - 1].id;
        } else {
          hasMore = false;
        }
      }
    } catch (stripeError) {
      console.error("Stripe API error:", stripeError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch Stripe balance transactions",
          details: stripeError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Convert Stripe revenue from cents to dollars
    const stripeRevenueFormatted = stripeRevenue / 100;

    // ========================================
    // 3. Compare and calculate discrepancy
    // ========================================

    const discrepancyAmount = Math.abs(dbTotalRevenue - stripeRevenueFormatted);
    const discrepancyPercent = stripeRevenueFormatted > 0
      ? (discrepancyAmount / stripeRevenueFormatted) * 100
      : 0;

    // Threshold: $1.00 (per RESEARCH.md)
    const DISCREPANCY_THRESHOLD = 1.00;
    const hasDiscrepancy = discrepancyAmount > DISCREPANCY_THRESHOLD;

    const checkedAt = new Date().toISOString();

    // ========================================
    // 4. Log discrepancy if significant
    // ========================================

    if (hasDiscrepancy) {
      const { error: insertError } = await supabase
        .from("revenue_discrepancies")
        .insert({
          event_id: body.eventId || null,
          db_revenue: dbTotalRevenue,
          stripe_revenue: stripeRevenueFormatted,
          discrepancy_amount: discrepancyAmount,
          discrepancy_percent: discrepancyPercent,
          period_start: body.startDate,
          period_end: body.endDate,
          checked_at: checkedAt,
          metadata: {
            ticket_revenue: ticketRevenue,
            vip_revenue: vipRevenue,
            stripe_transaction_count: stripeTransactionCount,
          },
        });

      if (insertError) {
        console.error("Error logging discrepancy:", insertError);
        // Don't fail the request, just log the error
      } else {
        console.log("Revenue discrepancy logged:", {
          dbRevenue: dbTotalRevenue,
          stripeRevenue: stripeRevenueFormatted,
          discrepancy: discrepancyAmount,
        });
      }
    }

    // ========================================
    // 5. Return response
    // ========================================

    const response: VerifyRevenueResponse = {
      dbRevenue: Math.round(dbTotalRevenue * 100) / 100,
      stripeRevenue: Math.round(stripeRevenueFormatted * 100) / 100,
      hasDiscrepancy,
      discrepancyAmount: Math.round(discrepancyAmount * 100) / 100,
      discrepancyPercent: Math.round(discrepancyPercent * 100) / 100,
      checkedAt,
      breakdown: {
        ticketRevenue: Math.round(ticketRevenue * 100) / 100,
        vipRevenue: Math.round(vipRevenue * 100) / 100,
        stripeTransactionCount,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("verify-revenue error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
