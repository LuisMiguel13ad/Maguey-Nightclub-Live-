import { supabase } from './supabase';
import { calculateCurrentScanVelocity, estimateQueueDepth, getLatestVelocityMetrics } from './queue-metrics-service';
import { predictWaitTime, getLatestWaitTimePrediction } from './queue-prediction-service';

export interface EntryPoint {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffingRecommendation {
  current_scanners: number;
  recommended_scanners: number;
  reason: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimated_wait_time: number;
  queue_depth: number;
}

export interface LoadBalanceInfo {
  entry_point_id: string;
  entry_point_name: string;
  current_wait_minutes: number;
  queue_depth: number;
  active_scanners: number;
  scans_per_minute: number;
}

/**
 * Get all entry points for an event
 */
export const getEntryPoints = async (eventId: string): Promise<EntryPoint[]> => {
  try {
    const { data, error } = await supabase
      .from('entry_points')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error getting entry points:', error);
      return [];
    }

    return (data || []) as EntryPoint[];
  } catch (error) {
    console.error('Exception getting entry points:', error);
    return [];
  }
};

/**
 * Create a new entry point
 */
export const createEntryPoint = async (
  eventId: string,
  name: string,
  description?: string
): Promise<EntryPoint | null> => {
  try {
    const { data, error } = await supabase
      .from('entry_points')
      .insert({
        event_id: eventId,
        name,
        description: description || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating entry point:', error);
      return null;
    }

    return data as EntryPoint;
  } catch (error) {
    console.error('Exception creating entry point:', error);
    return null;
  }
};

/**
 * Get staffing recommendation based on current metrics
 */
export const getStaffingRecommendation = async (
  eventId: string,
  entryPointId?: string
): Promise<StaffingRecommendation | null> => {
  try {
    // Get current metrics
    const velocity = await calculateCurrentScanVelocity(eventId, 5, entryPointId);
    const queueDepth = await estimateQueueDepth(eventId, entryPointId);
    const prediction = await getLatestWaitTimePrediction(eventId, entryPointId);

    if (!velocity) {
      return null;
    }

    const currentScanners = velocity.active_scanners || 1;
    const scansPerMinute = velocity.scans_per_minute || 0;
    const waitTime = prediction?.predicted_wait_minutes || 0;

    // Calculate recommended scanners based on queue depth and target wait time
    const targetWaitMinutes = 5; // Target wait time in minutes
    const targetScansPerMinute = queueDepth / targetWaitMinutes;
    const scansPerScannerPerMinute = scansPerMinute / Math.max(1, currentScanners);
    const recommendedScanners = Math.ceil(targetScansPerMinute / Math.max(1, scansPerScannerPerMinute));

    // Determine urgency
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let reason = '';

    if (waitTime > 15 || queueDepth > 100) {
      urgency = 'critical';
      reason = `High wait time (${waitTime} min) and large queue (${queueDepth} tickets)`;
    } else if (waitTime > 10 || queueDepth > 50) {
      urgency = 'high';
      reason = `Elevated wait time (${waitTime} min) or queue depth (${queueDepth} tickets)`;
    } else if (waitTime > 5 || queueDepth > 25) {
      urgency = 'medium';
      reason = `Moderate wait time (${waitTime} min) or queue depth (${queueDepth} tickets)`;
    } else {
      urgency = 'low';
      reason = 'Current staffing appears adequate';
    }

    return {
      current_scanners: currentScanners,
      recommended_scanners: Math.max(1, recommendedScanners),
      reason,
      urgency,
      estimated_wait_time: waitTime,
      queue_depth: queueDepth,
    };
  } catch (error) {
    console.error('Exception getting staffing recommendation:', error);
    return null;
  }
};

/**
 * Get load balance information across all entry points
 */
export const getLoadBalanceInfo = async (eventId: string): Promise<LoadBalanceInfo[]> => {
  try {
    const entryPoints = await getEntryPoints(eventId);

    // If no entry points, return single entry point info
    if (entryPoints.length === 0) {
      const velocity = await calculateCurrentScanVelocity(eventId);
      const queueDepth = await estimateQueueDepth(eventId);
      const prediction = await getLatestWaitTimePrediction(eventId);

      return [
        {
          entry_point_id: '',
          entry_point_name: 'Main Entry',
          current_wait_minutes: prediction?.predicted_wait_minutes || 0,
          queue_depth: queueDepth,
          active_scanners: velocity?.active_scanners || 0,
          scans_per_minute: velocity?.scans_per_minute || 0,
        },
      ];
    }

    // Get info for each entry point
    const loadInfo: LoadBalanceInfo[] = [];

    for (const entryPoint of entryPoints) {
      const velocity = await calculateCurrentScanVelocity(eventId, 5, entryPoint.id);
      const queueDepth = await estimateQueueDepth(eventId, entryPoint.id);
      const prediction = await getLatestWaitTimePrediction(eventId, entryPoint.id);

      loadInfo.push({
        entry_point_id: entryPoint.id,
        entry_point_name: entryPoint.name,
        current_wait_minutes: prediction?.predicted_wait_minutes || 0,
        queue_depth: queueDepth,
        active_scanners: velocity?.active_scanners || 0,
        scans_per_minute: velocity?.scans_per_minute || 0,
      });
    }

    return loadInfo.sort((a, b) => a.current_wait_minutes - b.current_wait_minutes);
  } catch (error) {
    console.error('Exception getting load balance info:', error);
    return [];
  }
};

/**
 * Suggest optimal entry point for a guest
 */
export const suggestOptimalEntryPoint = async (eventId: string): Promise<string | null> => {
  try {
    const loadInfo = await getLoadBalanceInfo(eventId);

    if (loadInfo.length === 0) {
      return null;
    }

    // Return entry point with shortest wait time
    const optimal = loadInfo.reduce((prev, current) =>
      current.current_wait_minutes < prev.current_wait_minutes ? current : prev
    );

    return optimal.entry_point_id || null;
  } catch (error) {
    console.error('Exception suggesting optimal entry point:', error);
    return null;
  }
};

/**
 * Check if additional scanners are needed and return alert
 */
export const checkScannerNeeds = async (
  eventId: string,
  entryPointId?: string
): Promise<{
  needsMoreScanners: boolean;
  currentScanners: number;
  recommendedScanners: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  message: string;
} | null> => {
  try {
    const recommendation = await getStaffingRecommendation(eventId, entryPointId);

    if (!recommendation) {
      return null;
    }

    const needsMore = recommendation.recommended_scanners > recommendation.current_scanners;

    return {
      needsMoreScanners: needsMore,
      currentScanners: recommendation.current_scanners,
      recommendedScanners: recommendation.recommended_scanners,
      urgency: recommendation.urgency,
      message: recommendation.reason,
    };
  } catch (error) {
    console.error('Exception checking scanner needs:', error);
    return null;
  }
};

/**
 * Get capacity fill rate forecast
 */
export const getCapacityFillRateForecast = async (
  eventId: string,
  hoursAhead: number = 2
): Promise<{
  currentCapacity: number;
  forecastCapacity: number;
  fillRate: number;
  estimatedFullTime: Date | null;
} | null> => {
  try {
    // Get event capacity
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('venue_capacity')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      console.error('Error getting event:', eventError);
      return null;
    }

    const totalCapacity = event.venue_capacity;

    // Get current scanned count
    const { data: scannedCount, error: scanError } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'scanned');

    if (scanError) {
      console.error('Error getting scanned count:', scanError);
      return null;
    }

    const currentScanned = scannedCount || 0;
    const currentCapacity = (currentScanned / totalCapacity) * 100;

    // Get current scan velocity
    const velocity = await calculateCurrentScanVelocity(eventId);
    const scansPerMinute = velocity?.scans_per_minute || 0;

    // Forecast
    const scansInHours = scansPerMinute * 60 * hoursAhead;
    const forecastScanned = currentScanned + scansInHours;
    const forecastCapacity = Math.min(100, (forecastScanned / totalCapacity) * 100);

    // Estimate when capacity will be full
    let estimatedFullTime: Date | null = null;
    if (scansPerMinute > 0 && currentScanned < totalCapacity) {
      const remainingScans = totalCapacity - currentScanned;
      const minutesToFull = remainingScans / scansPerMinute;
      estimatedFullTime = new Date(Date.now() + minutesToFull * 60 * 1000);
    }

    return {
      currentCapacity,
      forecastCapacity,
      fillRate: scansPerMinute,
      estimatedFullTime,
    };
  } catch (error) {
    console.error('Exception getting capacity forecast:', error);
    return null;
  }
};

