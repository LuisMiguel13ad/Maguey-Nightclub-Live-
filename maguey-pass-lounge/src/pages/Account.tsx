import { Link, useNavigate } from "react-router-dom";
import { Music, Ticket, User, Mail, Calendar, LogOut, Loader2, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { getUserTickets, type UserTicket } from "@/lib/orders-service";
import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner";
import { VIPReservationsSection } from "@/components/dashboard/VIPReservationsSection";
import QRCode from "react-qr-code";

const Account = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

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
    </div>
  );
};

export default Account;
