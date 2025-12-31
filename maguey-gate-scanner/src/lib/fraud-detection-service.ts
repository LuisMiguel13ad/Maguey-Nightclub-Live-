/**
 * Fraud Detection Service
 * 
 * AI-powered fraud detection system that analyzes scan patterns,
 * device fingerprints, IP addresses, and geolocation data to detect
 * suspicious activity and calculate risk scores.
 */

import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import type { ScanMetadata } from './scan-metadata-service';

export interface FraudIndicator {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  score: number; // 0-100 contribution to risk score
  metadata?: Record<string, any>;
}

export interface FraudDetectionResult {
  riskScore: number; // 0-100
  indicators: FraudIndicator[];
  shouldBlock: boolean;
  shouldAlert: boolean;
}

/**
 * Calculates distance between two geographic coordinates (Haversine formula)
 */
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

/**
 * Checks for duplicate IP scans (same ticket scanned from multiple IPs)
 */
const checkDuplicateIPScans = async (
  ticketId: string,
  currentIP: string,
  timeWindowMinutes: number = 30
): Promise<FraudIndicator | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    // Get recent scans for this ticket
    // First get scan_logs for this ticket, then get metadata
    const { data: scanLogs, error: scanLogsError } = await supabase
      .from('scan_logs')
      .select('id, scanned_at')
      .eq('ticket_id', ticketId)
      .gte('scanned_at', new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString())
      .order('scanned_at', { ascending: false });

    if (scanLogsError || !scanLogs || scanLogs.length === 0) {
      return null;
    }

    const scanLogIds = scanLogs.map(log => log.id);
    const { data: recentScans, error } = await supabase
      .from('scan_metadata')
      .select('scan_log_id, ip_address')
      .in('scan_log_id', scanLogIds);

    if (error) {
      console.error('[fraud-detection] Error checking duplicate IP scans:', error);
      return null;
    }

    if (!recentScans || recentScans.length === 0) return null;

    // Count unique IPs
    const uniqueIPs = new Set(recentScans?.map((s: any) => s.ip_address) || []);
    
    if (uniqueIPs.size > 1) {
      return {
        type: 'duplicate_ip_scans',
        severity: 'high',
        description: `Same ticket scanned from ${uniqueIPs.size} different IP addresses within ${timeWindowMinutes} minutes`,
        score: Math.min(40 + (uniqueIPs.size - 1) * 10, 80),
        metadata: {
          ip_count: uniqueIPs.size,
          ips: Array.from(uniqueIPs),
          time_window_minutes: timeWindowMinutes,
        },
      };
    }

    return null;
  } catch (error) {
    console.error('[fraud-detection] Error in checkDuplicateIPScans:', error);
    return null;
  }
};

/**
 * Checks for rapid consecutive scans (velocity anomaly)
 */
const checkRapidScans = async (
  deviceFingerprint: string,
  timeWindowMinutes: number = 5
): Promise<FraudIndicator | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    // First get metadata for this device fingerprint, then filter by time
    const timeThreshold = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();
    
    // Get scan metadata for this device
    const { data: deviceMetadata, error: metadataError } = await supabase
      .from('scan_metadata')
      .select('scan_log_id')
      .eq('device_fingerprint', deviceFingerprint);

    if (metadataError || !deviceMetadata || deviceMetadata.length === 0) {
      return null;
    }

    const scanLogIds = deviceMetadata.map(m => m.scan_log_id);
    
    // Get scan logs within time window
    const { data: recentScans, error } = await supabase
      .from('scan_logs')
      .select('id, scanned_at')
      .in('id', scanLogIds)
      .gte('scanned_at', timeThreshold)
      .order('scanned_at', { ascending: false });

    if (error) {
      console.error('[fraud-detection] Error checking rapid scans:', error);
      return null;
    }

    if (!recentScans || recentScans.length < 5) return null;

    // Check if scans are too rapid (more than 10 scans in 5 minutes = suspicious)
    const scanCount = recentScans.length;
    const scansPerMinute = scanCount / timeWindowMinutes;

    if (scansPerMinute > 2) {
      return {
        type: 'rapid_scan_velocity',
        severity: 'high',
        description: `Unusually fast scanning: ${scanCount} scans in ${timeWindowMinutes} minutes (${scansPerMinute.toFixed(1)} scans/min)`,
        score: Math.min(30 + (scansPerMinute - 2) * 10, 70),
        metadata: {
          scan_count: scanCount,
          scans_per_minute: scansPerMinute,
          time_window_minutes: timeWindowMinutes,
        },
      };
    }

    return null;
  } catch (error) {
    console.error('[fraud-detection] Error in checkRapidScans:', error);
    return null;
  }
};

