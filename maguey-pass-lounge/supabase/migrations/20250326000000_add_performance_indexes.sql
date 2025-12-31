BEGIN;

CREATE INDEX IF NOT EXISTS idx_tickets_event_status
ON tickets(event_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_order_status
ON tickets(order_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_type_status_inventory
ON tickets(ticket_type_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_event_issued
ON tickets(event_id)
WHERE status = 'issued';

CREATE INDEX IF NOT EXISTS idx_tickets_qr_token_active
ON tickets(qr_token)
WHERE status IN ('issued', 'scanned', 'used');

CREATE INDEX IF NOT EXISTS idx_tickets_type_sold
ON tickets(ticket_type_id)
WHERE status IN ('issued', 'used', 'scanned');

CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type
ON tickets(ticket_type_id);

CREATE INDEX IF NOT EXISTS idx_tickets_attendee_email
ON tickets(attendee_email)
WHERE attendee_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_email_status
ON orders(purchaser_email, status);

CREATE INDEX IF NOT EXISTS idx_orders_event_status_created
ON orders(event_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_event_paid
ON orders(event_id)
WHERE status = 'paid';

CREATE INDEX IF NOT EXISTS idx_orders_user
ON orders(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_created
ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_types_event
ON ticket_types(event_id);

CREATE INDEX IF NOT EXISTS idx_events_status
ON events(status);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON payments(stripe_payment_intent_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scan_logs' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_scan_logs_ticket_scanned ON scan_logs(ticket_id, scanned_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_scan_logs_ticket ON scan_logs(ticket_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_idempotency' AND table_schema = 'public') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_webhook_idempotency_lookup ON webhook_idempotency(idempotency_key, webhook_type)';
  END IF;
END $$;

COMMIT;