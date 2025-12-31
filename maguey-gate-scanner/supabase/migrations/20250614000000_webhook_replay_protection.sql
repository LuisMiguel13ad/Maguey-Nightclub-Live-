-- ============================================
-- Webhook Replay Protection Migration
-- 
-- Adds tables for webhook signature tracking and security alerting
-- ============================================

-- Webhook events table for replay protection
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_hash TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'ticket_webhook',
  source_ip TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  payload_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  CONSTRAINT unique_signature_hash UNIQUE (signature_hash)
);

-- Index for signature lookup (fast replay detection)
CREATE INDEX IF NOT EXISTS idx_webhook_events_signature 
ON webhook_events(signature_hash);

-- Index for cleanup of expired records
CREATE INDEX IF NOT EXISTS idx_webhook_events_expires 
ON webhook_events(expires_at);

-- Index for auditing by IP
CREATE INDEX IF NOT EXISTS idx_webhook_events_ip_time 
ON webhook_events(source_ip, created_at DESC);

-- Security alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  source_ip TEXT,
  event_count INTEGER,
  recent_events JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Index for querying unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_security_alerts_unacknowledged 
ON security_alerts(acknowledged, timestamp DESC)
WHERE acknowledged = FALSE;

-- Index for IP-based queries
CREATE INDEX IF NOT EXISTS idx_security_alerts_ip 
ON security_alerts(source_ip, timestamp DESC);

-- Security event logs for detailed tracking
CREATE TABLE IF NOT EXISTS security_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  source_ip TEXT,
  signature_prefix TEXT,
  request_timestamp TIMESTAMP WITH TIME ZONE,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for querying security events
CREATE INDEX IF NOT EXISTS idx_security_events_type_time 
ON security_event_logs(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_ip_time 
ON security_event_logs(source_ip, created_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to check for replay attacks
CREATE OR REPLACE FUNCTION check_webhook_replay(p_signature_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM webhook_events 
    WHERE signature_hash = p_signature_hash
    AND expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Function to record webhook signature
CREATE OR REPLACE FUNCTION record_webhook_signature(
  p_signature_hash TEXT,
  p_event_type TEXT,
  p_source_ip TEXT,
  p_timestamp TIMESTAMP WITH TIME ZONE,
  p_expires_at TIMESTAMP WITH TIME ZONE,
  p_payload_hash TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO webhook_events (
    signature_hash, event_type, source_ip, timestamp, expires_at, payload_hash
  ) VALUES (
    p_signature_hash, p_event_type, p_source_ip, p_timestamp, p_expires_at, p_payload_hash
  )
  ON CONFLICT (signature_hash) DO NOTHING
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired webhook events
CREATE OR REPLACE FUNCTION cleanup_expired_webhook_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_events WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_source_ip TEXT,
  p_signature_prefix TEXT DEFAULT NULL,
  p_request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO security_event_logs (
    event_type, source_ip, signature_prefix, request_timestamp, details
  ) VALUES (
    p_event_type, p_source_ip, p_signature_prefix, p_request_timestamp, p_details
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get security event count for an IP
CREATE OR REPLACE FUNCTION get_security_event_count(
  p_source_ip TEXT,
  p_hours INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM security_event_logs
  WHERE source_ip = p_source_ip
  AND created_at > NOW() - (p_hours || ' hours')::INTERVAL;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- View for recent security events summary
CREATE OR REPLACE VIEW security_events_summary AS
SELECT
  source_ip,
  event_type,
  COUNT(*) as event_count,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen
FROM security_event_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY source_ip, event_type
ORDER BY event_count DESC;

-- View for unacknowledged alerts
CREATE OR REPLACE VIEW unacknowledged_alerts AS
SELECT *
FROM security_alerts
WHERE acknowledged = FALSE
ORDER BY 
  CASE severity 
    WHEN 'critical' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    WHEN 'low' THEN 4 
  END,
  timestamp DESC;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_event_logs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access to webhook_events"
ON webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to security_alerts"
ON security_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to security_event_logs"
ON security_event_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can view (for admin dashboard)
CREATE POLICY "Authenticated can view webhook_events"
ON webhook_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view security_alerts"
ON security_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can view security_event_logs"
ON security_event_logs FOR SELECT TO authenticated USING (true);

-- Authenticated users can update alerts (acknowledge)
CREATE POLICY "Authenticated can update security_alerts"
ON security_alerts FOR UPDATE TO authenticated 
USING (true) WITH CHECK (true);

-- ============================================
-- GRANTS
-- ============================================

GRANT SELECT ON security_events_summary TO authenticated;
GRANT SELECT ON unacknowledged_alerts TO authenticated;
GRANT EXECUTE ON FUNCTION check_webhook_replay TO service_role;
GRANT EXECUTE ON FUNCTION record_webhook_signature TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_webhook_events TO service_role;
GRANT EXECUTE ON FUNCTION log_security_event TO service_role;
GRANT EXECUTE ON FUNCTION get_security_event_count TO service_role;
