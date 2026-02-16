-- ============================================
-- Query Optimization Migration (FIXED v3)
-- ============================================

-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
CREATE INDEX IF NOT EXISTS idx_orders_event_created 
ON orders(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_email_created 
ON orders(purchaser_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_event 
ON orders(status, event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_order_event 
ON tickets(order_id, event_id);

CREATE INDEX IF NOT EXISTS idx_tickets_type_status 
ON tickets(ticket_type_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_qr_token 
ON tickets(qr_token) 
WHERE qr_token IS NOT NULL;

-- PARTIAL INDEXES FOR ACTIVE RECORDS ONLY
CREATE INDEX IF NOT EXISTS idx_tickets_status_event_active 
ON tickets(status, event_id) 
WHERE status IN ('issued', 'scanned', 'used');

-- COVERING INDEXES
CREATE INDEX IF NOT EXISTS idx_ticket_types_event_covering 
ON ticket_types(event_id) 
INCLUDE (name, price, total_inventory, tickets_sold, fee);

CREATE INDEX IF NOT EXISTS idx_orders_listing_covering 
ON orders(created_at DESC) 
INCLUDE (purchaser_email, purchaser_name, total, status, event_id);

-- TICKET EVENTS INDEXES
CREATE INDEX IF NOT EXISTS idx_ticket_events_aggregate_seq 
ON ticket_events(aggregate_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_ticket_events_correlation 
ON ticket_events(correlation_id) 
WHERE correlation_id IS NOT NULL;

-- EXPRESSION INDEX
CREATE INDEX IF NOT EXISTS idx_orders_email_lower 
ON orders(LOWER(purchaser_email));

-- SLOW QUERY LOGGING TABLE
CREATE TABLE IF NOT EXISTS query_performance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_hash TEXT NOT NULL,
  query_text TEXT NOT NULL,
  duration_ms NUMERIC NOT NULL,
  rows_returned INTEGER,
  rows_examined INTEGER,
  index_used TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  context JSONB DEFAULT '{}',
  user_id UUID,
  session_id TEXT,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_query_perf_duration 
ON query_performance_logs(duration_ms DESC, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_query_perf_occurred 
ON query_performance_logs(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_query_perf_hash 
ON query_performance_logs(query_hash, occurred_at DESC);

-- INDEX USAGE STATISTICS VIEW (fixed column names)
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
  schemaname,
  relname AS tablename,
  indexrelname AS indexname,
  idx_scan AS times_used,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  CASE 
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 100 THEN 'LOW_USAGE'
    WHEN idx_scan < 1000 THEN 'MODERATE'
    ELSE 'HIGH_USAGE'
  END AS usage_category
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- SLOW QUERY SUMMARY VIEW
CREATE OR REPLACE VIEW slow_query_summary AS
SELECT
  query_hash,
  LEFT(query_text, 100) AS query_preview,
  COUNT(*) AS execution_count,
  ROUND(AVG(duration_ms)::numeric, 2) AS avg_duration_ms,
  ROUND(MAX(duration_ms)::numeric, 2) AS max_duration_ms,
  ROUND(MIN(duration_ms)::numeric, 2) AS min_duration_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) AS p95_duration_ms,
  MAX(occurred_at) AS last_occurred,
  source
FROM query_performance_logs
WHERE occurred_at > NOW() - INTERVAL '24 hours'
GROUP BY query_hash, LEFT(query_text, 100), source
ORDER BY avg_duration_ms DESC;

-- FUNCTION TO LOG SLOW QUERIES
CREATE OR REPLACE FUNCTION log_slow_query(
  p_query_text TEXT,
  p_duration_ms NUMERIC,
  p_rows_returned INTEGER DEFAULT NULL,
  p_rows_examined INTEGER DEFAULT NULL,
  p_index_used TEXT DEFAULT NULL,
  p_context JSONB DEFAULT '{}',
  p_source TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_query_hash TEXT;
  v_log_id UUID;
BEGIN
  v_query_hash := MD5(REGEXP_REPLACE(p_query_text, '\s+', ' ', 'g'));
  
  INSERT INTO query_performance_logs (
    query_hash, query_text, duration_ms,
    rows_returned, rows_examined, index_used, context, source
  ) VALUES (
    v_query_hash, p_query_text, p_duration_ms,
    p_rows_returned, p_rows_examined, p_index_used, p_context, p_source
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- CLEANUP FUNCTION
CREATE OR REPLACE FUNCTION cleanup_old_query_logs(days_to_keep INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM query_performance_logs
  WHERE occurred_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- RLS POLICIES
ALTER TABLE query_performance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert query logs"
ON query_performance_logs FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Authenticated can view query logs"
ON query_performance_logs FOR SELECT TO authenticated USING (true);

-- UPDATE STATISTICS
ANALYZE events;
ANALYZE orders;
ANALYZE tickets;
ANALYZE ticket_types;

-- GRANT PERMISSIONS
GRANT SELECT ON index_usage_stats TO authenticated;
GRANT SELECT ON slow_query_summary TO authenticated;
GRANT EXECUTE ON FUNCTION log_slow_query TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_query_logs TO service_role;