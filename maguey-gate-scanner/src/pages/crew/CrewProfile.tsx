import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmployeePortalLayout from "@/components/layout/EmployeePortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useRole } from "@/contexts/AuthContext";
import { getShiftHistory, getUpcomingShifts, type Shift } from "@/lib/shift-service";
import {
  User,
  Mail,
  Shield,
  Smartphone,
  TrendingUp,
  Clock,
  BookOpen,
  QrCode,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";

const CrewProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const role = useRole();

  const [deviceId, setDeviceId] = useState<string>("—");
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
      navigate("/team");
      return;
    }
  }, [authLoading, user, role, navigate]);

  useEffect(() => {
    const localDeviceId = localStorage.getItem("scanner_device_id");
    if (localDeviceId) {
      setDeviceId(localDeviceId);
    }
  }, []);

  const loadProfileData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [upcoming, history] = await Promise.all([
        getUpcomingShifts(user.id, 3),
        getShiftHistory(user.id, 6),
      ]);
      setUpcomingShifts(upcoming);
      setRecentShifts(history);
    } catch (error) {
      console.error("[CrewProfile] Failed to load profile data:", error);
      toast({
        variant: "destructive",
        title: "Unable to load profile data",
        description: "Please retry in a few seconds.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadProfileData();
    }
  }, [user?.id]);

  const totalMinutesWorked = useMemo(() => {
    return recentShifts.reduce((acc, shift) => {
      if (!shift.clocked_in_at || !shift.clocked_out_at) {
        return acc;
      }
      const duration = new Date(shift.clocked_out_at).getTime() - new Date(shift.clocked_in_at).getTime();
      return acc + Math.max(duration / 60000, 0);
    }, 0);
  }, [recentShifts]);

  const hoursWorked = Math.round((totalMinutesWorked / 60) * 10) / 10;
  const completedShifts = recentShifts.filter((shift) => !!shift.clocked_out_at).length;
  const nextShift = upcomingShifts[0];

  const heroSection = (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white shadow-lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-purple-200/70">Next shift</p>
          {nextShift ? (
            <>
              <p className="text-xl font-semibold">{nextShift.event_name}</p>
              <p className="text-sm text-purple-100/80">
                {format(new Date(nextShift.shift_start), "EEE, MMM d • h:mm a")}
              </p>
            </>
          ) : (
            <p className="text-sm text-purple-100/80">No upcoming assignments</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xs uppercase tracking-wide text-purple-200/70">Hours logged</p>
            <p className="text-3xl font-semibold">{hoursWorked || 0}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-purple-200/70">Shifts done</p>
            <p className="text-3xl font-semibold">{completedShifts}</p>
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
        onClick={loadProfileData}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );

  return (
    <EmployeePortalLayout
      title="Crew Profile"
      subtitle={user?.email || "Crew identity"}
      description="Your credentials, readiness, and training tools."
      actions={headerActions}
      hero={heroSection}
    >
      <div className="space-y-6">
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <User className="h-4 w-4" />
              Identity
            </CardTitle>
            <CardDescription className="text-purple-100/70">
              Crew credentials recognized by the owner dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-purple-100/80">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4" />
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-200/70">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4" />
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-200/70">Role</p>
                <Badge variant="outline" className="border-white/30 text-white">
                  {role}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4" />
              <div>
                <p className="text-xs uppercase tracking-wide text-purple-200/70">Device ID</p>
                <p className="font-medium">{deviceId}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <TrendingUp className="h-4 w-4" />
              Performance summary
            </CardTitle>
            <CardDescription className="text-purple-100/70">
              Snapshot of your recent door contributions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-purple-200/70">Hours worked</p>
              <p className="text-2xl font-semibold">{hoursWorked || 0}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-purple-200/70">Completed shifts</p>
              <p className="text-2xl font-semibold">{completedShifts}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-purple-200/70">Upcoming</p>
              <p className="text-2xl font-semibold">{upcomingShifts.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Clock className="h-4 w-4" />
              Upcoming shifts
            </CardTitle>
            <CardDescription className="text-purple-100/70">
              Stay ready for the next queue surge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-purple-100/80">Loading schedule...</p>
            ) : upcomingShifts.length === 0 ? (
              <p className="text-sm text-purple-100/80">No upcoming shifts assigned.</p>
            ) : (
              upcomingShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
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
              <BookOpen className="h-4 w-4" />
              Training & resources
            </CardTitle>
            <CardDescription className="text-purple-100/70">
              Keep scanning sharp and aligned with the owner dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start border-white/20 text-white hover:bg-white/10"
              asChild
            >
              <a href="https://maguey.live/training" target="_blank" rel="noreferrer">
                <Sparkles className="mr-2 h-4 w-4" />
                Crew onboarding guide
              </a>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-white/20 text-white hover:bg-white/10"
              asChild
            >
              <a href="https://maguey.live/manual-entry" target="_blank" rel="noreferrer">
                <BookOpen className="mr-2 h-4 w-4" />
                Manual entry checklist
              </a>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-white/20 text-white hover:bg-white/10"
              onClick={() => navigate("/crew/devices")}
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Device care and sync tips
            </Button>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription className="text-purple-100/70">
              Personal reminders or feedback from leads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-100/80">
              Owners can drop feedback or shift notes here. Keep your notifications on for last-minute
              adjustments.
            </p>
            <Separator className="my-4 border-white/10" />
            <p className="text-xs text-purple-200/70">
              Need to report an issue? Ping the manager in the owner dashboard or flag it via
              sync-support@maguey.live.
            </p>
          </CardContent>
        </Card>
      </div>
    </EmployeePortalLayout>
  );
};

export default CrewProfile;


