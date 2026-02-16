-- Add trace_id column to scan_logs table for distributed tracing correlation

-- Add trace_id column (nullable, as existing records won't have it)
ALTER TABLE scan_logs 
ADD COLUMN IF NOT EXISTS trace_id VARCHAR(32);

-- Add index for trace_id lookups
CREATE INDEX IF NOT EXISTS idx_scan_logs_trace_id ON scan_logs(trace_id) WHERE trace_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN scan_logs.trace_id IS 'Distributed trace ID for correlating scans with order creation and other operations';

-- Create a view to join scan logs with traces
CREATE OR REPLACE VIEW scan_logs_with_traces AS
SELECT 
  sl.*,
  t.trace_id as full_trace_id,
  ts.total_duration_ms as trace_duration_ms,
  ts.span_count as trace_span_count,
  ts.has_errors as trace_has_errors
FROM scan_logs sl
LEFT JOIN traces t ON sl.trace_id = t.trace_id
LEFT JOIN trace_summaries ts ON sl.trace_id = ts.trace_id;

-- Function to get scan logs by trace ID
CREATE OR REPLACE FUNCTION get_scan_logs_by_trace(p_trace_id VARCHAR(32))
RETURNS TABLE (
  id UUID,
  ticket_id UUID,
  scan_result VARCHAR(50),
  scanned_at TIMESTAMPTZ,
  scanned_by VARCHAR(255),
  scan_duration_ms INTEGER,
  scan_method VARCHAR(20),
  trace_id VARCHAR(32)
) AS $$
SELECT 
  id,
  ticket_id,
  scan_result,
  scanned_at,
  scanned_by,
  scan_duration_ms,
  scan_method,
  trace_id
FROM scan_logs
WHERE trace_id = p_trace_id
ORDER BY scanned_at DESC;
$$ LANGUAGE SQL;
