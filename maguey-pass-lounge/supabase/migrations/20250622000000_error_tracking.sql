-- Error Tracking Tables
-- Stores error events and aggregated error groups for monitoring and alerting

-- Error events table (individual error occurrences)
CREATE TABLE IF NOT EXISTS error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  environment VARCHAR(20) NOT NULL,
  context JSONB DEFAULT '{}',
  tags JSONB DEFAULT '{}',
  handled BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  session_id VARCHAR(100),
  request_id VARCHAR(100),
  trace_id VARCHAR(32),
  url TEXT,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Error groups (aggregated by fingerprint)
CREATE TABLE IF NOT EXISTS error_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint VARCHAR(64) UNIQUE NOT NULL,
  message TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  affected_users INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'open',  -- open, resolved, ignored
  assigned_to TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for error_events
CREATE INDEX IF NOT EXISTS idx_error_events_fingerprint ON error_events(fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_events_created ON error_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_severity ON error_events(severity);
CREATE INDEX IF NOT EXISTS idx_error_events_service ON error_events(service_name);
CREATE INDEX IF NOT EXISTS idx_error_events_user ON error_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_events_trace ON error_events(trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_error_events_category ON error_events(category);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_error_events_service_severity ON error_events(service_name, severity);
CREATE INDEX IF NOT EXISTS idx_error_events_fingerprint_created ON error_events(fingerprint, created_at DESC);

-- Indexes for error_groups
CREATE INDEX IF NOT EXISTS idx_error_groups_status ON error_groups(status);
CREATE INDEX IF NOT EXISTS idx_error_groups_severity ON error_groups(severity);
CREATE INDEX IF NOT EXISTS idx_error_groups_last_seen ON error_groups(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_error_groups_service ON error_groups(service_name);

-- Composite index for error groups
CREATE INDEX IF NOT EXISTS idx_error_groups_status_severity ON error_groups(status, severity);

-- Function to upsert error group
CREATE OR REPLACE FUNCTION upsert_error_group(
  p_fingerprint VARCHAR(64),
  p_message TEXT,
  p_category VARCHAR(50),
  p_severity VARCHAR(20),
  p_service_name VARCHAR(100),
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_group_id UUID;
  v_affected_users INTEGER;
BEGIN
  -- Calculate affected users count
  SELECT COUNT(DISTINCT user_id) INTO v_affected_users
  FROM error_events
  WHERE fingerprint = p_fingerprint
    AND user_id IS NOT NULL;

  -- Upsert error group
  INSERT INTO error_groups (
    fingerprint,
    message,
    category,
    severity,
    service_name,
    first_seen,
    last_seen,
    occurrence_count,
    affected_users
  )
  VALUES (
    p_fingerprint,
    p_message,
    p_category,
    p_severity,
    p_service_name,
    NOW(),
    NOW(),
    1,
    COALESCE(v_affected_users, 1)
  )
  ON CONFLICT (fingerprint) DO UPDATE SET
    last_seen = NOW(),
    occurrence_count = error_groups.occurrence_count + 1,
    affected_users = GREATEST(
      error_groups.affected_users,
      COALESCE(v_affected_users, 1)
    ),
    updated_at = NOW(),
    -- Reset status to 'open' if it was resolved but error reoccurred
    status = CASE
      WHEN error_groups.status = 'resolved' THEN 'open'
      ELSE error_groups.status
    END,
    resolved_at = CASE
      WHEN error_groups.status = 'resolved' THEN NULL
      ELSE error_groups.resolved_at
    END
  RETURNING id INTO v_group_id;

  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql;

-- View for error statistics
CREATE OR REPLACE VIEW error_stats AS
SELECT
  date_trunc('hour', created_at) as hour,
  service_name,
  category,
  severity,
  COUNT(*) as error_count,
  COUNT(DISTINCT user_id) as affected_users,
  COUNT(DISTINCT fingerprint) as unique_errors
FROM error_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC;

-- View for recent error groups
CREATE OR REPLACE VIEW recent_error_groups AS
SELECT
  eg.*,
  (
    SELECT COUNT(*)
    FROM error_events ee
    WHERE ee.fingerprint = eg.fingerprint
      AND ee.created_at > NOW() - INTERVAL '1 hour'
  ) as last_hour_count,
  (
    SELECT COUNT(*)
    FROM error_events ee
    WHERE ee.fingerprint = eg.fingerprint
      AND ee.created_at > NOW() - INTERVAL '24 hours'
  ) as last_24h_count
FROM error_groups eg
WHERE eg.status = 'open'
ORDER BY eg.last_seen DESC;

-- Function to get error events by fingerprint
CREATE OR REPLACE FUNCTION get_error_events(
  p_fingerprint VARCHAR(64),
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  message TEXT,
  stack TEXT,
  severity VARCHAR(20),
  context JSONB,
  tags JSONB,
  user_id UUID,
  trace_id VARCHAR(32),
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ee.id,
    ee.message,
    ee.stack,
    ee.severity,
    ee.context,
    ee.tags,
    ee.user_id,
    ee.trace_id,
    ee.created_at
  FROM error_events ee
  WHERE ee.fingerprint = p_fingerprint
  ORDER BY ee.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE error_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_groups ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role to insert errors
CREATE POLICY "Service role can insert error events"
  ON error_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy to allow authenticated users to read errors
CREATE POLICY "Authenticated users can read error events"
  ON error_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy to allow service role to manage error groups
CREATE POLICY "Service role can manage error groups"
  ON error_groups
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy to allow authenticated users to read error groups
CREATE POLICY "Authenticated users can read error groups"
  ON error_groups
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy to allow authenticated users to update error groups
CREATE POLICY "Authenticated users can update error groups"
  ON error_groups
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
