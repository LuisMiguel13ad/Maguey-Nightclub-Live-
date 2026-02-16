import { supabase } from './supabase';

export interface ScanVelocityMetrics {
  id: string;
  event_id: string;
  period_start: string;
  period_end: string;
  scan_count: number;
  scans_per_minute: number;
  avg_scan_duration_ms: number | null;
  active_scanners: number;
  estimated_queue_depth: number;
  entry_point_id: string | null;
  ticket_type_mix: Record<string, number> | null;
  created_at: string;
}

export interface CurrentVelocity {
  scans_per_minute: number;
  avg_scan_duration_ms: number | null;
  active_scanners: number;
  scan_count: number;
}

export interface HistoricalPattern {
  hour_of_day: number;
  day_of_week: number;
  avg_scans_per_minute: number;
  avg_queue_depth: number;
  sample_count: number;
}

/**
 * Calculate current scan velocity for an event
 */
export const calculateCurrentScanVelocity = async (
  eventId: string,
  minutesBack: number = 5,
  entryPointId?: string
): Promise<CurrentVelocity | null> => {
  try {
    const { data, error } = await supabase.rpc('calculate_current_scan_velocity', {
      event_id_param: eventId,
      minutes_back: minutesBack,
      entry_point_id_param: entryPointId || null,
    });

    if (error) {
      console.error('Error calculating scan velocity:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return {
        scans_per_minute: 0,
        avg_scan_duration_ms: null,
        active_scanners: 0,
        scan_count: 0,
      };
    }

    return data[0] as CurrentVelocity;
  } catch (error) {
    console.error('Exception calculating scan velocity:', error);
    return null;
  }
};

/**
 * Estimate current queue depth (tickets waiting)
 */
export const estimateQueueDepth = async (
  eventId: string,
  entryPointId?: string
): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('estimate_queue_depth', {
      event_id_param: eventId,
      entry_point_id_param: entryPointId || null,
    });

    if (error) {
      console.error('Error estimating queue depth:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('Exception estimating queue depth:', error);
    return 0;
  }
};

/**
 * Record velocity metrics for a time period
 * This should be called periodically (e.g., every minute) by a background job
 */
export const recordVelocityMetrics = async (
  eventId: string,
  periodStart: Date,
  periodEnd: Date,
  entryPointId?: string
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('record_velocity_metrics', {
      event_id_param: eventId,
      period_start_param: periodStart.toISOString(),
      period_end_param: periodEnd.toISOString(),
      entry_point_id_param: entryPointId || null,
    });

    if (error) {
      console.error('Error recording velocity metrics:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception recording velocity metrics:', error);
    return null;
  }
};

/**
 * Get historical velocity patterns for predictive analytics
 */
export const getHistoricalVelocityPatterns = async (
  eventId: string,
  daysBack: number = 30,
  entryPointId?: string
): Promise<HistoricalPattern[]> => {
  try {
    const { data, error } = await supabase.rpc('get_historical_velocity_patterns', {
      event_id_param: eventId,
      days_back: daysBack,
      entry_point_id_param: entryPointId || null,
    });

    if (error) {
      console.error('Error getting historical patterns:', error);
      return [];
    }

    return (data || []) as HistoricalPattern[];
  } catch (error) {
    console.error('Exception getting historical patterns:', error);
    return [];
  }
};

/**
 * Get velocity metrics for a time range
 */
export const getVelocityMetrics = async (
  eventId: string,
  startTime: Date,
  endTime: Date,
  entryPointId?: string
): Promise<ScanVelocityMetrics[]> => {
  try {
    let query = supabase
      .from('scan_velocity_metrics')
      .select('*')
      .eq('event_id', eventId)
      .gte('period_start', startTime.toISOString())
      .lte('period_end', endTime.toISOString())
      .order('period_start', { ascending: true });

    if (entryPointId) {
      query = query.eq('entry_point_id', entryPointId);
    } else {
      query = query.is('entry_point_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting velocity metrics:', error);
      return [];
    }

    return (data || []) as ScanVelocityMetrics[];
  } catch (error) {
    console.error('Exception getting velocity metrics:', error);
    return [];
  }
};

/**
 * Get latest velocity metrics for an event
 */
export const getLatestVelocityMetrics = async (
  eventId: string,
  entryPointId?: string
): Promise<ScanVelocityMetrics | null> => {
  try {
    let query = supabase
      .from('scan_velocity_metrics')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (entryPointId) {
      query = query.eq('entry_point_id', entryPointId);
    } else {
      query = query.is('entry_point_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting latest velocity metrics:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as ScanVelocityMetrics;
  } catch (error) {
    console.error('Exception getting latest velocity metrics:', error);
    return null;
  }
};

/**
 * Start periodic metrics collection for an event
 * This sets up a background job to record metrics every minute
 */
export const startMetricsCollection = (
  eventId: string,
  entryPointId?: string,
  intervalMs: number = 60000 // 1 minute
): (() => void) => {
  let intervalId: number | null = null;
  let isRunning = false;

  const collectMetrics = async () => {
    if (isRunning) return; // Prevent overlapping calls
    isRunning = true;

    try {
      const periodEnd = new Date();
      const periodStart = new Date(periodEnd.getTime() - intervalMs);

      await recordVelocityMetrics(eventId, periodStart, periodEnd, entryPointId);
    } catch (error) {
      console.error('Error in metrics collection:', error);
    } finally {
      isRunning = false;
    }
  };

  // Start collection
  intervalId = window.setInterval(collectMetrics, intervalMs);
  
  // Initial collection
  collectMetrics();

  // Return cleanup function
  return () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
};

