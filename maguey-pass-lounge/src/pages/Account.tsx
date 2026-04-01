import { Link, useNavigate } from "react-router-dom";
import { Music, Ticket, User, Mail, Calendar, LogOut, Loader2, Download, ExternalLink, Send, ArrowRightLeft, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { getUserTickets, type UserTicket } from "@/lib/orders-service";
import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner";
import { VIPReservationsSection } from "@/components/dashboard/VIPReservationsSection";
import { transferTicket, getSentTransfers, type TicketTransfer } from "@/lib/ticket-transfer-service";
import QRCode from "react-qr-code";

const Account = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [sentTransfers, setSentTransfers] = useState<TicketTransfer[]>([]);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);
  const [transferToEmail, setTransferToEmail] = useState('');
  const [transferToName, setTransferToName] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [reminderEmailsEnabled, setReminderEmailsEnabled] = useState(true);
  const [reminderToggleLoading, setReminderToggleLoading] = useState(false);

  // Sync reminder preference from user metadata
  useEffect(() => {
    const stored = user?.user_metadata?.reminder_emails_enabled;
    // Default is true; only override if explicitly set to false
    setReminderEmailsEnabled(stored !== false);
  }, [user?.user_metadata?.reminder_emails_enabled]);

  const handleReminderToggle = async (enabled: boolean) => {
    setReminderToggleLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: { reminder_emails_enabled: enabled },
    });
    if (error) {
      toast.error("Failed to update notification preference");
    } else {
      setReminderEmailsEnabled(enabled);
      toast.success(enabled ? "Event reminders enabled" : "Event reminders disabled");
    }
    setReminderToggleLoading(false);
  };

  // Get user display name
  const userName = user?.user_metadata?.first_name && user?.user_metadata?.last_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
    : user?.user_metadata?.full_name
    ? user.user_metadata.full_name
    : user?.email?.split('@')[0] || 'User';
  
  const userEmail = user?.email || '';

  // Fetch user tickets
  useEffect(() => {
    if (!userEmail) {
      setTicketsLoading(false);
      return;
    }

    const loadTickets = async () => {
      setTicketsLoading(true);
      try {
        const userTickets = await getUserTickets(userEmail, user?.id);
        setTickets(userTickets);
      } catch (error) {
        console.error('Error loading tickets:', error);
        toast.error('Failed to load tickets');
      } finally {
        setTicketsLoading(false);
      }
    };

    loadTickets();
  }, [userEmail, user?.id]);

  // Fetch tickets the current user has transferred to others
  useEffect(() => {
    if (!userEmail) return;
    getSentTransfers(userEmail).then(setSentTransfers);
  }, [userEmail]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success("Signed out successfully");
      navigate("/");
    } catch (error) {
      toast.error("Failed to sign out");
    } finally {
      setIsSigningOut(false);
    }
  };

  // Separate upcoming and past tickets, then group by category
  const now = new Date();
  const upcomingTickets = tickets.filter(ticket => {
    if (!ticket.event_date) {
      return false;
    }
    const eventDate = new Date(ticket.event_date);
    return eventDate >= now && ticket.status !== 'checked_in';
  });

  const pastTickets = tickets.filter(ticket => {
    const eventDate = new Date(ticket.event_date);
    return eventDate < now || ticket.status === 'checked_in';
  });

  const openTransferDialog = (ticket: UserTicket) => {
    setSelectedTicket(ticket);
    setTransferToEmail('');
    setTransferToName('');
    setTransferDialogOpen(true);
  };

  const handleTransfer = async () => {
    if (!selectedTicket || !userEmail) return;
    if (!transferToEmail.trim() || !transferToName.trim()) {
      toast.error('Please enter recipient email and name');
      return;
    }

    setTransferLoading(true);
    const result = await transferTicket(
      selectedTicket.id,
      userEmail,
      transferToEmail.trim(),
      transferToName.trim()
    );
    setTransferLoading(false);

    if (!result.success) {
      toast.error(result.error || 'Transfer failed');
      return;
    }

    // Remove the transferred ticket from the list (it now belongs to the recipient)
    setTickets((prev) => prev.filter((t) => t.ticket_id !== selectedTicket.ticket_id));

    // Add the transfer to the sent transfers list for immediate UI feedback
    setSentTransfers((prev) => [
      {
        id: crypto.randomUUID(),
        ticket_id: selectedTicket.ticket_id,
        to_email: transferToEmail.trim(),
        to_name: transferToName.trim(),
        event_name: selectedTicket.event_name,
        ticket_type_name: selectedTicket.ticket_type_name,
        transferred_at: new Date().toISOString(),
      },
      ...prev,
    ]);

    setTransferDialogOpen(false);
    toast.success(`Ticket transferred to ${transferToName.trim()}`);
  };

  const handleDownloadTicket = (ticketId: string) => {
    window.open(`/ticket/${ticketId}?download=1`, "_blank", "noopener,noreferrer");
  };

  const handleAddToCalendar = (ticket: UserTicket) => {
    const start = ticket.event_time
      ? new Date(`${ticket.event_date}T${ticket.event_time}`)
      : new Date(ticket.event_date);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);

    const formatICSDate = (date: Date) =>
      date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Maguey Nightclub//Ticketing//EN",
      "BEGIN:VEVENT",
      `UID:${ticket.ticket_id}@maguey`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(start)}`,
      `DTEND:${formatICSDate(end)}`,
      `SUMMARY:${ticket.event_name}`,
      `LOCATION:${ticket.venue_name || ""} ${ticket.venue_address || ""} ${ticket.city || ""}`,
      `DESCRIPTION:Ticket Type: ${ticket.ticket_type_name}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ticket.event_name.replace(/\s+/g, "_")}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Group upcoming tickets by category
  const groupTicketsByCategory = (ticketList: UserTicket[]) => {
    const grouped = ticketList.reduce((acc, ticket) => {
      const category = ticket.ticket_category || 'general';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(ticket);
      return acc;
    }, {} as Record<string, UserTicket[]>);

    // Sort tickets within each category by event date
    Object.keys(grouped).forEach(category => {
      grouped[category].sort((a, b) => 
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
      );
    });

    return grouped;
  };

  const upcomingByCategory = groupTicketsByCategory(upcomingTickets);
  
  // Category display order and labels
  const categoryConfig: Record<string, { label: string; badgeClass: string }> = {
    vip: { label: 'VIP', badgeClass: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/50' },
    service: { label: 'Service', badgeClass: 'bg-purple-500/20 text-purple-700 border-purple-500/50' },
    section: { label: 'Sections', badgeClass: 'bg-blue-500/20 text-blue-700 border-blue-500/50' },
    general: { label: 'General Admission', badgeClass: 'bg-primary/20 text-primary border-primary/50' },
  };

  // Format time helper
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hourStr, minuteStr] = timeString.split(':');
    if (!hourStr || !minuteStr) return timeString;
    const date = new Date();
    date.setHours(Number(hourStr), Number(minuteStr));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <Music className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                MAGUEY
              </h1>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing out...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <EmailVerificationBanner />
        
        {/* Profile Section */}
        <Card className="p-6 border-border/50 bg-card mb-8">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1">{userName}</h2>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span className="text-sm">{userEmail}</span>
              </div>
              {user?.user_metadata?.provider && (
                <Badge variant="outline" className="mt-2">
                  Signed in with {user.user_metadata.provider === 'google' ? 'Google' : user.user_metadata.provider === 'facebook' ? 'Facebook' : user.user_metadata.provider}
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/profile">Edit Profile</Link>
            </Button>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-6 border-border/50 bg-card mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Event reminders</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receive a reminder 24 hours and 2 hours before your event
              </p>
            </div>
            <Switch
              checked={reminderEmailsEnabled}
              onCheckedChange={handleReminderToggle}
              disabled={reminderToggleLoading}
              aria-label="Toggle event reminder emails"
            />
          </div>
        </Card>

        {/* Upcoming Tickets */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Ticket className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Upcoming Events</h2>
          </div>

          {ticketsLoading ? (
            <Card className="p-8 border-border/50 bg-card text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading tickets...</p>
            </Card>
          ) : upcomingTickets.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(categoryConfig).map(([categoryKey, categoryInfo]) => {
                const categoryTickets = upcomingByCategory[categoryKey];
                if (!categoryTickets || categoryTickets.length === 0) return null;

                return (
                  <div key={categoryKey} className="space-y-3">
                    {categoryKey !== 'general' && (
                      <div className="flex items-center gap-2">
                        <Badge className={categoryInfo.badgeClass}>
                          {categoryInfo.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {categoryTickets.length} {categoryTickets.length === 1 ? 'ticket' : 'tickets'}
                        </span>
                      </div>
                    )}
            <div className="space-y-4">
                      {categoryTickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  className="p-6 border-border/50 bg-card hover:border-primary/50 transition-all"
                >
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="text-xl font-bold">{ticket.event_name}</h3>
                        <Badge className="bg-primary/20 text-primary border-primary/50">
                          {ticket.ticket_type_name}
                        </Badge>
                        {ticket.section_name && (
                          <Badge variant="outline" className="text-xs">
                            {ticket.section_name}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(ticket.event_date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            • {formatTime(ticket.event_time)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Music className="w-4 h-4" />
                          <span>{ticket.venue_name || "Maguey Nightclub"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full lg:w-64 flex flex-col items-center gap-3">
                      <div className="bg-white rounded-xl border border-border/40 p-3 w-full flex items-center justify-center">
                        <QRCode
                          value={ticket.qr_code_value || ticket.ticket_id}
                          size={140}
                          style={{ maxWidth: "100%", height: "auto" }}
                        />
                      </div>
                      <div className="grid gap-2 w-full">
                        <Button
                          variant="default"
                          className="bg-gradient-primary hover:shadow-glow-primary transition-all"
                          asChild
                        >
                          <Link to={`/ticket/${ticket.ticket_id}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Ticket
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          className="justify-center"
                          onClick={() => handleDownloadTicket(ticket.ticket_id)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-center"
                          onClick={() => handleAddToCalendar(ticket)}
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          Add to Calendar
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-center text-muted-foreground hover:text-foreground"
                          onClick={() => openTransferDialog(ticket)}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Transfer
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 border-border/50 bg-card text-center">
              <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No upcoming events</p>
              <Button asChild>
                <Link to="/">Browse Events</Link>
              </Button>
            </Card>
          )}
        </div>

        {/* VIP Reservations Section */}
        <div className="mb-8">
          <VIPReservationsSection />
        </div>

        {/* Transferred Tickets — tickets the user has sent to others */}
        {sentTransfers.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <ArrowRightLeft className="w-6 h-6 text-muted-foreground" />
              <h2 className="text-xl font-bold text-muted-foreground">Transferred Tickets</h2>
            </div>
            <div className="space-y-3">
              {sentTransfers.map((transfer) => (
                <Card
                  key={transfer.id}
                  className="p-4 border-border/30 bg-card/40 opacity-70"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-muted-foreground">
                        {transfer.event_name || 'Event'}
                      </p>
                      <p className="text-sm text-muted-foreground/70">
                        {transfer.ticket_type_name || 'Ticket'} • Transferred on{' '}
                        {new Date(transfer.transferred_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-muted-foreground/30 text-muted-foreground">
                      Transferred to {transfer.to_name}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Past Tickets */}
        {!ticketsLoading && pastTickets.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 text-muted-foreground">Past Events</h2>
            <div className="space-y-4">
              {pastTickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  className="p-6 border-border/50 bg-card/50 opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold mb-1">{ticket.event_name}</h3>
                      <div className="text-sm text-muted-foreground">
                        {new Date(ticket.event_date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric' 
                        })} • {ticket.ticket_type_name}
                      </div>
                    </div>
                    <Badge variant="outline" className="border-muted-foreground/30">
                      {ticket.status === 'checked_in' ? 'Attended' : 'Past'}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Transfer Ticket Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Transfer Ticket
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{selectedTicket.event_name}</p>
                <p className="text-muted-foreground">{selectedTicket.ticket_type_name}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer-email">Recipient email</Label>
                <Input
                  id="transfer-email"
                  type="email"
                  placeholder="friend@example.com"
                  value={transferToEmail}
                  onChange={(e) => setTransferToEmail(e.target.value)}
                  disabled={transferLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer-name">Recipient name</Label>
                <Input
                  id="transfer-name"
                  type="text"
                  placeholder="Jane Smith"
                  value={transferToName}
                  onChange={(e) => setTransferToName(e.target.value)}
                  disabled={transferLoading}
                />
              </div>

              <p className="text-xs text-muted-foreground bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3">
                This will transfer your ticket to{' '}
                <strong>{transferToName || 'the recipient'}</strong>. Your QR code will
                stop working immediately and a new one will be issued to the recipient.
                This action cannot be undone.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setTransferDialogOpen(false)}
              disabled={transferLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={transferLoading || !transferToEmail.trim() || !transferToName.trim()}
            >
              {transferLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Transfer Ticket
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Account;