/**
 * Checks for geographic impossibilities (same ticket in different locations)
 */
const checkGeographicImpossibility = async (
  ticketId: string,
  currentGeolocation: ScanMetadata['geolocation'],
  timeWindowMinutes: number = 60
): Promise<FraudIndicator | null> => {
  if (!isSupabaseConfigured() || !currentGeolocation?.latitude || !currentGeolocation?.longitude) {
    return null;
  }

  try {
    // First get scan_logs for this ticket, then get metadata with geolocation
    const { data: scanLogs, error: scanLogsError } = await supabase
      .from('scan_logs')
      .select('id, scanned_at')
      .eq('ticket_id', ticketId)
      .gte('scanned_at', new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString())
      .order('scanned_at', { ascending: false });

    if (scanLogsError || !scanLogs || scanLogs.length === 0) {
      return null;
    }

    const scanLogIds = scanLogs.map(log => log.id);
    const { data: recentScans, error } = await supabase
      .from('scan_metadata')
      .select('geolocation')
      .in('scan_log_id', scanLogIds)
      .not('geolocation', 'is', null);

    if (error) {
      console.error('[fraud-detection] Error checking geographic impossibility:', error);
      return null;
    }

    if (!recentScans || recentScans.length === 0) return null;

    // Check if any previous scan was in a different location
    for (const scan of recentScans) {
      const geo = scan.geolocation as any;
      if (geo?.latitude && geo?.longitude) {
        const distance = calculateDistance(
          currentGeolocation.latitude!,
          currentGeolocation.longitude!,
          geo.latitude,
          geo.longitude
        );

        // If distance is more than 100km and time difference is less than 1 hour, it's suspicious
        if (distance > 100) {
          return {
            type: 'geographic_impossibility',
            severity: 'critical',
            description: `Same ticket scanned in locations ${distance.toFixed(0)}km apart within ${timeWindowMinutes} minutes (impossible travel)`,
            score: 90,
            metadata: {
              distance_km: distance,
              current_location: {
                lat: currentGeolocation.latitude,
                lon: currentGeolocation.longitude,
              },
              previous_location: {
                lat: geo.latitude,
                lon: geo.longitude,
              },
              time_window_minutes: timeWindowMinutes,
            },
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[fraud-detection] Error in checkGeographicImpossibility:', error);
    return null;
  }
};

/**
 * Checks for device fingerprint mismatches
 */
const checkDeviceFingerprintMismatch = async (
  ticketId: string,
  currentDeviceFingerprint: string,
  timeWindowMinutes: number = 30
): Promise<FraudIndicator | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    // First get scan_logs for this ticket, then get metadata
    const { data: scanLogs, error: scanLogsError } = await supabase
      .from('scan_logs')
      .select('id, scanned_at')
      .eq('ticket_id', ticketId)
      .gte('scanned_at', new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString())
      .order('scanned_at', { ascending: false });

    if (scanLogsError || !scanLogs || scanLogs.length === 0) {
      return null;
    }

    const scanLogIds = scanLogs.map(log => log.id);
    const { data: recentScans, error } = await supabase
      .from('scan_metadata')
      .select('device_fingerprint')
      .in('scan_log_id', scanLogIds);

    if (error) {
      console.error('[fraud-detection] Error checking device fingerprint mismatch:', error);
      return null;
    }

    if (!recentScans || recentScans.length === 0) return null;

    // Check if different device fingerprints were used
    const uniqueFingerprints = new Set(recentScans.map((s: any) => s.device_fingerprint));
    
    if (uniqueFingerprints.size > 1 && !uniqueFingerprints.has(currentDeviceFingerprint)) {
      return {
        type: 'device_fingerprint_mismatch',
        severity: 'medium',
        description: `Same ticket scanned from ${uniqueFingerprints.size} different devices within ${timeWindowMinutes} minutes`,
        score: 35,
        metadata: {
          fingerprint_count: uniqueFingerprints.size,
          time_window_minutes: timeWindowMinutes,
        },
      };
    }

    return null;
  } catch (error) {
    console.error('[fraud-detection] Error in checkDeviceFingerprintMismatch:', error);
    return null;
  }
};

/**
 * Checks for VPN usage
 */
const checkVPNUsage = (isVPN: boolean): FraudIndicator | null => {
  if (isVPN) {
    return {
      type: 'vpn_detected',
      severity: 'low',
      description: 'VPN or proxy detected - may indicate attempt to hide location',
      score: 15,
      metadata: {
        is_vpn: true,
      },
    };
  }
  return null;
};

/**
 * Checks for multiple different tickets scanned rapidly from same device
 */
const checkMultipleTicketsRapidScan = async (
  deviceFingerprint: string,
  timeWindowMinutes: number = 5
): Promise<FraudIndicator | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    // First get metadata for this device fingerprint, then filter by time
    const timeThreshold = new Date(Date.now() - timeWindowMinutes * 60 * 1000).toISOString();
    
    // Get scan metadata for this device
    const { data: deviceMetadata, error: metadataError } = await supabase
      .from('scan_metadata')
      .select('scan_log_id')
      .eq('device_fingerprint', deviceFingerprint);

    if (metadataError || !deviceMetadata || deviceMetadata.length === 0) {
      return null;
    }

    const scanLogIds = deviceMetadata.map(m => m.scan_log_id);
    
    // Get scan logs within time window
    const { data: scanLogs, error } = await supabase
      .from('scan_logs')
      .select('id, ticket_id, scanned_at')
      .in('id', scanLogIds)
      .gte('scanned_at', timeThreshold)
      .order('scanned_at', { ascending: false });

    if (error) {
      console.error('[fraud-detection] Error checking multiple tickets rapid scan:', error);
      return null;
    }

    if (!scanLogs || scanLogs.length < 3) return null;

    // Count unique tickets
    const uniqueTickets = new Set(scanLogs.map(log => log.ticket_id).filter(Boolean));
    
    if (uniqueTickets.size >= 3) {
      return {
        type: 'multiple_tickets_rapid_scan',
        severity: 'medium',
        description: `${uniqueTickets.size} different tickets scanned rapidly from same device within ${timeWindowMinutes} minutes`,
        score: 25,
        metadata: {
          ticket_count: uniqueTickets.size,
          scan_count: recentScans.length,
          time_window_minutes: timeWindowMinutes,
        },
      };
    }

    return null;
  } catch (error) {
    console.error('[fraud-detection] Error in checkMultipleTicketsRapidScan:', error);
    return null;
  }
};

