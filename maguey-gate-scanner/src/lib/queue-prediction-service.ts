import { supabase } from './supabase';
import { calculateCurrentScanVelocity, estimateQueueDepth, getHistoricalVelocityPatterns } from './queue-metrics-service';

export interface WaitTimePrediction {
  id: string;
  event_id: string;
  prediction_time: string;
  predicted_wait_minutes: number;
  actual_wait_minutes: number | null;
  confidence_score: number;
  factors: {
    current_velocity?: number;
    avg_scan_duration_ms?: number;
    active_scanners?: number;
    queue_depth?: number;
    historical_avg_velocity?: number;
    time_of_day_factor?: number;
    day_of_week_factor?: number;
    entry_point_id?: string;
  };
  entry_point_id: string | null;
  created_at: string;
}

export interface PredictionFactors {
  current_velocity: number;
  avg_scan_duration_ms: number | null;
  active_scanners: number;
  queue_depth: number;
  historical_avg_velocity: number | null;
  time_of_day_factor: number;
  day_of_week_factor: number;
  entry_point_id?: string;
}

/**
 * Predict wait time for an event using ML model
 */
export const predictWaitTime = async (
  eventId: string,
  entryPointId?: string
): Promise<WaitTimePrediction | null> => {
  try {
    const { data, error } = await supabase.rpc('predict_wait_time', {
      event_id_param: eventId,
      entry_point_id_param: entryPointId || null,
    });

    if (error) {
      console.error('Error predicting wait time:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const prediction = data[0] as {
      predicted_wait_minutes: number;
      confidence_score: number;
      factors: PredictionFactors;
    };

    // Save prediction to database
    const { data: savedPrediction, error: saveError } = await supabase
      .from('wait_time_predictions')
      .insert({
        event_id: eventId,
        prediction_time: new Date().toISOString(),
        predicted_wait_minutes: prediction.predicted_wait_minutes,
        confidence_score: prediction.confidence_score,
        factors: prediction.factors,
        entry_point_id: entryPointId || null,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving prediction:', saveError);
      // Return prediction anyway, just not saved
      return {
        id: '',
        event_id: eventId,
        prediction_time: new Date().toISOString(),
        predicted_wait_minutes: prediction.predicted_wait_minutes,
        actual_wait_minutes: null,
        confidence_score: prediction.confidence_score,
        factors: prediction.factors,
        entry_point_id: entryPointId || null,
        created_at: new Date().toISOString(),
      };
    }

    return savedPrediction as WaitTimePrediction;
  } catch (error) {
    console.error('Exception predicting wait time:', error);
    return null;
  }
};

/**
 * Get latest wait time prediction for an event
 */
export const getLatestWaitTimePrediction = async (
  eventId: string,
  entryPointId?: string
): Promise<WaitTimePrediction | null> => {
  try {
    let query = supabase
      .from('wait_time_predictions')
      .select('*')
      .eq('event_id', eventId)
      .is('actual_wait_minutes', null) // Only get predictions that haven't been validated yet
      .order('prediction_time', { ascending: false })
      .limit(1);

    if (entryPointId) {
      query = query.eq('entry_point_id', entryPointId);
    } else {
      query = query.is('entry_point_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting latest prediction:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as WaitTimePrediction;
  } catch (error) {
    console.error('Exception getting latest prediction:', error);
    return null;
  }
};

/**
 * Update prediction with actual wait time for accuracy tracking
 */
export const updatePredictionWithActual = async (
  predictionId: string,
  actualWaitMinutes: number
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('wait_time_predictions')
      .update({ actual_wait_minutes: actualWaitMinutes })
      .eq('id', predictionId);

    if (error) {
      console.error('Error updating prediction:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception updating prediction:', error);
    return false;
  }
};

/**
 * Get prediction accuracy statistics
 */
export const getPredictionAccuracy = async (
  eventId: string,
  daysBack: number = 30,
  entryPointId?: string
): Promise<{
  total_predictions: number;
  avg_accuracy: number;
  avg_error_minutes: number;
  predictions_within_20_percent: number;
}> => {
  try {
    let query = supabase
      .from('wait_time_predictions')
      .select('predicted_wait_minutes, actual_wait_minutes')
      .eq('event_id', eventId)
      .not('actual_wait_minutes', 'is', null)
      .gte('prediction_time', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString());

    if (entryPointId) {
      query = query.eq('entry_point_id', entryPointId);
    } else {
      query = query.is('entry_point_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting prediction accuracy:', error);
      return {
        total_predictions: 0,
        avg_accuracy: 0,
        avg_error_minutes: 0,
        predictions_within_20_percent: 0,
      };
    }

    if (!data || data.length === 0) {
      return {
        total_predictions: 0,
        avg_accuracy: 0,
        avg_error_minutes: 0,
        predictions_within_20_percent: 0,
      };
    }

    const predictions = data as Array<{
      predicted_wait_minutes: number;
      actual_wait_minutes: number;
    }>;

    let totalError = 0;
    let within20Percent = 0;

    predictions.forEach((p) => {
      const error = Math.abs(p.predicted_wait_minutes - p.actual_wait_minutes);
      totalError += error;

      const percentError = p.actual_wait_minutes > 0
        ? (error / p.actual_wait_minutes) * 100
        : error > 0 ? 100 : 0;

      if (percentError <= 20) {
        within20Percent++;
      }
    });

    const avgError = totalError / predictions.length;
    const avgAccuracy = 100 - (avgError / (predictions.reduce((sum, p) => sum + p.actual_wait_minutes, 0) / predictions.length)) * 100;

    return {
      total_predictions: predictions.length,
      avg_accuracy: Math.max(0, avgAccuracy),
      avg_error_minutes: avgError,
      predictions_within_20_percent: within20Percent,
    };
  } catch (error) {
    console.error('Exception getting prediction accuracy:', error);
    return {
      total_predictions: 0,
      avg_accuracy: 0,
      avg_error_minutes: 0,
      predictions_within_20_percent: 0,
    };
  }
};

/**
 * Start periodic wait time prediction updates
 */
export const startPredictionUpdates = (
  eventId: string,
  entryPointId?: string,
  intervalMs: number = 60000 // 1 minute
): (() => void) => {
  let intervalId: number | null = null;
  let isRunning = false;

  const updatePrediction = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      await predictWaitTime(eventId, entryPointId);
    } catch (error) {
      console.error('Error in prediction update:', error);
    } finally {
      isRunning = false;
    }
  };

  intervalId = window.setInterval(updatePrediction, intervalMs);
  updatePrediction(); // Initial prediction

  return () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
};

