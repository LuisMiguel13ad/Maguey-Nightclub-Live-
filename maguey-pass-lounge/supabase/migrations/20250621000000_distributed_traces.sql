-- Distributed Traces Table
-- Stores spans for distributed tracing analysis

CREATE TABLE IF NOT EXISTS traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id VARCHAR(32) NOT NULL,
  span_id VARCHAR(16) NOT NULL,
  parent_span_id VARCHAR(16),
  service_name VARCHAR(100) NOT NULL,
  span_name VARCHAR(255) NOT NULL,
  span_kind VARCHAR(20) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_ms INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN end_time IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (end_time - start_time)) * 1000
      ELSE NULL
    END
  ) STORED,
  status VARCHAR(20) DEFAULT 'unset',
  status_message TEXT,
  attributes JSONB DEFAULT '{}',
  events JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(trace_id, span_id)
);

-- Indexes for trace queries
CREATE INDEX IF NOT EXISTS idx_traces_trace_id ON traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_traces_service ON traces(service_name);
CREATE INDEX IF NOT EXISTS idx_traces_start_time ON traces(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_traces_duration ON traces(duration_ms DESC) WHERE duration_ms IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_traces_status ON traces(status) WHERE status = 'error';
CREATE INDEX IF NOT EXISTS idx_traces_parent_span ON traces(parent_span_id) WHERE parent_span_id IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_traces_trace_service ON traces(trace_id, service_name);
CREATE INDEX IF NOT EXISTS idx_traces_service_time ON traces(service_name, start_time DESC);

-- View for trace summaries
CREATE OR REPLACE VIEW trace_summaries AS
SELECT 
  trace_id,
  MIN(start_time) as trace_start,
  MAX(end_time) as trace_end,
  COUNT(*) as span_count,
  COUNT(DISTINCT service_name) as service_count,
  array_agg(DISTINCT service_name) as services,
  SUM(duration_ms) as total_duration_ms,
  AVG(duration_ms) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  bool_or(status = 'error') as has_errors,
  COUNT(*) FILTER (WHERE status = 'error') as error_count
FROM traces
WHERE end_time IS NOT NULL
GROUP BY trace_id;

-- Function to get full trace tree
CREATE OR REPLACE FUNCTION get_trace_tree(p_trace_id VARCHAR(32))
RETURNS TABLE (
  span_id VARCHAR(16),
  parent_span_id VARCHAR(16),
  service_name VARCHAR(100),
  span_name VARCHAR(255),
  duration_ms INTEGER,
  status VARCHAR(20),
  depth INTEGER,
  start_time TIMESTAMPTZ
) AS $$
WITH RECURSIVE trace_tree AS (
  -- Root spans (no parent)
  SELECT 
    span_id, 
    parent_span_id, 
    service_name, 
    span_name, 
    duration_ms, 
    status,
    start_time,
    0 as depth
  FROM traces
  WHERE trace_id = p_trace_id AND parent_span_id IS NULL
  
  UNION ALL
  
  -- Child spans
  SELECT 
    t.span_id, 
    t.parent_span_id, 
    t.service_name, 
    t.span_name, 
    t.duration_ms, 
    t.status,
    t.start_time,
    tt.depth + 1
  FROM traces t
  JOIN trace_tree tt ON t.parent_span_id = tt.span_id
  WHERE t.trace_id = p_trace_id
)
SELECT * FROM trace_tree ORDER BY depth, start_time;
$$ LANGUAGE SQL;

-- Function to get slow traces
CREATE OR REPLACE FUNCTION get_slow_traces(
  p_min_duration_ms INTEGER DEFAULT 1000,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  trace_id VARCHAR(32),
  total_duration_ms INTEGER,
  span_count BIGINT,
  services TEXT[],
  has_errors BOOLEAN,
  trace_start TIMESTAMPTZ
) AS $$
SELECT 
  trace_id,
  total_duration_ms,
  span_count,
  services,
  has_errors,
  trace_start
FROM trace_summaries
WHERE total_duration_ms >= p_min_duration_ms
ORDER BY total_duration_ms DESC
LIMIT p_limit;
$$ LANGUAGE SQL;

-- Function to get error traces
CREATE OR REPLACE FUNCTION get_error_traces(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  trace_id VARCHAR(32),
  error_count BIGINT,
  total_duration_ms INTEGER,
  span_count BIGINT,
  services TEXT[],
  trace_start TIMESTAMPTZ
) AS $$
SELECT 
  trace_id,
  error_count,
  total_duration_ms,
  span_count,
  services,
  trace_start
FROM trace_summaries
WHERE has_errors = true
ORDER BY trace_start DESC
LIMIT p_limit;
$$ LANGUAGE SQL;

-- Enable Row Level Security (optional, adjust based on your needs)
ALTER TABLE traces ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role to insert traces
CREATE POLICY "Service role can insert traces"
  ON traces
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy to allow authenticated users to read traces (adjust as needed)
CREATE POLICY "Authenticated users can read traces"
  ON traces
  FOR SELECT
  TO authenticated
  USING (true);
