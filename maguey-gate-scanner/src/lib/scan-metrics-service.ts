import { supabase } from '@/integrations/supabase/client';

export interface ScanMetrics {
  currentRate: number; // scans per minute
  todayAverage: number;
  peakRate: number;
  peakRateTime: string | null;
  avgDurationMs: number;
  totalScans: number;
}

export interface ScannerPerformance {
  user_id: string | null;
  user_email: string | null;
  total_scans: number;
  valid_scans: number;
  invalid_scans: number;
  avg_duration_ms: number | null;
  fastest_scan_ms: number | null;
  slowest_scan_ms: number | null;
  scans_per_minute: number;
  error_rate: number;
}

export interface ScanRateDataPoint {
  period_start: string;
  period_end: string;
  scans_count: number;
  scans_per_minute: number;
}

/**
 * Get current scan rate (scans per minute) for the last N minutes
 */
export const getCurrentScanRate = async (
  minutes: number = 1,
  userId?: string
): Promise<number> => {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutes * 60 * 1000);

    let query = supabase
      .from('scan_logs')
      .select('id', { count: 'exact', head: true })
      .gte('scanned_at', startTime.toISOString())
      .lte('scanned_at', endTime.toISOString())
      .in('scan_result', ['valid', 'scanned']);

    if (userId) {
      query = query.eq('scanned_by', userId);
    }

    const { count, error } = await query;

    if (error) throw error;

    return count ? count / minutes : 0;
  } catch (error) {
    console.error('getCurrentScanRate error:', error);
    return 0;
  }
};

/**
 * Get today's average scan rate
 */
export const getTodayAverageRate = async (userId?: string): Promise<number> => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let query = supabase
      .from('scan_logs')
      .select('id', { count: 'exact', head: true })
      .gte('scanned_at', todayStart.toISOString())
      .in('scan_result', ['valid', 'scanned']);

    if (userId) {
      query = query.eq('scanned_by', userId);
    }

    const { count, error } = await query;

    if (error) throw error;

    const minutesSinceMidnight = (Date.now() - todayStart.getTime()) / (60 * 1000);
    return count && minutesSinceMidnight > 0 ? count / minutesSinceMidnight : 0;
  } catch (error) {
    console.error('getTodayAverageRate error:', error);
    return 0;
  }
};

/**
 * Get peak scan rate and timestamp for today
 */
export const getPeakRate = async (userId?: string): Promise<{ rate: number; time: string | null }> => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Use database function to get scan rate over time
    const { data, error } = await supabase.rpc('get_scan_rate_over_time', {
      start_time: todayStart.toISOString(),
      end_time: new Date().toISOString(),
      interval_minutes: 15,
      user_id_param: userId || null,
      event_id_param: null,
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      return { rate: 0, time: null };
    }

    // Find peak rate
    const peak = data.reduce((max, point) => 
      point.scans_per_minute > max.scans_per_minute ? point : max
    );

    return {
      rate: Number(peak.scans_per_minute) || 0,
      time: peak.period_start,
    };
  } catch (error) {
    console.error('getPeakRate error:', error);
    return { rate: 0, time: null };
  }
};

/**
 * Get average scan duration
 */
export const getAverageDuration = async (userId?: string): Promise<number> => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let query = supabase
      .from('scan_logs')
      .select('scan_duration_ms')
      .gte('scanned_at', todayStart.toISOString())
      .not('scan_duration_ms', 'is', null);

    if (userId) {
      query = query.eq('scanned_by', userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) return 0;

    const durations = data
      .map((d) => d.scan_duration_ms)
      .filter((d): d is number => typeof d === 'number');

    return durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;
  } catch (error) {
    console.error('getAverageDuration error:', error);
    return 0;
  }
};

/**
 * Get comprehensive scan metrics
 */
export const getScanMetrics = async (userId?: string): Promise<ScanMetrics> => {
  const [currentRate, todayAverage, peakRate, avgDuration] = await Promise.all([
    getCurrentScanRate(1, userId),
    getTodayAverageRate(userId),
    getPeakRate(userId),
    getAverageDuration(userId),
  ]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let countQuery = supabase
    .from('scan_logs')
    .select('id', { count: 'exact', head: true })
    .gte('scanned_at', todayStart.toISOString())
    .in('scan_result', ['valid', 'scanned']);

  if (userId) {
    countQuery = countQuery.eq('scanned_by', userId);
  }

  const { count: totalScans } = await countQuery;

  return {
    currentRate,
    todayAverage,
    peakRate: peakRate.rate,
    peakRateTime: peakRate.time,
    avgDurationMs: avgDuration,
    totalScans: totalScans || 0,
  };
};

/**
 * Get scanner performance leaderboard
 */
export const getScannerPerformance = async (
  eventId?: string,
  startTime?: Date,
  endTime?: Date
): Promise<ScannerPerformance[]> => {
  try {
    const { data, error } = await supabase.rpc('get_scanner_performance', {
      user_id_param: null,
      event_id_param: eventId || null,
      start_time: startTime?.toISOString() || null,
      end_time: endTime?.toISOString() || null,
    });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      user_id: row.user_id,
      user_email: row.user_email,
      total_scans: Number(row.total_scans) || 0,
      valid_scans: Number(row.valid_scans) || 0,
      invalid_scans: Number(row.invalid_scans) || 0,
      avg_duration_ms: row.avg_duration_ms ? Number(row.avg_duration_ms) : null,
      fastest_scan_ms: row.fastest_scan_ms,
      slowest_scan_ms: row.slowest_scan_ms,
      scans_per_minute: Number(row.scans_per_minute) || 0,
      error_rate: Number(row.error_rate) || 0,
    }));
  } catch (error) {
    console.error('getScannerPerformance error:', error);
    return [];
  }
};

/**
 * Get scan rate over time for charting
 */
export const getScanRateOverTime = async (
  startTime: Date,
  endTime: Date,
  intervalMinutes: number = 15,
  userId?: string,
  eventId?: string
): Promise<ScanRateDataPoint[]> => {
  try {
    const { data, error } = await supabase.rpc('get_scan_rate_over_time', {
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      interval_minutes: intervalMinutes,
      user_id_param: userId || null,
      event_id_param: eventId || null,
    });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      period_start: row.period_start,
      period_end: row.period_end,
      scans_count: Number(row.scans_count) || 0,
      scans_per_minute: Number(row.scans_per_minute) || 0,
    }));
  } catch (error) {
    console.error('getScanRateOverTime error:', error);
    return [];
  }
};

/**
 * Check if scan rate is below threshold and should alert
 */
export const checkScanRateAlert = async (
  threshold: number = 10, // scans per minute
  minutes: number = 5
): Promise<{ alert: boolean; currentRate: number; threshold: number }> => {
  const currentRate = await getCurrentScanRate(minutes);
  return {
    alert: currentRate < threshold,
    currentRate,
    threshold,
  };
};

