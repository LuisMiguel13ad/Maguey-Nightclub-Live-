-- ============================================
-- SAGA EXECUTIONS TABLE
-- ============================================
-- Stores saga execution state for debugging, auditing, and potential recovery.
-- This allows tracking of distributed transactions and their compensation history.

-- Create enum for saga status
CREATE TYPE saga_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'compensating',
  'compensated',
  'compensation_failed'
);

-- Create saga_executions table
CREATE TABLE IF NOT EXISTS saga_executions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Saga identification
  saga_id TEXT NOT NULL UNIQUE,
  saga_name TEXT NOT NULL,
  
  -- Status tracking
  status saga_status NOT NULL DEFAULT 'pending',
  
  -- Step tracking
  steps_completed TEXT[] NOT NULL DEFAULT '{}',
  current_step TEXT,
  steps_compensated TEXT[] DEFAULT '{}',
  
  -- Context snapshot (for debugging/recovery)
  context_snapshot JSONB NOT NULL DEFAULT '{}',
  
  -- Input data (for replay)
  input_data JSONB,
  
  -- Error details
  error_details JSONB,
  -- Structure: { step: string, message: string, stack?: string }
  
  -- Compensation errors
  compensation_errors JSONB,
  -- Structure: [{ step: string, message: string }]
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_saga_executions_saga_name ON saga_executions(saga_name);
CREATE INDEX idx_saga_executions_status ON saga_executions(status);
CREATE INDEX idx_saga_executions_started_at ON saga_executions(started_at DESC);
CREATE INDEX idx_saga_executions_saga_id ON saga_executions(saga_id);

-- Index for finding failed sagas that need attention
CREATE INDEX idx_saga_executions_failed ON saga_executions(status) 
  WHERE status IN ('failed', 'compensation_failed');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_saga_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saga_executions_updated_at
  BEFORE UPDATE ON saga_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_saga_executions_updated_at();

-- ============================================
-- SAGA EXECUTION FUNCTIONS
-- ============================================

