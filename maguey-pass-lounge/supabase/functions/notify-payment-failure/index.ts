import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentFailureNotification {
  stripeEventId: string;
  stripePaymentIntentId: string;
  customerEmail: string;
  amountCents: number;
  errorMessage: string;
  paymentType: 'ga_ticket' | 'vip_reservation';
  eventId?: string;
  eventName?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const ownerEmail = Deno.env.get("OWNER_EMAIL") || "owner@maguey.com";

    const body: PaymentFailureNotification = await req.json();

    // 1. Insert into payment_failures table (creates "pending" record)
    const { data: failureRecord, error: insertError } = await supabase
      .from('payment_failures')
      .insert({
        stripe_event_id: body.stripeEventId,
        stripe_payment_intent_id: body.stripePaymentIntentId,
        customer_email: body.customerEmail,
        amount_cents: body.amountCents,
        error_message: body.errorMessage,
        payment_type: body.paymentType,
        event_id: body.eventId,
        resolved: false,
        metadata: {
          event_name: body.eventName,
          ...body.metadata,
          notified_at: new Date().toISOString(),
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert payment failure record:', insertError);
      // Continue to send email even if DB insert fails
    } else {
      console.log('Payment failure record created:', failureRecord.id);
    }

    // 2. Send email to owner via Resend
    let emailSent = false;
    if (resendApiKey) {
      const formattedAmount = (body.amountCents / 100).toFixed(2);
      const fromEmail = Deno.env.get("EMAIL_FROM_ADDRESS") || "alerts@magueynightclub.com";

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [ownerEmail],
            subject: `[ACTION REQUIRED] Payment succeeded but ticket creation failed`,
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payment Failure Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="background: #ef4444; color: white; padding: 15px; border-radius: 6px; text-align: center; margin-bottom: 30px;">
      <h2 style="margin: 0;">Payment Failure Alert</h2>
    </div>

    <p style="color: #333; font-size: 16px;">
      A customer's payment was <strong>successful</strong>, but ticket/reservation creation <strong>failed</strong>.
    </p>

    <div style="background: #fef3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #856404;">Details</h3>
      <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
        <li><strong>Customer Email:</strong> ${body.customerEmail}</li>
        <li><strong>Amount:</strong> $${formattedAmount}</li>
        <li><strong>Type:</strong> ${body.paymentType === 'ga_ticket' ? 'GA Ticket' : 'VIP Reservation'}</li>
        <li><strong>Event:</strong> ${body.eventName || body.eventId || 'Unknown'}</li>
        <li><strong>Payment Intent:</strong> ${body.stripePaymentIntentId}</li>
        <li><strong>Error:</strong> ${body.errorMessage}</li>
      </ul>
    </div>

    <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px 20px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #991b1b;">Action Required</h3>
      <p style="color: #991b1b; margin-bottom: 0;">
        Please manually create the ticket/reservation for this customer or issue a refund via Stripe Dashboard.
      </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://dashboard.stripe.com/payments/${body.stripePaymentIntentId}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 10px;">
        View in Stripe
      </a>
    </div>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px;">
      <p><strong>Failure ID:</strong> ${failureRecord?.id || 'unknown'}</p>
      <p><strong>Stripe Event ID:</strong> ${body.stripeEventId}</p>
      <p>This is an automated alert from Maguey Payment System</p>
    </div>
  </div>
</body>
</html>
            `.trim(),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to send owner notification email:', response.status, errorText);
        } else {
          console.log('Owner notification email sent successfully to:', ownerEmail);
          emailSent = true;
        }
      } catch (emailError) {
        console.error('Error sending owner notification email:', emailError);
      }
    } else {
      console.warn('No RESEND_API_KEY configured, skipping owner email notification');
    }

    return new Response(
      JSON.stringify({
        success: true,
        failureRecordId: failureRecord?.id,
        emailSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('notify-payment-failure error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
