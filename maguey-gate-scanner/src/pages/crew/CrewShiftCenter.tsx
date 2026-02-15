import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmployeePortalLayout from "@/components/layout/EmployeePortalLayout";
import { ShiftStatus } from "@/components/dashboard/ShiftStatus";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { getShiftHistory, getUpcomingShifts, type Shift } from "@/lib/shift-service";
import { format, formatDistanceToNow } from "date-fns";
import {
  CalendarDays,
  ClipboardList,
  Award,
  QrCode,
  Users,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

const CrewShiftCenter = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const role = useRole();

  const [isLoading, setIsLoading] = useState(true);
  const [upcomingShifts, setUpcomingShifts] = useState<Shift[]>([]);
  const [recentShifts, setRecentShifts] = useState<Shift[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (role === "owner") {
      navigate("/staff-scheduling");
      return;
    }
  }, [authLoading, user, role, navigate]);

  const loadShiftData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [upcoming, history] = await Promise.all([
        getUpcomingShifts(user.id, 5),
        getShiftHistory(user.id, 6),
      ]);
      setUpcomingShifts(upcoming);
      setRecentShifts(history);
    } catch (error) {
      console.error("[CrewShiftCenter] Failed to load shifts:", error);
      toast({
        variant: "destructive",
        title: "Unable to load shifts",
        description: "We could not fetch your schedule. Please retry.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadShiftData();
    }
  }, [user?.id]);

  const totalMinutesWorked = useMemo(() => {
    return recentShifts.reduce((acc, shift) => {
      const start = shift.clocked_in_at || shift.shift_start;
      const end = shift.clocked_out_at || shift.shift_end;
      if (!start || !end) return acc;
      const duration = new Date(end).getTime() - new Date(start).getTime();
      return acc + Math.max(duration / 60000, 0);
    }, 0);
  }, [recentShifts]);

  const hoursWorked = Math.round((totalMinutesWorked / 60) * 10) / 10;
  const completedShiftCount = recentShifts.filter((shift) => !!shift.clocked_out_at).length;
  const reliability =
    recentShifts.length > 0
      ? Math.round((completedShiftCount / recentShifts.length) * 100)
      : 100;

  const heroSection = (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white shadow-lg">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-purple-200/70">Shift pulse</p>
          <h2 className="text-2xl font-semibold">Stay synced with your assignment</h2>
          <p className="text-sm text-purple-100/80">
            Clock in with confidence, track performance, and keep the door humming.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-purple-200/80">Hours this week</p>
            <p className="text-3xl font-bold">{hoursWorked || 0}</p>
          </div>
          <div>
            <p className="text-xs text-purple-200/80">Reliability</p>
            <p className="text-3xl font-bold">{reliability}%</p>
          </div>
        </div>
      </div>
    </div>
  );

  const headerActions = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Button
        size="sm"
        variant="secondary"
        className="w-full bg-white/10 text-white hover:bg-white/20 sm:w-auto"
        onClick={() => navigate("/scanner")}
      >
        <QrCode className="mr-2 h-4 w-4" />
        Scanner
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="w-full border-white/30 text-white hover:bg-white/10 sm:w-auto"
        onClick={loadShiftData}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );

  return (
    <EmployeePortalLayout
      title="Shift Center"
      subtitle="Crew suite • Staffing"
      description="Manage your shift status, upcoming assignments, and readiness score."
      actions={headerActions}
      hero={heroSection}
    >
      <div className="space-y-6">
        <ShiftStatus />

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ClipboardList className="h-4 w-4" />
              Quick actions
            </CardTitle>
            <CardDescription className="text-purple-100/70">
              Launch the tools you need during doors.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button
              className="justify-start border-white/20 bg-transparent text-white hover:bg-white/10"
              variant="outline"
              onClick={() => navigate("/crew/queue")}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Queue intel
            </Button>
            <Button
              className="justify-start border-white/20 bg-transparent text-white hover:bg-white/10"
              variant="outline"
              onClick={() => navigate("/crew/devices")}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Device health
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <CalendarDays className="h-4 w-4" />
                Upcoming assignments
              </CardTitle>
              <CardDescription className="text-purple-100/70">
                You&apos;re locked in for the next crowds here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <p className="text-sm text-purple-100/80">Loading schedule...</p>
              ) : upcomingShifts.length === 0 ? (
                <p className="text-sm text-purple-100/80">No upcoming shifts assigned.</p>
              ) : (
                upcomingShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-start justify-between rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{shift.event_name}</p>
                      <p className="text-xs text-purple-100/70">
                        {format(new Date(shift.shift_start), "EEE, MMM d • h:mm a")}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-white/30 text-xs">
                      {shift.role || "Crew"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Award className="h-4 w-4" />
                Shift history
              </CardTitle>
              <CardDescription className="text-purple-100/70">
                Recent performances and time on the door.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <p className="text-sm text-purple-100/80">Crunching your history...</p>
              ) : recentShifts.length === 0 ? (
                <p className="text-sm text-purple-100/80">No logged shifts yet.</p>
              ) : (
                recentShifts.map((shift) => (
                  <div key={shift.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{shift.event_name}</p>
                      <Badge variant="outline" className="border-white/30 text-xs">
                        {shift.clocked_out_at ? "Completed" : "Scheduled"}
                      </Badge>
                    </div>
                    <p className="text-xs text-purple-100/70">
                      {format(new Date(shift.shift_start), "MMM d, h:mm a")} -{" "}
                      {shift.shift_end
                        ? format(new Date(shift.shift_end), "h:mm a")
                        : "TBD"}
                    </p>
                    {shift.clocked_out_at && (
                      <p className="text-xs text-purple-100/70">
                        Wrapped {formatDistanceToNow(new Date(shift.clocked_out_at))} ago
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="h-4 w-4" />
              Performance snapshot
            </CardTitle>
            <CardDescription className="text-purple-100/70">
              High-level view of your door contributions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-purple-200/70">Hours logged</p>
              <p className="text-2xl font-semibold">{hoursWorked}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-purple-200/70">Shifts finished</p>
              <p className="text-2xl font-semibold">{completedShiftCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-purple-200/70">Reliability</p>
              <p className="text-2xl font-semibold">{reliability}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </EmployeePortalLayout>
  );
};

export default CrewShiftCenter;


