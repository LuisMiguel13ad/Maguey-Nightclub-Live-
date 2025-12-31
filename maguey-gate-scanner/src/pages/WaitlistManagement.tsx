import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth, useRole } from "@/contexts/AuthContext";
import OwnerPortalLayout from "@/components/layout/OwnerPortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  Phone,
  Calendar,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Ticket,
  Download,
  Send,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { getAllWaitlistEntries, updateWaitlistEntryStatus, autoDetectAndNotifyWaitlist, checkAndNotifyEventWaitlist } from "@/lib/waitlist-service";
import { Loader2, Zap } from "lucide-react";
import { toast as sonnerToast } from "sonner";

interface WaitlistEntry {
  id: string;
  event_name: string;
  ticket_type: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  quantity: number;
  status: "waiting" | "notified" | "converted" | "cancelled";
  created_at: string;
  notified_at?: string;
  converted_at?: string;
  metadata?: Record<string, unknown>;
}

const WaitlistManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = useRole();
  const isOwner = role === "owner";

  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [events, setEvents] = useState<Array<{ name: string }>>([]);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // Redirect employees
  useEffect(() => {
    if (role !== "owner") {
      navigate("/dashboard");
    }
  }, [role, navigate]);

  useEffect(() => {
    if (isOwner) {
      loadWaitlist();
      loadEvents();
    }
  }, [isOwner]);

  useEffect(() => {
    filterEntries();
  }, [waitlistEntries, searchQuery, statusFilter, eventFilter]);

  const loadEvents = async () => {
    if (!isSupabaseConfigured()) return;

    try {
      const { data, error } = await supabase
        .from("events")
        .select("name")
        .order("name", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      console.error("Error loading events:", error);
    }
  };

  const loadWaitlist = async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      const entries = await getAllWaitlistEntries();
      setWaitlistEntries(entries);
    } catch (error: any) {
      console.error("Error loading waitlist:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load waitlist entries.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterEntries = () => {
    let filtered = [...waitlistEntries];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (entry) =>
          entry.customer_name.toLowerCase().includes(query) ||
          entry.customer_email.toLowerCase().includes(query) ||
          entry.event_name.toLowerCase().includes(query) ||
          entry.customer_phone?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((entry) => entry.status === statusFilter);
    }

    // Event filter
    if (eventFilter !== "all") {
      filtered = filtered.filter((entry) => entry.event_name === eventFilter);
    }

    setFilteredEntries(filtered);
  };

  const updateEntryStatus = async (entryId: string, newStatus: WaitlistEntry["status"]) => {
    if (!isSupabaseConfigured()) return;

    try {
      await updateWaitlistEntryStatus(entryId, newStatus);

      toast({
        title: "Success",
        description: "Waitlist entry updated successfully.",
      });

      loadWaitlist();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update entry.",
      });
    }
  };

  const handleNotify = async () => {
    if (!selectedEntry) return;

    // Here you would integrate with your email service
    // For now, we'll just mark as notified
    await updateEntryStatus(selectedEntry.id, "notified");
    setNotifyDialogOpen(false);
    setSelectedEntry(null);
  };

  const handleAutoDetectAll = async () => {
    setIsAutoDetecting(true);
    try {
      const results = await autoDetectAndNotifyWaitlist();
      
      if (results.errors.length > 0) {
        sonnerToast.error("Auto-detection completed with errors", {
          description: results.errors.slice(0, 3).join(", "),
        });
      }
      
      if (results.notified > 0) {
        sonnerToast.success(`Auto-detection complete!`, {
          description: `Notified ${results.notified} customer(s) across ${results.events.length} event(s).`,
        });
        loadWaitlist();
      } else {
        sonnerToast.info("No tickets available", {
          description: "Checked all events but no tickets are currently available for waitlist customers.",
        });
      }
    } catch (error: any) {
      sonnerToast.error("Auto-detection failed", {
        description: error.message || "An error occurred during auto-detection.",
      });
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const handleAutoDetectEvent = async (eventName: string) => {
    setIsAutoDetecting(true);
    try {
      const results = await checkAndNotifyEventWaitlist(eventName);
      
      if (results.errors.length > 0) {
        sonnerToast.error("Auto-detection completed with errors", {
          description: results.errors.slice(0, 3).join(", "),
        });
      }
      
      if (results.notified > 0) {
        sonnerToast.success(`Notified ${results.notified} customer(s)`, {
          description: `Tickets are now available for ${eventName}.`,
        });
        loadWaitlist();
      } else {
        sonnerToast.info("No tickets available", {
          description: `No tickets are currently available for waitlist customers for ${eventName}.`,
        });
      }
    } catch (error: any) {
      sonnerToast.error("Auto-detection failed", {
        description: error.message || "An error occurred during auto-detection.",
      });
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const exportWaitlist = () => {
    const csv = [
      ["Event Name", "Ticket Type", "Customer Name", "Email", "Phone", "Quantity", "Status", "Created At"],
      ...filteredEntries.map((entry) => [
        entry.event_name,
        entry.ticket_type,
        entry.customer_name,
        entry.customer_email,
        entry.customer_phone || "",
        entry.quantity.toString(),
        entry.status,
        format(new Date(entry.created_at), "MM/dd/yyyy HH:mm"),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: WaitlistEntry["status"]) => {
    const variants: Record<WaitlistEntry["status"], { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      waiting: { variant: "default", label: "Waiting" },
      notified: { variant: "secondary", label: "Notified" },
      converted: { variant: "outline", label: "Converted" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    };

    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (!isOwner) {
    return null;
  }

  const stats = {
    total: waitlistEntries.length,
    waiting: waitlistEntries.filter((e) => e.status === "waiting").length,
    notified: waitlistEntries.filter((e) => e.status === "notified").length,
    converted: waitlistEntries.filter((e) => e.status === "converted").length,
  };

  return (
    <OwnerPortalLayout
      title="Waitlist Management"
      description="Manage customer waitlist entries for sold-out events"
    >

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Waiting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.waiting}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Notified</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.notified}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.converted}</div>
            </CardContent>
          </Card>
        </div>

        {/* Auto-Detection Actions */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Auto-Detection
            </CardTitle>
            <CardDescription>
              Automatically check ticket availability and notify waitlist customers when tickets become available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-3">
              <Button
                onClick={handleAutoDetectAll}
                disabled={isAutoDetecting}
                className="bg-primary hover:bg-primary/90"
              >
                {isAutoDetecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking All Events...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Check All Events
                  </>
                )}
              </Button>
              {eventFilter !== "all" && (
                <Button
                  onClick={() => handleAutoDetectEvent(eventFilter)}
                  disabled={isAutoDetecting}
                  variant="outline"
                >
                  {isAutoDetecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Check Selected Event
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, event..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="notified">Notified</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Event</Label>
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {events.map((event) => (
                      <SelectItem key={event.name} value={event.name}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="mb-4 flex justify-end">
          <Button onClick={exportWaitlist} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Waitlist Table */}
        <Card>
          <CardHeader>
            <CardTitle>Waitlist Entries ({filteredEntries.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No waitlist entries found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Ticket Type</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{entry.customer_name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {entry.customer_email}
                            </div>
                            {entry.customer_phone && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {entry.customer_phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{entry.event_name}</div>
                        </TableCell>
                        <TableCell>{entry.ticket_type}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Ticket className="h-4 w-4" />
                            {entry.quantity}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(entry.status)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(entry.created_at), "MM/dd/yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(entry.created_at), "HH:mm")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {entry.status === "waiting" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedEntry(entry);
                                    setNotifyDialogOpen(true);
                                  }}
                                >
                                  <Send className="h-4 w-4 mr-1" />
                                  Notify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateEntryStatus(entry.id, "converted")}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Convert
                                </Button>
                              </>
                            )}
                            {entry.status !== "cancelled" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateEntryStatus(entry.id, "cancelled")}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Notify Dialog */}
      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notify Customer</DialogTitle>
            <DialogDescription>
              Send notification email to {selectedEntry?.customer_name} about ticket availability?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleNotify}>
              <Send className="mr-2 h-4 w-4" />
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OwnerPortalLayout>
  );
};

export default WaitlistManagement;

