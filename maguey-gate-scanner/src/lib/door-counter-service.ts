import { supabase } from "@/integrations/supabase/client";

export interface DoorCounter {
  id: string;
  device_id: string;
  device_name: string;
  device_type: 'ir_beam' | 'thermal' | 'wifi' | 'bluetooth';
  location: string | null;
  api_endpoint: string | null;
  api_key: string | null;
  is_active: boolean;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhysicalCount {
  id: string;
  counter_id: string;
  count_time: string;
  entry_count: number;
  exit_count: number;
  net_count: number;
  created_at: string;
}

export interface CountDiscrepancy {
  id: string;
  event_id: string;
  check_time: string;
  physical_count: number;
  digital_count: number;
  discrepancy: number;
  status: 'pending' | 'investigating' | 'resolved' | 'ignored';
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface UnifiedCapacity {
  event_id: string;
  event_name: string;
  physical_count: number;
  digital_count: number;
  unified_count: number;
  discrepancy: number;
  last_physical_update: string | null;
  last_digital_update: string | null;
}

export interface CounterHealthStatus {
  counter_id: string;
  device_name: string;
  is_online: boolean;
  minutes_since_heartbeat: number | null;
  health_status: 'healthy' | 'warning' | 'critical' | 'unknown';
}

/**
 * Get all door counters
 */
export async function getAllDoorCounters(): Promise<DoorCounter[]> {
  const { data, error } = await supabase
    .from('door_counters')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get active door counters only
 */
export async function getActiveDoorCounters(): Promise<DoorCounter[]> {
  const { data, error } = await supabase
    .from('door_counters')
    .select('*')
    .eq('is_active', true)
    .order('device_name', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single door counter by ID
 */
export async function getDoorCounterById(id: string): Promise<DoorCounter | null> {
  const { data, error } = await supabase
    .from('door_counters')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Create a new door counter
 */
export async function createDoorCounter(
  counter: Omit<DoorCounter, 'id' | 'created_at' | 'updated_at' | 'last_heartbeat'>
): Promise<DoorCounter> {
  const { data, error } = await supabase
    .from('door_counters')
    .insert({
      device_id: counter.device_id,
      device_name: counter.device_name,
      device_type: counter.device_type,
      location: counter.location,
      api_endpoint: counter.api_endpoint,
      api_key: counter.api_key,
      is_active: counter.is_active,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a door counter
 */
export async function updateDoorCounter(
  id: string,
  updates: Partial<Omit<DoorCounter, 'id' | 'created_at' | 'updated_at'>>
): Promise<DoorCounter> {
  const { data, error } = await supabase
    .from('door_counters')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a door counter
 */
export async function deleteDoorCounter(id: string): Promise<void> {
  const { error } = await supabase
    .from('door_counters')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Update heartbeat for a door counter
 */
export async function updateCounterHeartbeat(deviceId: string): Promise<void> {
  const { error } = await supabase
    .from('door_counters')
    .update({
      last_heartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('device_id', deviceId);

  if (error) throw error;
}

/**
 * Ingest count data from a door counter device
 */
export async function ingestCounterData(
  deviceId: string,
  entryCount: number,
  exitCount: number,
  countTime?: string
): Promise<PhysicalCount> {
  // First, get the counter ID from device_id
  const { data: counter, error: counterError } = await supabase
    .from('door_counters')
    .select('id')
    .eq('device_id', deviceId)
    .eq('is_active', true)
    .single();

  if (counterError || !counter) {
    throw new Error(`Door counter not found or inactive: ${deviceId}`);
  }

  // Update heartbeat
  await updateCounterHeartbeat(deviceId);

  // Insert count data
  const { data, error } = await supabase
    .from('physical_counts')
    .insert({
      counter_id: counter.id,
      entry_count: entryCount,
      exit_count: exitCount,
      count_time: countTime || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get physical counts for a counter within a time range
 */
export async function getPhysicalCounts(
  counterId: string,
  startTime: Date,
  endTime: Date
): Promise<PhysicalCount[]> {
  const { data, error } = await supabase
    .from('physical_counts')
    .select('*')
    .eq('counter_id', counterId)
    .gte('count_time', startTime.toISOString())
    .lte('count_time', endTime.toISOString())
    .order('count_time', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get unified capacity for an event
 */
export async function getUnifiedCapacity(eventId: string): Promise<UnifiedCapacity | null> {
  const { data, error } = await supabase
    .rpc('get_unified_capacity', {
      event_id_param: eventId,
      check_time_param: new Date().toISOString(),
    })
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Detect and log discrepancies
 */
export async function detectDiscrepancy(
  eventId: string,
  threshold: number = 5
): Promise<string | null> {
  const { data, error } = await supabase
    .rpc('detect_count_discrepancy', {
      event_id_param: eventId,
      threshold_param: threshold,
    })
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all pending discrepancies
 */
export async function getPendingDiscrepancies(): Promise<CountDiscrepancy[]> {
  const { data, error } = await supabase
    .from('count_discrepancies')
    .select('*')
    .eq('status', 'pending')
    .order('check_time', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get discrepancies for an event
 */
export async function getEventDiscrepancies(eventId: string): Promise<CountDiscrepancy[]> {
  const { data, error } = await supabase
    .from('count_discrepancies')
    .select('*')
    .eq('event_id', eventId)
    .order('check_time', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Resolve a discrepancy
 */
export async function resolveDiscrepancy(
  id: string,
  status: 'resolved' | 'ignored',
  resolutionNotes: string,
  resolvedBy: string
): Promise<CountDiscrepancy> {
  const { data, error } = await supabase
    .from('count_discrepancies')
    .update({
      status,
      resolution_notes: resolutionNotes,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get counter health status
 */
export async function getCounterHealthStatus(counterId: string): Promise<CounterHealthStatus | null> {
  const { data, error } = await supabase
    .rpc('get_counter_health_status', {
      counter_id_param: counterId,
    })
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Calibrate/reset a counter (sets entry/exit counts to 0)
 */
export async function calibrateCounter(counterId: string): Promise<void> {
  // Insert a reset count (0, 0) to effectively reset the counter
  const { error } = await supabase
    .from('physical_counts')
    .insert({
      counter_id: counterId,
      entry_count: 0,
      exit_count: 0,
      count_time: new Date().toISOString(),
    });

  if (error) throw error;
}

/**
 * Get entry/exit flow data for visualization
 */
export async function getEntryExitFlow(
  counterId: string,
  startTime: Date,
  endTime: Date,
  intervalMinutes: number = 15
): Promise<Array<{
  time: string;
  entries: number;
  exits: number;
  net: number;
}>> {
  const { data, error } = await supabase
    .from('physical_counts')
    .select('count_time, entry_count, exit_count, net_count')
    .eq('counter_id', counterId)
    .gte('count_time', startTime.toISOString())
    .lte('count_time', endTime.toISOString())
    .order('count_time', { ascending: true });

  if (error) throw error;

  // Group by time intervals
  const intervalMs = intervalMinutes * 60 * 1000;
  const grouped: Record<string, { entries: number; exits: number; net: number }> = {};

  (data || []).forEach((count) => {
    const time = new Date(count.count_time);
    const intervalKey = new Date(Math.floor(time.getTime() / intervalMs) * intervalMs).toISOString();

    if (!grouped[intervalKey]) {
      grouped[intervalKey] = { entries: 0, exits: 0, net: 0 };
    }

    grouped[intervalKey].entries += count.entry_count;
    grouped[intervalKey].exits += count.exit_count;
    grouped[intervalKey].net += count.net_count;
  });

  return Object.entries(grouped).map(([time, counts]) => ({
    time,
    entries: counts.entries,
    exits: counts.exits,
    net: counts.net,
  }));
}

