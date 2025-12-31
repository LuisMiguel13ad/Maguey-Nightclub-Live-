import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth, useRole } from "@/contexts/AuthContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Plus,
  Users,
  Clock,
  Edit,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface Shift {
  id?: string;
  event_id: string;
  event_name: string;
  user_id: string;
  user_email: string;
  shift_start: string;
  shift_end: string;
  role: string;
  notes?: string;
}

const StaffScheduling = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([]);
  const [staff, setStaff] = useState<Array<{ id: string; email: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [shiftRole, setShiftRole] = useState("scanner");
  const [shiftNotes, setShiftNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Redirect employees
  useEffect(() => {
    if (role !== 'owner') {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Staff scheduling is only available to owners.",
      });
      navigate("/scanner");
    }
  }, [role, navigate, toast]);

  useEffect(() => {
    if (role === 'owner') {
      loadData();
    }
  }, [role]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadEvents(),
        loadStaff(),
        loadShifts(),
      ]);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load data",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadEvents = async () => {
    if (!isSupabaseConfigured()) return;
    const { data, error } = await supabase
      .from("events")
      .select("id, name")
      .order("event_date", { ascending: false });
    if (!error && data) {
      setEvents(data);
    }
  };

  const loadStaff = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data: { users }, error } = await supabase.auth.admin.listUsers();
      if (!error && users) {
        setStaff(users.map(u => ({ id: u.id, email: u.email || '' })));
      }
    } catch (error) {
      // Admin API might not be available
      console.warn("Could not load staff list:", error);
    }
  };

  const loadShifts = async () => {
    if (!isSupabaseConfigured()) return;
    // Note: This assumes a shifts table exists
    // For now, we'll create a simple implementation
    const { data, error } = await supabase
      .from("staff_shifts")
      .select("*")
      .order("shift_start", { ascending: true });
    
    if (error && error.code !== '42P01') { // Table doesn't exist
      console.error("Error loading shifts:", error);
    } else if (data) {
      setShifts(data);
    }
  };

  const handleSave = async () => {
    if (!selectedEvent || !selectedStaff || !shiftStart || !shiftEnd) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields.",
      });
      return;
    }

    setSaving(true);
    try {
      const event = events.find(e => e.id === selectedEvent);
      const staffMember = staff.find(s => s.id === selectedStaff);

      const shiftData: Omit<Shift, 'id'> = {
        event_id: selectedEvent,
        event_name: event?.name || '',
        user_id: selectedStaff,
        user_email: staffMember?.email || '',
        shift_start: shiftStart,
        shift_end: shiftEnd,
        role: shiftRole,
        notes: shiftNotes || undefined,
      };

      if (editingShift?.id) {
        const { error } = await supabase
          .from("staff_shifts")
          .update(shiftData)
          .eq("id", editingShift.id);
        if (error) throw error;
        toast({
          title: "Shift Updated",
          description: "Shift has been updated successfully.",
        });
      } else {
        const { error } = await supabase
          .from("staff_shifts")
          .insert(shiftData);
        if (error) throw error;
        toast({
          title: "Shift Created",
          description: "New shift has been created successfully.",
        });
      }

      setDialogOpen(false);
      resetForm();
      loadShifts();
    } catch (error: any) {
      console.error("Error saving shift:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save shift",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditingShift(null);
    setSelectedEvent("");
    setSelectedStaff("");
    setShiftStart("");
    setShiftEnd("");
    setShiftRole("scanner");
    setShiftNotes("");
  };

  const handleEdit = (shift: Shift) => {
    setEditingShift(shift);
    setSelectedEvent(shift.event_id);
    setSelectedStaff(shift.user_id);
    setShiftStart(shift.shift_start.split('T')[0] + 'T' + shift.shift_start.split('T')[1].slice(0, 5));
    setShiftEnd(shift.shift_end.split('T')[0] + 'T' + shift.shift_end.split('T')[1].slice(0, 5));
    setShiftRole(shift.role);
    setShiftNotes(shift.notes || "");
    setDialogOpen(true);
  };

  const handleDelete = async (shiftId: string) => {
    try {
      const { error } = await supabase
        .from("staff_shifts")
        .delete()
        .eq("id", shiftId);
      if (error) throw error;
      toast({
        title: "Shift Deleted",
        description: "Shift has been deleted successfully.",
      });
      loadShifts();
    } catch (error: any) {
      console.error("Error deleting shift:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete shift",
      });
    }
  };

  if (role !== 'owner') {
    return null;
  }

  const headerActions = (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Shift
          </Button>
  );

  return (
    <OwnerPortalLayout
      title="Staff Scheduling"
      description="Assign staff to events and manage shifts"
      actions={headerActions}
    >

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading schedules...
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Shifts</CardTitle>
              <CardDescription>
                Manage staff assignments for events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shifts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No shifts scheduled. Create your first shift assignment!
                </div>
              ) : (
                <div className="space-y-4">
                  {shifts.map((shift) => (
                    <div key={shift.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{shift.event_name}</span>
                          <Badge variant="secondary">{shift.role}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3" />
                            <span>{shift.user_email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>
                              {format(new Date(shift.shift_start), "MMM d, h:mm a")} - {format(new Date(shift.shift_end), "h:mm a")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(shift)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => shift.id && handleDelete(shift.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Shift Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingShift ? "Edit Shift" : "Create New Shift"}
              </DialogTitle>
              <DialogDescription>
                Assign staff member to an event shift
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Event *</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Staff Member *</Label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Shift Start *</Label>
                  <Input
                    type="datetime-local"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shift End *</Label>
                  <Input
                    type="datetime-local"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={shiftRole} onValueChange={setShiftRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scanner">Scanner</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingShift ? "Update Shift" : "Create Shift"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </OwnerPortalLayout>
  );
};

export default StaffScheduling;