-- Function to create a new saga execution record
CREATE OR REPLACE FUNCTION create_saga_execution(
  p_saga_id TEXT,
  p_saga_name TEXT,
  p_input_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO saga_executions (
    saga_id,
    saga_name,
    status,
    input_data,
    started_at
  )
  VALUES (
    p_saga_id,
    p_saga_name,
    'running',
    p_input_data,
    NOW()
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update saga step completion
CREATE OR REPLACE FUNCTION update_saga_step(
  p_saga_id TEXT,
  p_step_name TEXT,
  p_context_snapshot JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE saga_executions
  SET 
    steps_completed = array_append(steps_completed, p_step_name),
    current_step = p_step_name,
    context_snapshot = COALESCE(p_context_snapshot, context_snapshot)
  WHERE saga_id = p_saga_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark saga as completed
CREATE OR REPLACE FUNCTION complete_saga_execution(
  p_saga_id TEXT,
  p_context_snapshot JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_started_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT started_at INTO v_started_at
  FROM saga_executions
  WHERE saga_id = p_saga_id;
  
  UPDATE saga_executions
  SET 
    status = 'completed',
    current_step = NULL,
    context_snapshot = COALESCE(p_context_snapshot, context_snapshot),
    completed_at = NOW(),
    duration_ms = EXTRACT(MILLISECONDS FROM (NOW() - v_started_at))::INTEGER
  WHERE saga_id = p_saga_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark saga as failed
CREATE OR REPLACE FUNCTION fail_saga_execution(
  p_saga_id TEXT,
  p_failed_step TEXT,
  p_error_message TEXT,
  p_error_stack TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_started_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT started_at INTO v_started_at
  FROM saga_executions
  WHERE saga_id = p_saga_id;
  
  UPDATE saga_executions
  SET 
    status = 'compensating',
    error_details = jsonb_build_object(
      'step', p_failed_step,
      'message', p_error_message,
      'stack', p_error_stack
    )
  WHERE saga_id = p_saga_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record compensation
CREATE OR REPLACE FUNCTION record_saga_compensation(
  p_saga_id TEXT,
  p_compensated_step TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF p_error_message IS NULL THEN
    -- Successful compensation
    UPDATE saga_executions
    SET steps_compensated = array_append(steps_compensated, p_compensated_step)
    WHERE saga_id = p_saga_id;
  ELSE
    -- Failed compensation
    UPDATE saga_executions
    SET compensation_errors = COALESCE(compensation_errors, '[]'::JSONB) || 
      jsonb_build_array(jsonb_build_object(
        'step', p_compensated_step,
        'message', p_error_message
      ))
    WHERE saga_id = p_saga_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to finalize saga after compensation
CREATE OR REPLACE FUNCTION finalize_saga_compensation(
  p_saga_id TEXT
)
RETURNS VOID AS $$
DECLARE
  v_started_at TIMESTAMP WITH TIME ZONE;
  v_has_compensation_errors BOOLEAN;
BEGIN
  SELECT 
    started_at,
    (compensation_errors IS NOT NULL AND jsonb_array_length(compensation_errors) > 0)
  INTO v_started_at, v_has_compensation_errors
  FROM saga_executions
  WHERE saga_id = p_saga_id;
  
  UPDATE saga_executions
  SET 
    status = CASE 
      WHEN v_has_compensation_errors THEN 'compensation_failed'::saga_status
      ELSE 'compensated'::saga_status
    END,
    current_step = NULL,
    completed_at = NOW(),
    duration_ms = EXTRACT(MILLISECONDS FROM (NOW() - v_started_at))::INTEGER
  WHERE saga_id = p_saga_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS FOR MONITORING
-- ============================================

-- View for saga execution summary
CREATE OR REPLACE VIEW saga_execution_summary AS
SELECT 
  saga_name,
  COUNT(*) AS total_executions,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status = 'compensated') AS compensated,
  COUNT(*) FILTER (WHERE status = 'compensation_failed') AS compensation_failed,
  COUNT(*) FILTER (WHERE status = 'running') AS running,
  AVG(duration_ms) FILTER (WHERE status = 'completed') AS avg_duration_ms,
  MAX(started_at) AS last_execution
FROM saga_executions
GROUP BY saga_name;

-- View for recent saga failures
CREATE OR REPLACE VIEW recent_saga_failures AS
SELECT 
  saga_id,
  saga_name,
  status,
  error_details->>'step' AS failed_step,
  error_details->>'message' AS error_message,
  steps_completed,
  steps_compensated,
  started_at,
  completed_at,
  duration_ms
FROM saga_executions
WHERE status IN ('failed', 'compensated', 'compensation_failed')
ORDER BY started_at DESC
LIMIT 100;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE saga_executions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to saga_executions"
  ON saga_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to view their own saga executions (via context)
CREATE POLICY "Users can view saga executions containing their data"
  ON saga_executions
  FOR SELECT
  TO authenticated
  USING (
    context_snapshot->>'purchaserEmail' = auth.jwt()->>'email'
    OR input_data->>'purchaserEmail' = auth.jwt()->>'email'
  );

-- ============================================
-- CLEANUP FUNCTION
-- ============================================

-- Function to clean up old saga executions
CREATE OR REPLACE FUNCTION cleanup_old_saga_executions(
  p_days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM saga_executions
  WHERE 
    completed_at < NOW() - (p_days_to_keep || ' days')::INTERVAL
    AND status IN ('completed', 'compensated');
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE saga_executions IS 'Stores saga execution state for distributed transaction tracking and recovery';
COMMENT ON COLUMN saga_executions.saga_id IS 'Unique identifier for the saga execution (generated by application)';
COMMENT ON COLUMN saga_executions.saga_name IS 'Name of the saga type (e.g., OrderCreation)';
COMMENT ON COLUMN saga_executions.steps_completed IS 'Array of step names that completed successfully';
COMMENT ON COLUMN saga_executions.steps_compensated IS 'Array of step names that were compensated after failure';
COMMENT ON COLUMN saga_executions.context_snapshot IS 'JSON snapshot of saga context for debugging';
COMMENT ON COLUMN saga_executions.error_details IS 'Details about the error that caused saga failure';
COMMENT ON COLUMN saga_executions.compensation_errors IS 'Errors that occurred during compensation';
