import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, LogIn, LogOut, TrendingUp, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  getCurrentShift, 
  clockIn, 
  clockOut, 
  getShiftStats,
  getUpcomingShifts,
  type Shift,
  type ShiftStats 
} from "@/lib/shift-service";
import { format, formatDistanceToNow } from "date-fns";

export const ShiftStatus = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [shiftStats, setShiftStats] = useState<ShiftStats | null>(null);
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [clocking, setClocking] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadShiftData();
      // Refresh every 30 seconds
      const interval = setInterval(loadShiftData, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const loadShiftData = async () => {
    if (!user?.id) return;

    try {
      const [shift, upcoming] = await Promise.all([
        getCurrentShift(user.id),
        getUpcomingShifts(user.id, 3),
      ]);

      setCurrentShift(shift);
      setUpcomingShifts(upcoming);

      if (shift) {
        const stats = await getShiftStats(user.id, shift.id);
        setShiftStats(stats);
      } else {
        setShiftStats(null);
      }
    } catch (error) {
      console.error("Error loading shift data:", error);
    }
  };

  const handleClockIn = async () => {
    if (!user?.id || !currentShift) return;

    setClocking(true);
    try {
      const success = await clockIn(user.id, currentShift.id);
      if (success) {
        toast({
          title: "Clocked In",
          description: `Started shift for ${currentShift.event_name}`,
        });
        await loadShiftData();
      } else {
        throw new Error("Failed to clock in");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Clock In Failed",
        description: error.message || "Failed to clock in. Please try again.",
      });
    } finally {
      setClocking(false);
    }
  };

  const handleClockOut = async () => {
    if (!user?.id || !currentShift) return;

    setClocking(true);
    try {
      const success = await clockOut(user.id, currentShift.id);
      if (success) {
        toast({
          title: "Clocked Out",
          description: "Shift ended successfully.",
        });
        await loadShiftData();
      } else {
        throw new Error("Failed to clock out");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Clock Out Failed",
        description: error.message || "Failed to clock out. Please try again.",
      });
    } finally {
      setClocking(false);
    }
  };

  if (!user) return null;

  const isClockedIn = currentShift?.clocked_in_at && !currentShift?.clocked_out_at;
  const canClockIn = currentShift && !isClockedIn && new Date(currentShift.shift_start) <= new Date();

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Shift Status
        </CardTitle>
        <CardDescription>Track your work shift and performance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentShift ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{currentShift.event_name}</span>
                <Badge variant={isClockedIn ? "default" : "secondary"}>
                  {isClockedIn ? "Active" : "Scheduled"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Role: {currentShift.role}</div>
                <div>
                  Shift: {format(new Date(currentShift.shift_start), "MMM d, h:mm a")} - {format(new Date(currentShift.shift_end), "h:mm a")}
                </div>
                {currentShift.clocked_in_at && (
                  <div>
                    Clocked in: {format(new Date(currentShift.clocked_in_at), "h:mm a")}
                    {isClockedIn && ` (${formatDistanceToNow(new Date(currentShift.clocked_in_at))} ago)`}
                  </div>
                )}
              </div>
            </div>

            {canClockIn && (
              <Button
                onClick={handleClockIn}
                disabled={clocking}
                className="w-full"
                variant="default"
              >
                <LogIn className="mr-2 h-4 w-4" />
                {clocking ? "Clocking In..." : "Clock In"}
              </Button>
            )}

            {isClockedIn && (
              <>
                <Button
                  onClick={handleClockOut}
                  disabled={clocking}
                  className="w-full"
                  variant="destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {clocking ? "Clocking Out..." : "Clock Out"}
                </Button>

                {shiftStats && (
                  <div className="pt-3 border-t space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Scans Today</div>
                        <div className="font-semibold flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {shiftStats.todayScans}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Duration</div>
                        <div className="font-semibold">
                          {Math.floor(shiftStats.shiftDuration / 60)}h {shiftStats.shiftDuration % 60}m
                        </div>
                      </div>
                    </div>
                    {shiftStats.averageScanRate > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Avg: {shiftStats.averageScanRate.toFixed(1)} scans/hour
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : upcomingShifts.length > 0 ? (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">No active shift</div>
            <div className="text-xs space-y-1">
              <div className="font-medium">Upcoming shifts:</div>
              {upcomingShifts.slice(0, 2).map((shift) => (
                <div key={shift.id} className="text-muted-foreground">
                  {shift.event_name} - {format(new Date(shift.shift_start), "MMM d, h:mm a")}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-2">
            No shifts scheduled
          </div>
        )}
      </CardContent>
    </Card>
  );
};