/**
 * Main fraud detection function
 * Analyzes a scan and returns risk score and indicators
 */
export const detectFraud = async (
  ticketId: string,
  scanMetadata: ScanMetadata
): Promise<FraudDetectionResult> => {
  const indicators: FraudIndicator[] = [];

  // Run all fraud detection checks in parallel
  const [
    duplicateIPIndicator,
    rapidScanIndicator,
    geoImpossibilityIndicator,
    deviceMismatchIndicator,
    vpnIndicator,
    multipleTicketsIndicator,
  ] = await Promise.all([
    checkDuplicateIPScans(ticketId, scanMetadata.ip_address),
    checkRapidScans(scanMetadata.device_fingerprint),
    checkGeographicImpossibility(ticketId, scanMetadata.geolocation),
    checkDeviceFingerprintMismatch(ticketId, scanMetadata.device_fingerprint),
    Promise.resolve(checkVPNUsage(scanMetadata.is_vpn)),
    checkMultipleTicketsRapidScan(scanMetadata.device_fingerprint),
  ]);

  // Collect all indicators
  if (duplicateIPIndicator) indicators.push(duplicateIPIndicator);
  if (rapidScanIndicator) indicators.push(rapidScanIndicator);
  if (geoImpossibilityIndicator) indicators.push(geoImpossibilityIndicator);
  if (deviceMismatchIndicator) indicators.push(deviceMismatchIndicator);
  if (vpnIndicator) indicators.push(vpnIndicator);
  if (multipleTicketsIndicator) indicators.push(multipleTicketsIndicator);

  // Calculate risk score (weighted sum, capped at 100)
  let riskScore = 0;
  for (const indicator of indicators) {
    riskScore += indicator.score;
  }
  riskScore = Math.min(riskScore, 100);

  // Determine if we should block or alert
  const shouldBlock = riskScore >= 90; // Block critical fraud
  const shouldAlert = riskScore >= 80; // Alert on high risk

  return {
    riskScore,
    indicators,
    shouldBlock,
    shouldAlert,
  };
};

