/**
 * Example Express route for creating an order after a successful Stripe checkout.
 *
 * This handler demonstrates how to:
 * 1. Validate the Stripe checkout session server-side.
 * 2. Call the shared createOrderWithTickets() helper so the same ticket logic runs on the server.
 * 3. Return the newly issued tickets to the frontend.
 *
 * TODO:
 * - Replace placeholder environment variables with your real Stripe/Supabase credentials.
 * - Run this code in a secure server environment (Vercel serverless, Supabase Edge Function, etc.).
 * - Never expose the service role key to the browser.
 */

import type { Request, Response } from "express";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createOrderWithTickets } from "../src/lib/orders-service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2023-10-16",
});

// TODO: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your server environment.
const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export const createOrderHandler = async (req: Request, res: Response) => {
  const {
    sessionId,
    eventId,
    purchaserEmail,
    purchaserName,
    lineItems,
    metadata,
  } = req.body ?? {};

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  if (!eventId || !Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ error: "Missing event or ticket line items" });
  }

  if (!purchaserEmail || !purchaserName) {
    return res.status(400).json({ error: "Missing purchaser contact information" });
  }

  try {
    // Validate that the checkout session exists and is paid.
    // TODO: Use the same Stripe secret key that created the checkout session.
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    if (session.payment_status !== "paid") {
      return res.status(409).json({ error: "Stripe session has not been paid yet." });
    }

    const { order, ticketEmailPayloads } = await createOrderWithTickets(
      {
        eventId,
        purchaserEmail,
        purchaserName,
        lineItems,
        metadata: {
          ...metadata,
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,
        },
      },
      { client: supabase }
    );

    return res.status(200).json({
      order,
      tickets: ticketEmailPayloads,
    });
  } catch (error) {
    console.error("Failed to create order from Stripe session:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error creating order";
    return res.status(500).json({ error: message });
  }
};

export default createOrderHandler;

