import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export interface Shift {
  id: string;
  event_id: string;
  event_name: string;
  user_id: string;
  user_email: string;
  shift_start: string;
  shift_end: string | null;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  role: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ShiftStats {
  currentShift: Shift | null;
  todayScans: number;
  todayRevenue: number;
  shiftDuration: number; // in minutes
  averageScanRate: number; // scans per hour
}

/**
 * Get current active shift for a user
 */
export const getCurrentShift = async (userId: string): Promise<Shift | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from("staff_shifts")
      .select("*")
      .eq("user_id", userId)
      .is("clocked_out_at", null)
      .order("clocked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error getting current shift:", error);
    return null;
  }
};

/**
 * Clock in for a shift
 */
export const clockIn = async (userId: string, shiftId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from("staff_shifts")
      .update({
        clocked_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", shiftId)
      .eq("user_id", userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error clocking in:", error);
    return false;
  }
};

/**
 * Clock out from current shift
 */
export const clockOut = async (userId: string, shiftId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabase
      .from("staff_shifts")
      .update({
        clocked_out_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", shiftId)
      .eq("user_id", userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error clocking out:", error);
    return false;
  }
};

/**
 * Get shift statistics for current shift
 */
export const getShiftStats = async (userId: string, shiftId: string): Promise<ShiftStats | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    // Get shift info
    const { data: shift, error: shiftError } = await supabase
      .from("staff_shifts")
      .select("*")
      .eq("id", shiftId)
      .eq("user_id", userId)
      .maybeSingle();

    if (shiftError) throw shiftError;
    if (!shift) return null;

    // Get scans for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: scans, error: scansError } = await supabase
      .from("scan_logs")
      .select("id, scanned_at, metadata")
      .eq("scanned_by", userId)
      .gte("scanned_at", todayStart.toISOString())
      .eq("scan_result", "valid");

    if (scansError) throw scansError;

    // Calculate shift duration
    const clockedInAt = shift.clocked_in_at ? new Date(shift.clocked_in_at) : new Date();
    const clockedOutAt = shift.clocked_out_at ? new Date(shift.clocked_out_at) : new Date();
    const durationMs = clockedOutAt.getTime() - clockedInAt.getTime();
    const durationMinutes = Math.floor(durationMs / 60000);

    // Calculate scan rate (scans per hour)
    const scanCount = scans?.length || 0;
    const hoursWorked = durationMinutes / 60;
    const averageScanRate = hoursWorked > 0 ? scanCount / hoursWorked : 0;

    // Calculate revenue (from scan metadata if available)
    const todayRevenue = scans?.reduce((sum, scan) => {
      const price = scan.metadata?.price_paid || 0;
      return sum + (typeof price === 'number' ? price : parseFloat(price) || 0);
    }, 0) || 0;

    return {
      currentShift: shift,
      todayScans: scanCount,
      todayRevenue,
      shiftDuration: durationMinutes,
      averageScanRate,
    };
  } catch (error) {
    console.error("Error getting shift stats:", error);
    return null;
  }
};

/**
 * Get upcoming shifts for a user
 */
export const getUpcomingShifts = async (userId: string, limit: number = 5): Promise<Shift[]> => {
  if (!isSupabaseConfigured()) return [];

  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("staff_shifts")
      .select("*")
      .eq("user_id", userId)
      .gte("shift_start", now)
      .order("shift_start", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting upcoming shifts:", error);
    return [];
  }
};

/**
 * Get shift history for a user
 */
export const getShiftHistory = async (userId: string, limit: number = 10): Promise<Shift[]> => {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from("staff_shifts")
      .select("*")
      .eq("user_id", userId)
      .not("clocked_out_at", "is", null)
      .order("clocked_out_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error getting shift history:", error);
    return [];
  }
};