/**
 * Saves fraud detection result to database
 */
export const saveFraudDetectionResult = async (
  scanLogId: string,
  ticketId: string,
  detectionResult: FraudDetectionResult,
  scanMetadata: ScanMetadata
): Promise<string | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('[fraud-detection] Supabase not configured, skipping fraud detection save');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('fraud_detection_logs')
      .insert({
        scan_log_id: scanLogId,
        ticket_id: ticketId,
        risk_score: detectionResult.riskScore,
        fraud_indicators: detectionResult.indicators,
        ip_address: scanMetadata.ip_address,
        device_fingerprint: scanMetadata.device_fingerprint,
        geolocation: scanMetadata.geolocation,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[fraud-detection] Error saving fraud detection result:', error);
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('[fraud-detection] Failed to save fraud detection result:', error);
    return null;
  }
};

/**
 * Gets fraud detection logs for a ticket
 */
export const getFraudDetectionLogs = async (
  ticketId: string,
  limit: number = 50
): Promise<any[]> => {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('fraud_detection_logs')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[fraud-detection] Error fetching fraud detection logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[fraud-detection] Failed to fetch fraud detection logs:', error);
    return [];
  }
};

/**
 * Gets high-risk fraud alerts
 */
export const getHighRiskAlerts = async (
  riskThreshold: number = 80,
  limit: number = 50
): Promise<any[]> => {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('fraud_detection_logs')
      .select(`
        *,
        scan_logs (
          scanned_at,
          scan_result
        ),
        tickets (
          ticket_id,
          event_name
        )
      `)
      .gte('risk_score', riskThreshold)
      .eq('is_confirmed_fraud', false)
      .eq('is_whitelisted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[fraud-detection] Error fetching high-risk alerts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[fraud-detection] Failed to fetch high-risk alerts:', error);
    return [];
  }
};

/**
 * Marks a fraud detection log as confirmed fraud
 */
export const confirmFraud = async (
  fraudLogId: string,
  investigatedBy: string,
  notes?: string
): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  try {
    const { error } = await supabase
      .from('fraud_detection_logs')
      .update({
        is_confirmed_fraud: true,
        investigated_by: investigatedBy,
        investigation_notes: notes,
      })
      .eq('id', fraudLogId);

    if (error) {
      console.error('[fraud-detection] Error confirming fraud:', error);
      throw error;
    }
  } catch (error) {
    console.error('[fraud-detection] Failed to confirm fraud:', error);
    throw error;
  }
};

/**
 * Whitelists a fraud detection log (marks as false positive)
 */
export const whitelistFraudDetection = async (
  fraudLogId: string,
  whitelistedBy: string
): Promise<void> => {
  if (!isSupabaseConfigured()) return;

  try {
    const { error } = await supabase
      .from('fraud_detection_logs')
      .update({
        is_whitelisted: true,
        whitelisted_by: whitelistedBy,
        whitelisted_at: new Date().toISOString(),
      })
      .eq('id', fraudLogId);

    if (error) {
      console.error('[fraud-detection] Error whitelisting fraud detection:', error);
      throw error;
    }
  } catch (error) {
    console.error('[fraud-detection] Failed to whitelist fraud detection:', error);
    throw error;
  }
};

